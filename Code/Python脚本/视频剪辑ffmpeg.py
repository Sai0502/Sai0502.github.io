# 视频剪辑，Movie_Edit.txt示例
# 文件名路径：/Users/jiangsai/Desktop/供需关系/1.0.mp4
# 24:28 - 28:59
# 1:36:13 - 1:52:46

import os
import re
import subprocess

def parse_time(t):
    """把 24:28 或 1:21:33 转换成秒"""
    t = t.replace("：", ":")  # ✅ 自动把全角冒号替换成半角
    parts = t.split(":")
    parts = [int(p) for p in parts]
    if len(parts) == 2:  # 分:秒
        m, s = parts
        return m * 60 + s
    elif len(parts) == 3:  # 时:分:秒
        h, m, s = parts
        return h * 3600 + m * 60 + s
    else:
        raise ValueError(f"无法解析时间格式: {t}")

def process_file(instruction_file):
    with open(instruction_file, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    # 第一行是文件路径
    # input_file = lines[0].split("：", 1)[1]
    input_file = lines[0]
    base_dir = os.path.dirname(input_file)
    filename = os.path.basename(input_file)
    name, ext = os.path.splitext(filename)
    output_file = os.path.join(base_dir, f"{name}_Done{ext}")

    # 解析要删除的时间段
    cut_ranges = []
    for line in lines[1:]:
        start, end = re.split(r"\s*-\s*", line)
        cut_ranges.append((parse_time(start), parse_time(end)))

    # 获取总时长
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
           "-of", "default=noprint_wrappers=1:nokey=1", input_file]
    total_duration = float(subprocess.check_output(cmd).decode().strip())

    # 计算保留的片段
    keep_ranges = []
    last_end = 0
    for start, end in cut_ranges:
        if last_end < start:
            keep_ranges.append((last_end, start))
        last_end = end
    if last_end < total_duration:
        keep_ranges.append((last_end, total_duration))

    # 逐段导出临时文件
    temp_files = []
    for i, (start, end) in enumerate(keep_ranges):
        temp_file = os.path.join(base_dir, f"temp_{i}{ext}")
        cmd = [
            "ffmpeg", "-y", "-i", input_file,
            "-ss", str(start), "-to", str(end),
            "-c", "copy", temp_file
        ]
        subprocess.run(cmd, check=True)
        temp_files.append(temp_file)

    # 合并
    concat_file = os.path.join(base_dir, "concat_list.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for temp in temp_files:
            f.write(f"file '{temp}'\n")

    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file, "-c", "copy", output_file
    ], check=True)

    # 清理临时文件
    for temp in temp_files:
        os.remove(temp)
    os.remove(concat_file)

    print(f"处理完成: {output_file}")


if __name__ == "__main__":
    process_file("/Users/jiangsai/Desktop/Movie_Edit.txt")  # 你的文件名