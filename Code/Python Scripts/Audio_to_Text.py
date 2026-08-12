"""音视频批量转文字工具（faster-whisper）。

运行后弹出一个窗口，填写要处理的文件或目录、选择输出位置、模型和切分阈值，点“开始”即可。
转录结果是不含时间码的纯文本 .txt，自动识别语言并转成简体中文。

功能要点：
1. 输入可以是单个文件，也可以是目录；目录会【递归】处理所有子目录里的音视频文件。
2. 输出位置二选一：
   - “同目录”：结果紧挨着各自的源文件（子目录里的文件，结果就放在对应子目录里）。
   - “桌面”：把目录结构原样镜像到桌面的同名文件夹下；单文件则直接放桌面。
3. 超过“切分阈值”的长文件，会先用 ffmpeg 切成 FLAC 分片再逐段转录：
   - 在“最终 txt 所在目录”下建一个与文件同名（不含扩展名）的文件夹，存放分片音频和各分片的 txt；
   - 合并后的最终 txt 放在该文件夹【外面】（即和短文件一样的落点）。
4. 逐个文件处理，遇到问题不中断整批：某个文件“结果已存在 / 目标不可写 / 读不出时长 /
   转录失败”时，会跳过它并把原因记下来，继续处理下一个。全部处理完后，如果存在未成功的
   文件，会在【桌面】生成一个带时间戳的日志（Audio_to_Text_错误日志_年月日_时分秒.log）。

依赖：
    python -m pip install faster-whisper zhconv
    ffmpeg 和 ffprobe 需要在 PATH 中（见 blog 的 ffmpeg 安装说明）。
"""

from __future__ import annotations

import math
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from faster_whisper import WhisperModel

try:
    from zhconv import convert
except ImportError:
    convert = None


# ============================ 常量配置 ============================

MEDIA_EXTENSIONS = (
    ".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus", ".wma",
    ".webm", ".mp4", ".m4v", ".mkv", ".avi", ".mov", ".mpeg", ".mpg", ".ts",
)

MODEL_CHOICES = ("tiny", "base", "small", "medium", "large-v3")
SEGMENT_CHOICES = (15, 30, 45, 60)  # 切分阈值（分钟），步幅 15

DEFAULT_MODEL = "medium"
DEFAULT_SEGMENT_MINUTES = 30

MODE_BESIDE = "beside"    # 输出到同目录
MODE_DESKTOP = "desktop"  # 输出到桌面

# 切分分片的文件名前缀。用一个独特前缀，方便递归扫描时把“本工具生成的分片”排除掉，
# 避免重复运行时把上次切出来的分片当成新的输入媒体文件。
PART_PREFIX = "a2t_part_"


# ============================ 数据结构 ============================

@dataclass
class Config:
    """从弹窗收集到的用户配置。"""
    source: Path          # 用户输入的文件或目录（已解析为绝对路径）
    is_dir: bool          # source 是否为目录
    mode: str             # MODE_BESIDE / MODE_DESKTOP（用户选择）
    model: str            # faster-whisper 模型名
    segment_minutes: int  # 切分阈值（分钟）


@dataclass
class Job:
    """单个媒体文件的处理计划。"""
    src: Path             # 源媒体文件
    duration: float       # 时长（秒）
    will_split: bool      # 是否需要切分
    final_txt: Path       # 最终合并 txt 的落点
    work_dir: Path | None # 切分时的分片工作目录；不切分为 None


@dataclass
class Issue:
    """一条“未成功”记录，最终统一写入桌面日志。"""
    category: str  # 原因分类，如“结果已存在”“读不出时长”“转录失败”
    src: Path      # 涉及的源文件
    detail: str    # 具体说明


# ============================ 基础工具函数 ============================

def format_seconds(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def atomic_write_text(path: Path, text: str) -> None:
    """写入临时文件后替换目标，避免中断时留下半个结果文件。"""
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def require_tool(name: str) -> str:
    import shutil
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"找不到 {name}，请确认它已安装并且在 PATH 中。")
    return path


