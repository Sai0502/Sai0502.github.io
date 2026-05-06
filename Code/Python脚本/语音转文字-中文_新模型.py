import os
import time
from faster_whisper import WhisperModel

try:
    from zhconv import convert
except ImportError:
    convert = None

MEDIA_EXTENSIONS = (".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")
SUBTITLE_DIR_NAME = "Sub"

def format_seconds(seconds):
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"

def get_output_path(input_path):
    input_dir = os.path.dirname(input_path)
    filename = os.path.splitext(os.path.basename(input_path))[0] + ".txt"
    return os.path.join(input_dir, SUBTITLE_DIR_NAME, filename)

def get_legacy_output_path(input_path):
    return os.path.splitext(input_path)[0] + ".txt"

def has_existing_transcript(input_path, output_path):
    return os.path.exists(output_path) or os.path.exists(get_legacy_output_path(input_path))

# 处理单个音视频文件
def transcribe_audio_file(model, input_path, output_path, language):
    start_time = time.time()  # 开始计时

    # segments, info = model.transcribe(input_path, language=language)   # 指定语言无法转录中英或者中日混杂的文件
    segments, info = model.transcribe(input_path)   # 不指定语言可让模型自动识别语言
    duration = info.duration or 0
    print(f"音频时长: {format_seconds(duration)}")

    text_parts = []
    last_percent = -1
    for segment in segments:
        text_parts.append(segment.text)

        if duration <= 0:
            continue

        progress = min(segment.end / duration, 1)
        percent = int(progress * 100)
        if percent == last_percent:
            continue

        elapsed_time = time.time() - start_time
        estimated_total = elapsed_time / progress if progress > 0 else 0
        remaining_time = estimated_total - elapsed_time
        print(
            f"\r转录进度: {percent:3d}% "
            f"({format_seconds(segment.end)} / {format_seconds(duration)}) "
            f"已用 {format_seconds(elapsed_time)} "
            f"预计剩余 {format_seconds(remaining_time)}",
            end="",
            flush=True,
        )
        last_percent = percent

    print()
    full_text = "\n".join(text_parts)

    # zhconv 转换为简体中文；未安装 zhconv 时保留原文
    if convert:
        simplified_text = convert(full_text, "zh-cn")
    else:
        print("未安装 zhconv，跳过繁简转换。")
        simplified_text = full_text

    # 保存到文件
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(simplified_text)

    end_time = time.time()
    elapsed_time = end_time - start_time
    elapsed_minutes = elapsed_time / 60
    rest_minutes = int(elapsed_minutes // 10) + 1
    rest_seconds = rest_minutes * 60

    # print(f"{output_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒，避免CPU过热。")
    # time.sleep(rest_seconds)

# 批量处理文件夹
def transcribe_directory(model, folder_path, language, skip_existing=True):
    for root, dirs, files in os.walk(folder_path):
        dirs.sort()
        if SUBTITLE_DIR_NAME in dirs:
            dirs.remove(SUBTITLE_DIR_NAME)

        for file in sorted(files):
            if file.lower().endswith(MEDIA_EXTENSIONS):
                video_path = os.path.join(root, file)
                output_path = get_output_path(video_path)
                if skip_existing and has_existing_transcript(video_path, output_path):
                    print(f"已存在，跳过: {output_path}")
                    continue

                print(f"正在转录: {video_path}")
                try:
                    transcribe_audio_file(model, video_path, output_path, language)
                except Exception as e:
                    print(f"{video_path} 转录失败: {e}")

# 入口函数
def cooking(input_path, whisper_model_name):
    # "float16"（GPU），"int8"（CPU），"auto"（自动选用 GPU 或 CPU）
    model = WhisperModel(whisper_model_name, compute_type="int8")

    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, language="zh")
    elif os.path.isfile(input_path):
        output_path = get_output_path(input_path)
        if has_existing_transcript(input_path, output_path):
            print(f"已存在，跳过: {output_path}")
            return

        print(f"{input_path}，正在转录....")
        try:
            transcribe_audio_file(model, input_path, output_path, language="zh")
        except Exception as e:
            print(f"{input_path} 转录失败: {e}")
    else:
        print(f"提供的路径无效：{input_path}")

if __name__ == "__main__":
    input_path = '/Users/jiangsai/Downloads/Trading/veilflame'
    whisper_model_name = "medium"  # 可用: "tiny", "base", "small", "medium", "large-v3"
    cooking(input_path, whisper_model_name)
