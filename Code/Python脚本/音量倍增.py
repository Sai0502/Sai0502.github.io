import os
import subprocess

# ====== 配置 ======
input_folder = "/Users/jiangsai/Desktop/未命名文件夹"  # 改成你的视频文件夹路径
output_folder = os.path.join(input_folder, "output_videos")
volume_factor = 10.0  # 音量倍数

# 支持的视频格式
video_extensions = (".mp4", ".mov", ".mkv", ".avi", ".flv", ".wmv")

# ====== 创建输出目录 ======
os.makedirs(output_folder, exist_ok=True)

# ====== 遍历文件 ======
for filename in os.listdir(input_folder):
    if filename.lower().endswith(video_extensions):
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder, filename)

        print(f"处理: {filename}")

        command = [
            "ffmpeg",
            "-i", input_path,
            "-af", f"volume={volume_factor}",
            "-c:v", "copy",
            output_path
        ]

        try:
            subprocess.run(command, check=True)
            print(f"完成: {filename}\n")
        except subprocess.CalledProcessError:
            print(f"失败: {filename}\n")

print("全部处理完成！")