def get_media_duration(file_path: Path, ffprobe_path: str) -> float:
    command = [
        ffprobe_path, "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    value = float(result.stdout.strip())
    if not math.isfinite(value) or value <= 0:
        raise RuntimeError(f"无法读取有效的媒体时长：{file_path}")
    return value


def nearest_existing_ancestor(path: Path) -> Path:
    """返回 path 自身或往上第一个已存在的目录，用于可写性检查。"""
    current = path
    while not current.exists():
        if current.parent == current:  # 到达根
            break
        current = current.parent
    return current


def is_part_file(path: Path) -> bool:
    """判断是否是本工具切分生成的分片（避免重复运行时被当成输入）。"""
    return path.suffix.lower() == ".flac" and path.name.startswith(PART_PREFIX)


def find_media_files(source: Path) -> list[Path]:
    """单文件直接返回；目录则递归查找所有子目录里的媒体文件（排除本工具的分片）。"""
    if source.is_file():
        return [source]
    return sorted(
        (
            path.resolve()
            for path in source.rglob("*")
            if path.is_file()
            and path.suffix.lower() in MEDIA_EXTENSIONS
            and not is_part_file(path)
        ),
        key=lambda p: str(p).lower(),
    )


# ============================ 转录核心 ============================

def transcribe_audio_file(model: WhisperModel, input_path: Path) -> str:
    """自动识别语言，返回不含时间码的纯文本。"""
    start_time = time.time()
    segments, info = model.transcribe(
        str(input_path),
        language=None,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    duration = info.duration or 0
    print(f"    音频时长：{format_seconds(duration)}")

    text_parts: list[str] = []
    last_percent = -1
    for segment in segments:
        text = segment.text.strip()
        if text:
            text_parts.append(text)

        if duration <= 0:
            continue
        progress = min(max(segment.end / duration, 0), 1)
        percent = int(progress * 100)
        if percent == last_percent:
            continue
        elapsed = time.time() - start_time
        # progress 极小时 elapsed/progress 会爆出离谱数值，加一个下限保护。
        if progress > 0.001:
            remaining = max(elapsed / progress - elapsed, 0)
            remaining_str = format_seconds(remaining)
        else:
            remaining_str = "计算中"
        print(
            f"\r    分片进度：{percent:3d}% "
            f"({format_seconds(segment.end)} / {format_seconds(duration)}) "
            f"已用 {format_seconds(elapsed)} 预计剩余 {remaining_str}",
            end="",
            flush=True,
        )
        last_percent = percent
    print()
    return "\n".join(text_parts)


def simplify_text(text: str) -> str:
    if convert:
        return convert(text, "zh-cn")
    print("未安装 zhconv，跳过繁简转换。")
    return text


def split_to_audio_parts(
    file_path: Path, workspace: Path, segment_seconds: int, ffmpeg_path: str,
) -> list[Path]:
    """只提取第一条音频流并切成 FLAC，避免复制视频容器的关键帧问题。"""
    pattern = workspace / f"{PART_PREFIX}%04d.flac"
    command = [
        ffmpeg_path, "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
        "-i", str(file_path),
        "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "flac",
        "-f", "segment", "-segment_time", str(segment_seconds),
        "-reset_timestamps", "1", str(pattern),
    ]
    print(f"  正在拆分音频，每段约 {segment_seconds // 60} 分钟……")
    subprocess.run(command, check=True)

    parts = sorted(workspace.glob(f"{PART_PREFIX}*.flac"))
    parts = [part for part in parts if part.stat().st_size > 0]
    if not parts:
        raise RuntimeError("FFmpeg 没有生成任何音频分片，请检查输入文件的音频流。")
    return parts


def transcribe_part(model: WhisperModel, part_path: Path) -> str:
    """转录单个分片，并把分片文本写到分片旁边（同名 .txt）。"""
    text_path = part_path.with_suffix(".txt")
    text = simplify_text(transcribe_audio_file(model, part_path))
    atomic_write_text(text_path, text + ("\n" if text else ""))
    return text


# ============================ 计划、分类与日志 ============================

def build_plan(
    config: Config, ffprobe_path: str, media_files: list[Path],
) -> tuple[list[Job], list[Issue], str, Path | None]:
    """根据配置计算每个文件的输出落点。

    返回 (jobs, bad, effective_mode, dest_root)：
    - jobs：成功读到时长、可以进入下一步的文件计划。
    - bad：读不出时长的坏文件（记为 Issue，稍后写日志）。
    - effective_mode：真正生效的模式（桌面模式下若目标根就是源目录本身，会退化为同目录）。
    - dest_root：桌面模式且输入是目录时的镜像根文件夹，否则 None。
    """
    desktop = Path.home() / "Desktop"

    effective_mode = config.mode
    dest_root: Path | None = None

    if config.mode == MODE_DESKTOP and config.is_dir:
        dest_root = desktop / config.source.name
        # 源目录本身就在桌面且同名时，镜像根 == 源目录，直接当作“同目录”处理。
        if dest_root.resolve() == config.source.resolve():
            effective_mode = MODE_BESIDE
            dest_root = None

    segment_seconds = config.segment_minutes * 60
    jobs: list[Job] = []
    bad: list[Issue] = []
    for src in media_files:
        try:
            duration = get_media_duration(src, ffprobe_path)
        except Exception as error:  # noqa: BLE001
            bad.append(Issue("读不出时长（坏文件或无音频）", src, str(error)))
            continue

        will_split = duration > segment_seconds
        if effective_mode == MODE_BESIDE:
            base_dir = src.parent
        elif config.is_dir:
            # 桌面镜像：把 src 相对源目录的层级复制到 dest_root 下
            rel = src.parent.resolve().relative_to(config.source.resolve())
            base_dir = dest_root / rel
        else:
            base_dir = desktop  # 桌面 + 单文件

        final_txt = base_dir / f"{src.stem}.txt"
        work_dir = (base_dir / src.stem) if will_split else None
        jobs.append(Job(src, duration, will_split, final_txt, work_dir))

    return jobs, bad, effective_mode, dest_root


def classify_jobs(jobs: list[Job]) -> tuple[list[Job], list[Issue]]:
    """逐个检查冲突和可写性，把 jobs 分成“可执行”和“跳过（附原因）”两组。"""
    runnable: list[Job] = []
    skipped: list[Issue] = []
    claimed: dict[Path, Path] = {}  # final_txt -> 先占用它的源文件

    for job in jobs:
        ancestor = nearest_existing_ancestor(job.final_txt.parent)
        if not os.access(ancestor, os.W_OK):
            skipped.append(Issue("目标目录不可写", job.src, f"不可写：{ancestor}"))
            continue
        if job.final_txt.exists():
            skipped.append(Issue("结果已存在", job.src, f"已存在：{job.final_txt}"))
            continue
        if job.work_dir is not None and job.work_dir.exists():
            skipped.append(Issue("分片文件夹已存在", job.src, f"已存在：{job.work_dir}"))
            continue
        if job.final_txt in claimed:
            skipped.append(Issue(
                "结果路径与其它文件重复", job.src,
                f"{job.final_txt} 已被 {claimed[job.final_txt]} 占用（同目录同名不同扩展名）",
            ))
            continue
        claimed[job.final_txt] = job.src
        runnable.append(job)

    return runnable, skipped


def write_issue_log(issues: list[Issue], mode_label: str) -> Path | None:
    """把未成功记录统一写到桌面的带时间戳日志；无记录则不生成。返回日志路径。"""
    if not issues:
        return None

    desktop = Path.home() / "Desktop"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = desktop / f"Audio_to_Text_错误日志_{timestamp}.log"

    lines = [
        "音视频转文字 —— 未成功文件日志",
        f"时间：{datetime.now():%Y-%m-%d %H:%M:%S}",
        f"输出模式：{mode_label}",
        f"未成功文件数：{len(issues)}",
        "=" * 48,
        "",
    ]
    for issue in issues:
        lines.append(f"[{issue.category}] {issue.src}")
        lines.append(f"    -> {issue.detail}")
        lines.append("")

    content = "\n".join(lines)
    try:
        log_path.write_text(content, encoding="utf-8")
    except Exception as error:  # noqa: BLE001
        # 桌面万一写不了，兜底打印到控制台，保证信息不丢。
        print(f"[警告] 日志写入桌面失败（{error}），以下为完整未成功记录：\n{content}")
        return None
    return log_path


# ============================ 执行 ============================

def run_job(model: WhisperModel, job: Job, segment_seconds: int, ffmpeg_path: str) -> None:
    job.final_txt.parent.mkdir(parents=True, exist_ok=True)

    if job.will_split:
        assert job.work_dir is not None
        job.work_dir.mkdir(parents=True, exist_ok=True)
        print(f"  工作目录（分片保留在此）：{job.work_dir}")
        parts = split_to_audio_parts(job.src, job.work_dir, segment_seconds, ffmpeg_path)
        texts: list[str] = []
        for index, part_path in enumerate(parts, 1):
            print(f"  正在转录分片 ({index}/{len(parts)})：{part_path.name}")
            texts.append(transcribe_part(model, part_path))
        final_text = "\n\n".join(t.strip() for t in texts if t.strip())
    else:
        print("  文件未超过切分阈值，直接转录。")
        final_text = simplify_text(transcribe_audio_file(model, job.src))

    atomic_write_text(job.final_txt, final_text + ("\n" if final_text else ""))
    print(f"  转录完成：{job.final_txt}")


# ============================ 图形界面 ============================

def run_gui() -> Config | None:
    """弹出配置窗口；点“开始”返回 Config，关闭 / 取消返回 None。"""
    try:
        import tkinter as tk
        from tkinter import ttk
    except ImportError as error:
        raise RuntimeError("当前 Python 没有 tkinter，无法显示配置窗口。") from error

    result: dict[str, Config] = {}

    root = tk.Tk()
    root.title("音视频转文字")
    root.attributes("-topmost", True)
    root.after(800, lambda: root.attributes("-topmost", False))

    padding = {"padx": 10, "pady": 6}

    # 第一行：路径输入（直接把路径粘贴到输入框即可）
    row1 = tk.Frame(root)
    row1.pack(fill="x", **padding)
    tk.Label(row1, text="文件或目录路径：").pack(side="left")
    path_var = tk.StringVar()
    path_entry = tk.Entry(row1, textvariable=path_var, width=48)
    path_entry.pack(side="left", fill="x", expand=True)

    # 第二行：输出位置单选（互斥，默认同目录）
    row2 = tk.Frame(root)
    row2.pack(fill="x", **padding)
    tk.Label(row2, text="输出位置：").pack(side="left")
    mode_var = tk.StringVar(value=MODE_BESIDE)
    tk.Radiobutton(row2, text="输出到同目录", variable=mode_var, value=MODE_BESIDE).pack(side="left")
    tk.Radiobutton(row2, text="输出到桌面", variable=mode_var, value=MODE_DESKTOP).pack(side="left", padx=(10, 0))

    # 第三行：模型 + 切分阈值
    row3 = tk.Frame(root)
    row3.pack(fill="x", **padding)
    tk.Label(row3, text="模型：").pack(side="left")
    model_var = tk.StringVar(value=DEFAULT_MODEL)
    ttk.Combobox(
        row3, textvariable=model_var, values=list(MODEL_CHOICES),
        state="readonly", width=10,
    ).pack(side="left")
    tk.Label(row3, text="    切分阈值(分钟)：").pack(side="left")
    seg_var = tk.StringVar(value=str(DEFAULT_SEGMENT_MINUTES))
    ttk.Combobox(
        row3, textvariable=seg_var, values=[str(x) for x in SEGMENT_CHOICES],
        state="readonly", width=6,
    ).pack(side="left")

    # 底部：提示语 + 开始 / 取消
    row4 = tk.Frame(root)
    row4.pack(fill="x", **padding)
    hint_var = tk.StringVar(value="")
    tk.Label(row4, textvariable=hint_var, fg="red").pack(side="left")

    def on_start():
        raw = path_var.get().strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
            raw = raw[1:-1].strip()
        if not raw:
            hint_var.set("请填写路径")
            return
        source = Path(raw).expanduser()
        if not source.exists():
            hint_var.set("路径不存在")
            return
        result["config"] = Config(
            source=source.resolve(),
            is_dir=source.is_dir(),
            mode=mode_var.get(),
            model=model_var.get(),
            segment_minutes=int(seg_var.get()),
        )
        # 先隐藏并强制刷新，让窗口在开始耗时转录前真正从屏幕消失，
        # 否则主线程被转录阻塞时会留下“幽灵窗口 + 彩虹转圈”。
        root.withdraw()
        root.update_idletasks()
        root.update()
        root.destroy()

    def on_cancel():
        root.destroy()

    tk.Button(row4, text="取消", command=on_cancel).pack(side="right")
    tk.Button(row4, text="开始", command=on_start).pack(side="right", padx=(0, 6))

    root.protocol("WM_DELETE_WINDOW", on_cancel)
    root.bind("<Return>", lambda event: on_start())  # 回车等于点“开始”
    path_entry.focus_set()
    root.mainloop()

    return result.get("config")


# ============================ 主流程 ============================

def main() -> None:
    config = run_gui()
    if config is None:
        print("已取消。")
        return

    ffmpeg_path = require_tool("ffmpeg")
    ffprobe_path = require_tool("ffprobe")

    media_files = find_media_files(config.source)
    if not media_files:
        raise SystemExit(f"没有找到支持的音视频文件：{config.source}")
    print(f"共找到 {len(media_files)} 个音视频文件，正在读取时长并规划输出……")

    jobs, bad, effective_mode, dest_root = build_plan(config, ffprobe_path, media_files)
    runnable, skipped = classify_jobs(jobs)
    issues: list[Issue] = list(bad) + list(skipped)  # 汇总所有未成功记录

    mode_label = "同目录" if effective_mode == MODE_BESIDE else "桌面"
    print(f"输出模式：{mode_label}；模型：{config.model}；切分阈值：{config.segment_minutes} 分钟")
    if issues:
        print(f"预处理阶段 {len(issues)} 个文件将被跳过（原因见最终日志）。")
    print(f"待转录：{len(runnable)} 个。\n")

    success_count = 0
    if runnable:
        print(f"正在加载 Whisper {config.model} 模型……")
        model = WhisperModel(config.model, compute_type="int8")

        segment_seconds = config.segment_minutes * 60
        for index, job in enumerate(runnable, 1):
            print(f"===== ({index}/{len(runnable)}) {job.src.name}"
                  f"（{format_seconds(job.duration)}，{'切分' if job.will_split else '直接转录'}）=====")
            try:
                run_job(model, job, segment_seconds, ffmpeg_path)
                success_count += 1
            except Exception as error:  # noqa: BLE001
                issues.append(Issue("转录失败", job.src, str(error)))
                print(f"  处理失败：{error}")
            print()

    # 统一写日志（无未成功记录则不生成）
    log_path = write_issue_log(issues, mode_label)

    print("=" * 48)
    print(f"处理结束：成功 {success_count} 个，未成功 {len(issues)} 个。")
    if success_count == 0:
        print("全部跳过 / 失败，未产出任何结果。")
    if log_path is not None:
        print(f"未成功清单已写入日志：{log_path}")


if __name__ == "__main__":
    main()
