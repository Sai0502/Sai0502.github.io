# 安装 ffmpeg 和 translate-shell：brew install ffmpeg translate-shell（设置全局代理，博客搜“代理“）
# 安装 openai-whisper：pip install openai-whisper
# 自动翻译废弃了，Google翻译不好，最好的是转录完丢给grok
import os
import time
import whisper
import subprocess

# 使用 translate-shell 将英文翻译成中文
def translate_with_google(text):
    if not text.strip():
        return ""
    try:
        result = subprocess.run(
            ['trans', '-brief', ':zh', text],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=10,
            text=True
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"[翻译失败] {text} → {e}")
        return "[翻译失败]"

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
            # zh = translate_with_google(eng)
            start = format_timestamp(segment["start"])
            end = format_timestamp(segment["end"])

            f.write(f"{idx}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{eng}\n")
            # f.write(f"{zh}\n\n")

            time.sleep(0.5)  # 控制翻译速率，避免风控

    elapsed_minutes = (time.time() - start_time) / 60
    rest_seconds = (int(elapsed_minutes // 10) + 1) * 60

    print(f"{srt_path} 双语字幕生成完毕，用时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒防止过热。")
    time.sleep(rest_seconds)

# 递归处理目录及其子目录下的所有视频文件
def transcribe_directory(model, input_folder, language):
    for root, dirs, files in os.walk(input_folder):  # 自动递归子目录
        for file in files:
            if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
                video_path = os.path.join(root, file)
                txt_path = os.path.splitext(video_path)[0] + ".txt"
                print(f"{video_path} 开始生成双语字幕...")
                transcribe_audio_file(model, video_path, txt_path, language)


# 主控制函数：判断路径类型并调用对应处理逻辑
def cooking(input_path, whisper_model):
    model = whisper.load_model(whisper_model)

    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, language="en")
    elif os.path.isfile(input_path):
        output_path = os.path.splitext(input_path)[0] + ".txt"
        print(f"{input_path}，开始生成双语字幕...")
        transcribe_audio_file(model, input_path, output_path, language="en")
    else:
        print(f"❌ 无效路径：{input_path}")

if __name__ == "__main__":
    # 输入路径：可以是单个视频，也可以是文件夹
    input_path = '/Users/jiangsai/Downloads/幻影交易2024/Module 4 - OrderFlow/PTS-M4_1、Orderflow Basics_ Supply & Demand.mp4'
    # 加载Whisper模型 "tiny", "base", "small", "medium", "large", "turbo"
    whisper_model = "base"
    cooking(input_path, whisper_model)
