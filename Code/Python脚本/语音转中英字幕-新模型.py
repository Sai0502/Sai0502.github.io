import os
import time
from zhconv import convert
from faster_whisper import WhisperModel

# 将秒数转换为 SRT 格式时间戳（如 00:01:15,300）
def format_timestamp(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

# 转录单个文件
def transcribe_audio_file(model, input_path, output_path, mode):
    start_time = time.time()

    # mode 决定语言
    language = "en" if mode == "en" else "zh"
    segments, info = model.transcribe(input_path, language=language)
    full_text = ""

    if mode == "en":
        # 生成英文 SRT
        srt_path = output_path.replace(".txt", ".srt")
        with open(srt_path, "w", encoding="utf-8") as srt_file:
            for idx, segment in enumerate(segments, start=1):
                eng = segment.text.strip()
                full_text += eng + "\n"
                start = format_timestamp(segment.start)
                end = format_timestamp(segment.end)
                srt_file.write(f"{idx}\n")
                srt_file.write(f"{start} --> {end}\n")
                srt_file.write(f"{eng}\n\n")
        print(f"英文字幕已生成: {srt_path}")

    elif mode == "zh":
        # 生成中文字幕 TXT
        for segment in segments:
            full_text += segment.text.strip() + "\n"
        simplified_text = convert(full_text, "zh-cn")
        with open(output_path, "w", encoding="utf-8") as txt_file:
            txt_file.write(simplified_text)
        print(f"中文字幕已生成: {output_path}")

    elapsed_minutes = (time.time() - start_time) / 60
    rest_seconds = (int(elapsed_minutes // 10) + 1) * 60
    print(f"{input_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒。")
    time.sleep(rest_seconds)

# 批量递归处理目录
def transcribe_directory(model, folder_path, mode):
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
                video_path = os.path.join(root, file)
                output_path = os.path.splitext(video_path)[0] + ".txt"
                print(f"正在转录: {video_path}")
                transcribe_audio_file(model, video_path, output_path, mode)

# 入口函数
def cooking(input_path, whisper_model_name, mode):
    model = WhisperModel(whisper_model_name, compute_type="int8")

    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, mode)
    elif os.path.isfile(input_path):
        output_path = os.path.splitext(input_path)[0] + ".txt"
        print(f"{input_path}，正在转录...")
        transcribe_audio_file(model, input_path, output_path, mode)
    else:
        print(f"❌ 无效路径：{input_path}")

if __name__ == "__main__":
    input_path = '/Users/jiangsai/Downloads/幻影交易2024/Module 4 - OrderFlow/未命名文件夹'
    whisper_model_name = "medium"  # tiny / base / small / medium / large-v3
    mode = "en"  # 选择 "en"（只生成英文SRT）或 "zh"（只生成中文字幕TXT）
    cooking(input_path, whisper_model_name, mode)
