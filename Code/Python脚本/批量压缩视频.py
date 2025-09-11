# 批量压缩目录下所有视频
# brew install handbrake

import os
import subprocess

def compress_videos(input_dir):
    # 创建输出目录
    output_dir = os.path.join(input_dir, "压缩Done")
    os.makedirs(output_dir, exist_ok=True)

    # 获取目录下所有文件并排序
    files = sorted(os.listdir(input_dir))

    for filename in files:
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)

        # 只处理视频文件（简单判断扩展名）
        if os.path.isfile(input_path) and filename.lower().endswith(('.mp4', '.mkv', '.avi', '.mov')):
            print(f"正在压缩: {filename}")
            subprocess.run([
                "HandBrakeCLI", 
                "-i", input_path, 
                "-o", output_path,
                "-e", "x264",  # 使用x264编码
                "-q", "22",    # 质量值，18-28之间，数值越小质量越好（文件越大）
                "-B", "160"    # 音频比特率
            ])
            print(f"完成: {filename}")

if __name__ == "__main__":
    compress_videos("/Users/jiangsai/Desktop/smc中阶课程")



# # 批量压缩目录下所有视频
# # brew install handbrake

# import os
# import subprocess

# # ===== 配置部分 =====
# # 输入目录
# input_dir = "/Users/jiangsai/Desktop/smc中阶课程"
# # 输出目录（自动新建）
# output_dir = os.path.join(input_dir, "压缩Done")

# # HandBrakeCLI 路径（如果在 PATH 里，可以直接写 "HandBrakeCLI"）
# handbrake_cli = "HandBrakeCLI"

# # 压缩参数（可以根据需求调整）
# # -e x264  -> 使用x264编码
# # -q 22    -> 质量值，18-28之间，数值越小质量越好（文件越大）
# # -B 160   -> 音频比特率
# encode_options = ["-e", "x264", "-q", "22", "-B", "160"]

# # 创建输出目录
# os.makedirs(output_dir, exist_ok=True)

# # 遍历文件
# for filename in os.listdir(input_dir):
#     filepath = os.path.join(input_dir, filename)

#     # 只处理视频文件（简单判断扩展名）
#     if os.path.isfile(filepath) and filename.lower().endswith((".mp4", ".mkv", ".avi", ".mov")):
#         output_path = os.path.join(output_dir, filename)

#         cmd = [handbrake_cli, "-i", filepath, "-o", output_path] + encode_options
#         print(f"正在压缩: {filename} ...")
#         try:
#             subprocess.run(cmd, check=True)
#             print(f"✅ 完成: {output_path}")
#         except subprocess.CalledProcessError:
#             print(f"❌ 失败: {filename}")
