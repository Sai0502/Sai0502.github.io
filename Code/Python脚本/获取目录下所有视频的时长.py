import os
import subprocess


def get_video_duration(file_path):
    """
    获取视频文件的时长（格式：秒）
    """
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        duration = float(result.stdout.strip())
        return duration
    except Exception:
        return 0  # 如果出错，返回0秒


def format_duration(seconds):
    """
    将秒转换为 hh:mm:ss 格式
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02}:{minutes:02}:{secs:02}"


def generate_markdown_table(directory):
    """
    遍历目录，生成分组 Markdown 格式的表格
    """
    markdown_lines = ["| Video Name | Duration |", "|------------|----------|"]
    previous_dir = None
    directory_total_duration = 0  # 当前目录总时长
    temp_video_lines = []  # 临时存储当前目录的视频行

    for root, _, files in sorted(os.walk(directory)):
        # 筛选出视频文件
        video_files = [file for file in files if file.lower().endswith(('.mp4', '.mkv', '.avi', '.mov'))]
        if not video_files:
            continue

        # 当前目录的名称
        current_dir = os.path.basename(root) or "."

        # 如果切换到新的目录，输出上一个目录的总时长和视频行
        if previous_dir is not None and previous_dir != current_dir:
            markdown_lines.append(f"| **{previous_dir} (Total)** | **{format_duration(directory_total_duration)}** |")
            markdown_lines.extend(temp_video_lines)
            temp_video_lines = []  # 清空临时行
            directory_total_duration = 0  # 重置总时长

        previous_dir = current_dir

        # 添加当前目录的视频信息
        for file in sorted(video_files):
            file_path = os.path.join(root, file)
            duration = get_video_duration(file_path)
            directory_total_duration += duration
            temp_video_lines.append(f"| {file} | {format_duration(duration)} |")

    # 输出最后一个目录的总时长和视频行
    if previous_dir is not None:
        markdown_lines.append(f"| **{previous_dir} (Total)** | **{format_duration(directory_total_duration)}** |")
        markdown_lines.extend(temp_video_lines)

    return "\n".join(markdown_lines)


if __name__ == "__main__":
    # 指定要扫描的目录
    directory_to_scan = "/Users/jiangsai/Downloads/精品班 PremumClass001"
    
    # 生成 Markdown 表格
    markdown_table = generate_markdown_table(directory_to_scan)
    
    # 输出表格到终端
    print(markdown_table)
    
    # 保存到文件
    output_file_path = os.path.join(directory_to_scan, "video_durations.md")
    with open(output_file_path, "w") as md_file:
        md_file.write(markdown_table)
