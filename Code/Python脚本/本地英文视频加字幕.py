# 安装 openai-whisper：pip install openai-whisper
import os
import time
import whisper
import subprocess

# 将秒数转换为 SRT 格式的时间戳（如 00:01:15,300）
def format_timestamp(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

# 处理单个音视频文件：转录 + 生成 .srt 双语字幕
def transcribe_audio_file(model, input_path, output_path, language):
    start_time = time.time()

    # 使用 Whisper 转录音频
    result = model.transcribe(input_path, language=language)

    srt_path = output_path.replace(".txt", ".srt")

    with open(srt_path, "w", encoding="utf-8") as f:
        for idx, segment in enumerate(result["segments"], start=1):
            eng = segment["text"].strip()
            start = format_timestamp(segment["start"])
            end = format_timestamp(segment["end"])

            f.write(f"{idx}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{eng}\n")
            time.sleep(0.5)  # 控制翻译速率，避免风控

    elapsed_minutes = (time.time() - start_time) / 60
    rest_seconds = (int(elapsed_minutes // 10) + 1) * 60

    print(f"{srt_path} 字幕生成完毕，用时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒防止过热。")
    time.sleep(rest_seconds)

# 批量处理目录下所有音视频文件
def transcribe_directory(model, input_folder, language):
    # 筛选支持的视频音频文件格式
    video_files = [
        f for f in os.listdir(input_folder)
        if f.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi"))
    ]

    for video_file in video_files:
        video_path = os.path.join(input_folder, video_file)
        txt_path = os.path.join(input_folder, os.path.splitext(video_file)[0] + ".txt")  # 用于生成 srt 文件名
        print(f"{video_file}，开始生成字幕...")
        transcribe_audio_file(model, video_path, txt_path, language)

# 主控制函数：判断路径类型并调用对应处理逻辑
def cooking(input_path, whisper_model):
    model = whisper.load_model(whisper_model)

    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, language="en")
    elif os.path.isfile(input_path):
        output_path = os.path.splitext(input_path)[0] + ".txt"
        print(f"{input_path}，开始生成字幕...")
        transcribe_audio_file(model, input_path, output_path, language="en")
    else:
        print(f"❌ 无效路径：{input_path}")

if __name__ == "__main__":
    # 输入路径：可以是单个视频，也可以是文件夹
    input_path = "/Users/jiangsai/Downloads/幻影交易2024/Module 1 - Introduction to Phantom Trading/PTS-M1_2、The Phantom Trading Discord Community.mp4"
    # Whisper 模型：建议用 base 或 small，"turbo" 是非法模型名
    whisper_model = "base"
    cooking(input_path, whisper_model)
