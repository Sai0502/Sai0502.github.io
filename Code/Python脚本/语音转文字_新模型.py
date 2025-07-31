import os
import time
from zhconv import convert
from faster_whisper import WhisperModel

# 处理单个音视频文件
def transcribe_audio_file(model, input_path, output_path, language):
    start_time = time.time()  # 开始计时

    segments, info = model.transcribe(input_path, language=language)
    full_text = ""
    for segment in segments:
        full_text += segment.text + "\n"

    # zhconv 转换为简体中文
    simplified_text = convert(full_text, "zh-cn")

    # 保存到文件
    with open(output_path, "w") as f:
        f.write(simplified_text)

    end_time = time.time()
    elapsed_time = end_time - start_time
    elapsed_minutes = elapsed_time / 60
    rest_minutes = int(elapsed_minutes // 10) + 1
    rest_seconds = rest_minutes * 60

    print(f"{output_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒，避免CPU过热。")
    time.sleep(rest_seconds)

# 批量处理文件夹
def transcribe_directory(model, folder_path, language):
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
                video_path = os.path.join(root, file)
                output_path = os.path.splitext(video_path)[0] + ".txt"
                print(f"正在转录: {video_path}")
                transcribe_audio_file(model, video_path, output_path, language)

# 入口函数
def cooking(input_path, whisper_model_name):
    # "float16"（GPU），"int8"（CPU），"auto"（自动选用 GPU 或 CPU）
    model = WhisperModel(whisper_model_name, compute_type="int8")

    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, language="zh")
    elif os.path.isfile(input_path):
        output_path = os.path.splitext(input_path)[0] + ".txt"
        print(f"{input_path}，正在转录....")
        transcribe_audio_file(model, input_path, output_path, language="zh")
    else:
        print(f"提供的路径无效：{input_path}")

if __name__ == "__main__":
    input_path = '/Users/jiangsai/Downloads/mavnt011.mp3'
    whisper_model_name = "base"  # 可用: "tiny", "base", "small", "medium", "large-v3"
    cooking(input_path, whisper_model_name)
