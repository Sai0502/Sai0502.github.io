# 批量压缩目录下所有视频
# brew install handbrake

import os
import subprocess

def compress_videos(input_dir):
    # 输出总目录
    output_root = os.path.join(input_dir, "压缩Done")

    for root, _, files in os.walk(input_dir):
        # 跳过输出目录自身，避免死循环
        if root.startswith(output_root):
            continue

        # 计算相对路径，在输出目录保持同样结构
        rel_path = os.path.relpath(root, input_dir)
        output_dir = os.path.join(output_root, rel_path)
        os.makedirs(output_dir, exist_ok=True)

        for filename in sorted(files):
            input_path = os.path.join(root, filename)

            # 去掉原扩展名，统一输出为 .mp4
            base_name, _ = os.path.splitext(filename)
            output_path = os.path.join(output_dir, base_name + ".mp4")

            # 只处理视频文件
            if filename.lower().endswith(('.mp4', '.mkv', '.avi', '.mov')):
                # 如果输出文件已存在，跳过
                if os.path.exists(output_path):
                    print(f"跳过已存在: {output_path}")
                    continue

                print(f"正在压缩: {input_path} -> {output_path}")
                subprocess.run([
                    "HandBrakeCLI",
                    "-i", input_path,
                    "-o", output_path,
                    "-e", "x264",   # 使用 x264 编码
                    "-q", "22",     # 质量值，18-28之间，数值越小质量越好（文件越大）
                    "-B", "160"     # 音频比特率
                ])
                print(f"完成: {output_path}")

def Scheduled_Execution(hour, min, sec):
    """在指定时间执行任务"""
    import time
    from datetime import datetime

    while True:
        now = datetime.now()
        # 判断当前是否为指定时间
        # if now.hour == hour and now.minute == min and now.second == sec:
        if now.hour == hour:
            break
        else:
            print(f"当前时间 {now.strftime('%H:%M:%S')}，等待到目标时间再执行任务...")
        # 每分钟检测一次
        time.sleep(60)

if __name__ == "__main__":
    # 指定时间执行
    Scheduled_Execution(hour=9, min=0, sec=0)

    compress_videos("/Users/jiangsai/Downloads/Deep Dive 足迹图")

    # 执行完播放提示音
    subprocess.run(["afplay", "/System/Library/Sounds/Sosumi.aiff"])