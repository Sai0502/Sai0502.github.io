import os
import time
import whisper
from zhconv import convert

# 处理单个音视频
def transcribe_audio_file(model, input_path, output_path, language):
    start_time = time.time()  # 开始计时

    # 使用Whisper模型进行语音转文字
    result = model.transcribe(input_path, language=language)
    # 将转换后的文字从繁体中文转换为简体中文
    simplified_text = convert(result["text"], "zh-cn")
    # 将转换后的文字保存到文本文件中
    with open(output_path, "w") as f:
        f.write(simplified_text)

    end_time = time.time()  # 结束计时
    elapsed_time = end_time - start_time  # 花费秒数
    elapsed_minutes = elapsed_time / 60  # 花费分钟数

    # 计算休息时间：每10分钟对应休息60秒
    rest_minutes = int(elapsed_minutes // 10) + 1
    rest_seconds = rest_minutes * 60

    print(f"{output_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒，避免CPU过热。")
    time.sleep(rest_seconds)

# # 处理文件夹内的所有音视频
# def transcribe_directory(model, input_folder, language):
#     # 获取指定文件夹内的所有视频文件
#     video_files = [
#         f for f in os.listdir(input_folder) if f.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi"))
#     ]

#     # 处理每个音视频
#     for video_file in video_files:
#         video_path = os.path.join(input_folder, video_file)
#         transcription_path = os.path.join(input_folder, os.path.splitext(video_file)[0] + ".txt")
#         print(f"{video_file}，正在转录....")
#         transcribe_audio_file(model, video_path, transcription_path, language)
# 递归处理文件夹中的所有音视频文件
def transcribe_directory(model, folder_path, language):
    for root, dirs, files in os.walk(folder_path):  # 递归遍历
        for file in files:
            if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
                video_path = os.path.join(root, file)
                output_path = os.path.splitext(video_path)[0] + ".txt"
                print(f"正在转录: {video_path}")
                transcribe_audio_file(model, video_path, output_path, language)

def cooking(input_path, whisper_model):
    model = whisper.load_model(whisper_model)
    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, language="zh")  # zh 中文 en 英文
    elif os.path.isfile(input_path):
        output_path = os.path.splitext(input_path)[0] + ".txt"
        print(f"{input_path}，正在转录....")
        transcribe_audio_file(model, input_path, output_path, language="zh")  # zh 中文 en 英文
    else:
        print(f"提供的路径无效：{input_path}")

if __name__ == "__main__":
    # 要处理的目录或文件
    input_path = '/Users/jiangsai/Downloads/萌芽班 Beginner  Class/Trading Hub 3.0 - 第1期特训营'
    # 加载Whisper模型 "tiny", "base", "small", "medium", "large", "turbo"
    whisper_model = "base"
    cooking(input_path, whisper_model)
