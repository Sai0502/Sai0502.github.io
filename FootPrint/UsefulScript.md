1. （新模型）语音转文字_模型whisper-ctranslate2

   > ```
   > pip install faster-whisper zhconv
   > // faster-whisper 是whisper-ctranslate2的Python 封装版
   > // zhconv 支持简繁体转换
   > ```
   >
   > * 本地音视频转文字
   >
   >   ```python
   >   import os
   >   import time
   >   from zhconv import convert
   >   from faster_whisper import WhisperModel
   >   
   >   # 处理单个音视频文件
   >   def transcribe_audio_file(model, input_path, output_path, language):
   >       start_time = time.time()  # 开始计时
   >   
   >       segments, info = model.transcribe(input_path, language=language)
   >       full_text = ""
   >       for segment in segments:
   >           full_text += segment.text + "\n"
   >   
   >       # zhconv 转换为简体中文
   >       simplified_text = convert(full_text, "zh-cn")
   >   
   >       # 保存到文件
   >       with open(output_path, "w") as f:
   >           f.write(simplified_text)
   >   
   >       end_time = time.time()
   >       elapsed_time = end_time - start_time
   >       elapsed_minutes = elapsed_time / 60
   >       rest_minutes = int(elapsed_minutes // 10) + 1
   >       rest_seconds = rest_minutes * 60
   >   
   >       print(f"{output_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒，避免CPU过热。")
   >       time.sleep(rest_seconds)
   >   
   >   # 批量处理文件夹
   >   def transcribe_directory(model, folder_path, language):
   >       for root, dirs, files in os.walk(folder_path):
   >           for file in files:
   >               if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
   >                   video_path = os.path.join(root, file)
   >                   output_path = os.path.splitext(video_path)[0] + ".txt"
   >                   print(f"正在转录: {video_path}")
   >                   transcribe_audio_file(model, video_path, output_path, language)
   >   
   >   # 入口函数
   >   def cooking(input_path, whisper_model_name):
   >       # "float16"（GPU），"int8"（CPU），"auto"（自动选用 GPU 或 CPU）
   >       model = WhisperModel(whisper_model_name, compute_type="int8")
   >   
   >       if os.path.isdir(input_path):
   >           transcribe_directory(model, input_path, language="zh")
   >       elif os.path.isfile(input_path):
   >           output_path = os.path.splitext(input_path)[0] + ".txt"
   >           print(f"{input_path}，正在转录....")
   >           transcribe_audio_file(model, input_path, output_path, language="zh")
   >       else:
   >           print(f"提供的路径无效：{input_path}")
   >   
   >   if __name__ == "__main__":
   >       input_path = '/Users/jiangsai/Downloads/mavnt011.mp3'
   >       whisper_model_name = "base"  # 可用: "tiny", "base", "small", "medium", "large-v3"
   >       cooking(input_path, whisper_model_name)
   >   ```

2. （废弃-原版的速度慢还占资源）OpenAI语音转文字_模型Whisper

   > [教程](https://github.com/openai/whisper)
   >
   > ```bash
   > pip3 install -U openai-whisper
   > // 会自动下载medium模型到 ~/.cache/whisper
   > cd /Users/jiangsai/Downloads
   > whisper audio.mp3 --model medium  //会默认生成json、srt、txt等等文件
   > ```
   >
   > * 本地视频/音频转文字
   >
   >   ```python
   >   import os
   >   import time
   >   import whisper
   >   from zhconv import convert
   >   
   >   # 处理单个音视频
   >   def transcribe_audio_file(model, input_path, output_path, language):
   >       start_time = time.time()  # 开始计时
   >   
   >       # 使用Whisper模型进行语音转文字
   >       result = model.transcribe(input_path, language=language)
   >       # 将转换后的文字从繁体中文转换为简体中文
   >       simplified_text = convert(result["text"], "zh-cn")
   >       # 将转换后的文字保存到文本文件中
   >       with open(output_path, "w") as f:
   >           f.write(simplified_text)
   >   
   >       end_time = time.time()  # 结束计时
   >       elapsed_time = end_time - start_time  # 花费秒数
   >       elapsed_minutes = elapsed_time / 60  # 花费分钟数
   >   
   >       # 计算休息时间：每10分钟对应休息60秒
   >       rest_minutes = int(elapsed_minutes // 10) + 1
   >       rest_seconds = rest_minutes * 60
   >   
   >       print(f"{output_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒，避免CPU过热。")
   >       time.sleep(rest_seconds)
   >   
   >   # 处理文件夹内的所有音视频
   >   def transcribe_directory(model, input_folder, language):
   >       # 获取指定文件夹内的所有视频文件
   >       video_files = [
   >           f for f in os.listdir(input_folder) if f.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi"))
   >       ]
   >   
   >       # 处理每个音视频
   >       for video_file in video_files:
   >           video_path = os.path.join(input_folder, video_file)
   >           transcription_path = os.path.join(input_folder, os.path.splitext(video_file)[0] + ".txt")
   >           print(f"{video_file}，正在转录....")
   >           transcribe_audio_file(model, video_path, transcription_path, language)
   >   
   >   def cooking(input_path, whisper_model):
   >       model = whisper.load_model(whisper_model)
   >       if os.path.isdir(input_path):
   >           transcribe_directory(model, input_path, language="zh")
   >       elif os.path.isfile(input_path):
   >           output_path = os.path.splitext(input_path)[0] + ".txt"
   >           print(f"{input_path}，正在转录....")
   >           transcribe_audio_file(model, input_path, output_path, language="zh")
   >       else:
   >           print(f"提供的路径无效：{input_path}")
   >   
   >   if __name__ == "__main__":
   >       # 要处理的目录或文件
   >       input_path = '/Users/jiangsai/Desktop/郭磊缠论'
   >       # 加载Whisper模型 "tiny", "base", "small", "medium", "large", "turbo"
   >       whisper_model = "turbo"
   >       cooking(input_path, whisper_model)
   >   ```
   >
   > * 本地视频加字幕
   >
   >   ```python
   >   # 安装 ffmpeg 和 translate-shell：brew install ffmpeg translate-shell（设置全局代理，博客搜“代理“）
   >   # 安装 openai-whisper：pip install openai-whisper
   >   import os
   >   import time
   >   import whisper
   >   import subprocess
   >       
   >   # 使用 translate-shell 将英文翻译成中文
   >   def translate_with_google(text):
   >       if not text.strip():
   >           return ""
   >       try:
   >           result = subprocess.run(
   >               ['trans', '-brief', ':zh', text],
   >               stdout=subprocess.PIPE,
   >               stderr=subprocess.DEVNULL,
   >               timeout=10,
   >               text=True
   >           )
   >           return result.stdout.strip()
   >       except Exception as e:
   >           print(f"[翻译失败] {text} → {e}")
   >           return "[翻译失败]"
   >       
   >   # 将秒数转换为 SRT 格式的时间戳（如 00:01:15,300）
   >   def format_timestamp(seconds):
   >       h = int(seconds // 3600)
   >       m = int((seconds % 3600) // 60)
   >       s = int(seconds % 60)
   >       ms = int((seconds - int(seconds)) * 1000)
   >       return f"{h:02}:{m:02}:{s:02},{ms:03}"
   >       
   >   # 处理单个音视频文件：转录 + 生成 .srt 双语字幕
   >   def transcribe_audio_file(model, input_path, output_path, language):
   >       start_time = time.time()
   >       
   >       # 使用 Whisper 转录音频
   >       result = model.transcribe(input_path, language=language)
   >       
   >       srt_path = output_path.replace(".txt", ".srt")
   >       
   >       with open(srt_path, "w", encoding="utf-8") as f:
   >           for idx, segment in enumerate(result["segments"], start=1):
   >               eng = segment["text"].strip()
   >               zh = translate_with_google(eng)
   >               start = format_timestamp(segment["start"])
   >               end = format_timestamp(segment["end"])
   >       
   >               f.write(f"{idx}\n")
   >               f.write(f"{start} --> {end}\n")
   >               f.write(f"{eng}\n")
   >               f.write(f"{zh}\n\n")
   >       
   >               time.sleep(0.5)  # 控制翻译速率，避免风控
   >       
   >       elapsed_minutes = (time.time() - start_time) / 60
   >       rest_seconds = (int(elapsed_minutes // 10) + 1) * 60
   >       
   >       print(f"{srt_path} 双语字幕生成完毕，用时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒防止过热。")
   >       time.sleep(rest_seconds)
   >       
   >   # 批量处理目录下所有音视频文件
   >   def transcribe_directory(model, input_folder, language):
   >       # 筛选支持的视频音频文件格式
   >       video_files = [
   >           f for f in os.listdir(input_folder)
   >           if f.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi"))
   >       ]
   >       
   >       for video_file in video_files:
   >           video_path = os.path.join(input_folder, video_file)
   >           txt_path = os.path.join(input_folder, os.path.splitext(video_file)[0] + ".txt")  # 用于生成 srt 文件名
   >           print(f"{video_file}，开始生成双语字幕...")
   >           transcribe_audio_file(model, video_path, txt_path, language)
   >       
   >   # 主控制函数：判断路径类型并调用对应处理逻辑
   >   def cooking(input_path, whisper_model):
   >       model = whisper.load_model(whisper_model)
   >       
   >       if os.path.isdir(input_path):
   >           transcribe_directory(model, input_path, language="en")
   >       elif os.path.isfile(input_path):
   >           output_path = os.path.splitext(input_path)[0] + ".txt"
   >           print(f"{input_path}，开始生成双语字幕...")
   >           transcribe_audio_file(model, input_path, output_path, language="en")
   >       else:
   >           print(f"❌ 无效路径：{input_path}")
   >       
   >   if __name__ == "__main__":
   >       # 输入路径：可以是单个视频，也可以是文件夹
   >       input_path = '/Users/jiangsai/Downloads/TTT/1 - Introduction to the Course and to Trading.mp4'
   >       # Whisper 模型：建议用 base 或 small，"turbo" 是非法模型名
   >       whisper_model = "base"
   >       cooking(input_path, whisper_model)
   >       
   >   ```
   >
   >   * 在线视频转文字
   >
   >   ```python
   >    python
   >     import subprocess  # 导入subprocess模块，用于执行系统命令
   >     import whisper  # 导入whisper模块，用于语音转文字
   >   
   >     # 定义YouTube视频的URL
   >       youtube_url = "https://www.youtube.com/watch?v=qZ3T5hunOuQ"
   >     # 定义输出的音频文件名
   >     output_audio = "audio.m4a"
   >   
   >     # 使用yt-dlp下载音频并提取为m4a格式，设置为低等品质
   >       # -f bestaudio: 选择最佳音频质量
   >     # --extract-audio: 只提取音频
   >     # --audio-format m4a: 转换音频为m4a格式
   >     # --audio-quality 2: 设置音频质量为低等，0最低，9最高
   >     # -o output_audio: 指定输出文件名为 output_audio
   >     subprocess.run(["yt-dlp", "-f", "bestaudio", "--extract-audio", "--audio-format", "m4a", "--audio-quality", "2", "-o", output_audio, youtube_url])
   >     
   >     # 加载Whisper模型
   >     # "base" 是模型的大小，可以根据需要选择 "tiny", "base", "small", "medium", "large"
   >     model = whisper.load_model("base")
   >     
   >     # 使用Whisper模型读取音频文件并进行语音转文字
   >     result = model.transcribe(output_audio)
   >     
   >     # 打印转换后的文字
   >     print(result["text"])
   >     
   >     # 将转换后的文字保存到文本文件中
   >     # with open("transcription.txt", "w") as f:
   >     #     f.write(result["text"])
   > ```

3. 微软文字转语音库

   > [教程](https://github.com/rany2/edge-tts)
   >
   > ```bash
   > //更新pip
   > pip install --upgrade pip
   > //安装依赖库
   > pip install cchardet
   > //安装edge-tts
   > pip3 install edge-tts
   > ```
   >
   > * 安装后测试
   >
   >   ```bash
   >   edge-tts --text "手机微信扫码登录，成功后按回车继续" --write-media 'test.mp3'
   >   ```
   >
   > * 转换指定文件
   >
   >   ```bash
   >   cd /Users/jiangsai/Desktop
   >   edge-tts -f "demo.txt" --write-media "demo.mp3"
   >   ```
   >
   > * 转换指定文件 - 使用指定语音
   >
   >   ```bash
   >   edge-tts --voice zh-CN-YunxiNeural -f "demo.txt" --write-media "demo.mp3"
   >   ```
   >
   > * 调整语速
   >
   >   ```bash
   >   //语速降低50%
   >   edge-tts --voice zh-CN-YunxiNeural --rate=-50% -f "demo.txt" --write-media "demo.mp3"
   >   //语速增加50%
   >   edge-tts --voice zh-CN-YunxiNeural --rate=+50% -f "demo.txt" --write-media "demo.mp3"
   >   ```
   >
   > * 调整音量
   >
   >   ```bash
   >   //音量降低30%
   >   edge-tts --voice zh-CN-YunxiNeural --rate=-50% --volume=-30% -f "demo.txt" --write-media "demo.mp3"
   >   //音量增加30%
   >   edge-tts --voice zh-CN-YunxiNeural --rate=+50% --volume=+30% -f "demo.txt" --write-media "demo.mp3"
   >   ```
   >
   > * 查看更多发音
   >
   >   ```bash
   >   (py3)  Sai  ~/Desktop ：edge-tts --list-voices
   >   Name: af-ZA-AdriNeural
   >   Gender: Female
   >   
   >   Name: af-ZA-WillemNeural
   >   Gender: Male
   >   ```
   >
   >   ```python
   >   import os
   >   
   >   Voice_List = [
   >       "en-AU-NatashaNeural",
   >       "en-AU-WilliamNeural",
   >       "en-IN-NeerjaExpressiveNeural",
   >       "en-IN-PrabhatNeural",
   >       "en-US-AnaNeural",
   >       "en-US-JennyNeural",
   >       "en-US-RogerNeural",
   >       "en-US-SteffanNeural",
   >       "zh-CN-XiaoxiaoNeural",
   >       "zh-CN-XiaoyiNeural",
   >       "zh-CN-YunjianNeural",
   >       "zh-CN-YunxiaNeural",
   >       "zh-CN-YunxiNeural",
   >       "zh-CN-YunyangNeural",
   >       "zh-HK-HiuGaaiNeural",
   >       "zh-HK-WanLungNeural",
   >       "zh-TW-HsiaoChenNeural",
   >       "zh-TW-YunJheNeural",
   >   ]
   >   
   >   folderPath = "/Users/jiangsai/Desktop/1"
   >   
   >   for Voice in Voice_List:
   >       Voice_Path = f"{folderPath}/{Voice}.mp3"
   >       cmd = f'edge-tts --text "手机微信扫码登录，成功后按回车继续，Our companies have a track record of becoming billion dollar companies." --voice {Voice} --write-media "{Voice_Path}"'
   >       print(cmd)
   >       os.system(cmd)
   >   ```
   >
   > * Python 文字转本地语音脚本
   >
   >   ```python
   >   import os
   >                               
   >   Voice = "zh-CN-YunjianNeural"
   >   Rate = "+0%"
   >   Volume = "+0%"
   >                               
   >   Handle_Folder = "/Users/jiangsai/Desktop/1"
   >                               
   >   # 转换目录内所有单个txt文件为单个mp3音频
   >   for Folder_Path, SonFolders, FileNames in os.walk(Handle_Folder):
   >       for FileName in FileNames:
   >           if FileName.endswith(".txt"):
   >               # 把 dirpath 和 每个文件名拼接起来 就是全路径
   >               FilePath = f"{Folder_Path}/{FileName}"
   >               mp3Name = FileName.replace(".txt", ".mp3")
   >               mp3Path = f"{Folder_Path}/{mp3Name}"
   >               cmd = f'edge-tts --voice {Voice} --rate={Rate} --volume={Volume} -f {FilePath} --write-media "{mp3Path}"'
   >               os.system(cmd)
   >   ```

4. 分割中英字幕脚本

   ```python
   import re
   
   text = """Excuse me. My name is Richard Stewart. 对不起，我叫Richard Stewart。
   I'm a photographer. 我是一位摄影师。"""
   
   # 使用正则表达式在每段中文的第一个汉字前面增加数字112
   result = re.sub(r"(^|[^\u4e00-\u9fff])([\u4e00-\u9fff])", r"\1 分割词 \2", text, count=1)
   result = re.sub(r"([。！？\n])([^\u4e00-\u9fff]*)([\u4e00-\u9fff])", r"\1\2 分割词 \3", result)
   
   print(result)
   ```

5. 获取目录下所有视频的时长

   ```python
   import os
   import subprocess
   import csv
   
   
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
   
   
   def generate_csv_file(directory, output_csv_path):
       """
       遍历目录，生成 CSV 文件
       """
       with open(output_csv_path, mode='w', newline='', encoding='utf-8-sig') as csv_file:
   
           csv_writer = csv.writer(csv_file)
           csv_writer.writerow(["Directory", "Video Name", "Duration (hh:mm:ss)", "Duration (seconds)"])
   
           previous_dir = None
           directory_total_duration = 0  # 当前目录总时长
   
           for root, _, files in sorted(os.walk(directory)):
               # 筛选出视频文件
               video_files = [file for file in files if file.lower().endswith(('.mp4', '.mkv', '.avi', '.mov'))]
               if not video_files:
                   continue
   
               # 当前目录的名称
               current_dir = os.path.basename(root) or "."
   
               # 如果切换到新的目录，输出上一个目录的总时长
               if previous_dir is not None and previous_dir != current_dir:
                   csv_writer.writerow([f"{previous_dir} (Total)", "", format_duration(directory_total_duration), directory_total_duration])
                   directory_total_duration = 0  # 重置总时长
   
               previous_dir = current_dir
   
               # 添加当前目录的视频信息
               for file in sorted(video_files):
                   file_path = os.path.join(root, file)
                   duration = get_video_duration(file_path)
                   directory_total_duration += duration
                   csv_writer.writerow([current_dir, file, format_duration(duration), duration])
   
           # 输出最后一个目录的总时长
           if previous_dir is not None:
               csv_writer.writerow([f"{previous_dir} (Total)", "", format_duration(directory_total_duration), directory_total_duration])
   
   
   if __name__ == "__main__":
       # 指定要扫描的目录
       directory_to_scan = "/Users/jiangsai/Downloads/精品班 PremumClass001"
       
       # 生成 Markdown 表格
       markdown_table = generate_markdown_table(directory_to_scan)
       
       # 输出 Markdown 表格到终端
       print(markdown_table)
       
       # 保存 Markdown 表格到文件
       markdown_output_path = os.path.join(directory_to_scan, "video_durations.md")
       with open(markdown_output_path, "w") as md_file:
           md_file.write(markdown_table)
       
       # 生成 CSV 文件
       csv_output_path = os.path.join(directory_to_scan, "video_durations.csv")
       generate_csv_file(directory_to_scan, csv_output_path)
   ```

6. 批量删除文件夹内所有视频的开头 x 秒，结尾 y 秒

   > ```python
   > import subprocess
   > import os
   > 
   > # 要处理的视频文件夹路径
   > video_folder = "/Users/jiangsai/Desktop/tt"
   > 
   > # 处理后的视频保存的文件夹
   > output_folder = "/Users/jiangsai/Desktop/ss"
   > if not os.path.exists(output_folder):
   >  os.makedirs(output_folder)
   > 
   > # 要删除的开头时长和结尾时长
   > start_duration = 24  # 开头时长
   > end_duration = 8  # 结尾时长
   > 
   > # 获取文件夹内所有的视频文件
   > videos = [f for f in os.listdir(video_folder) if f.endswith((".mp4", ".mkv", ".avi"))]
   > 
   > for video in videos:
   >  input_path = os.path.join(video_folder, video)
   >  output_path = os.path.join(output_folder, f"trimmed_{video}")
   > 
   >  # 获取视频总时长
   >  cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{input_path}"'
   >  total_duration = float(subprocess.check_output(cmd, shell=True).decode("utf-8").strip())
   > 
   >  # 计算裁剪后的视频长度
   >  trimmed_duration = total_duration - start_duration - end_duration
   > 
   >  # 使用ffmpeg命令行工具来裁剪视频
   >  cmd = f'ffmpeg -y -i "{input_path}" -ss {start_duration} -t {trimmed_duration} -c copy "{output_path}"'
   >  subprocess.call(cmd, shell=True)
   > 
   > print("所有视频处理完毕。")
   > ```

7. PDF转txt

   ```python
   import fitz, re  # PyMuPDF
   
   
   # PDF转txt
   def extract_and_clean_text(pdf_path):
       # Open the PDF file
       pdf_document = fitz.open(pdf_path)
       text = ""
       # Iterate through each page
       for page_num in range(len(pdf_document)):
           page = pdf_document.load_page(page_num)
           # Extract text from the page
           page_text = page.get_text("text")
           if "645 楼" in page_text:
               pass
           # 处理段落
           page_text = clean_text(page_text)
           # Clean text by removing extra whitespace and newlines
           text += page_text + "\n"
       return text.strip()
   
   
   # 处理字符串：、删除空行、、删除「---」
   def clean_text(text):
       # 删除 「@熊熊 chn 2016-03-25 16:05:01」这种字符
       text = re.sub(r"@\S.*?\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", "", text)
       # 删除「@刮西北风2017-08-19」
       text = re.sub(r"@\S+\d{4}-\d{2}-\d{2}", "", text)
       # 删除 「作者:冻云迷雾」这类字符
       text = re.sub(r"作者:\S+", "", text)
       text = re.sub(r"楼主:\S+", "", text)
       # 删除 「日期:2014-05-01」这类字符
       text = re.sub(r"日期:\d{4}-\d{2}-\d{2}", "", text)
       # 删除 「[img]http://img3.xxx.cn/xxx.png[/img]」「http://news\.xxx\.com\.xxx.shtml」
       text = re.sub(r"\[img\]\S+\[/img\]", "", text)
       text = re.sub(r"http\S+", "", text)
       # 删除多个连字符"-"
       text = re.sub(r"-{2,}", "", text)
       # 删除空格
       text = text.replace(" ", "")
       # 删除 自来 xxx楼
       text = re.sub(r"来自\n\d+楼", "", text)
       # 删除 \n
       text = text.replace("\n", "")
       # 删除每行前面的数字
       # text = re.sub(r"^\d+", "", text, flags=re.MULTILINE)
       return text
   
   
   # 待处理PDF文件路径
   pdf_path = "/Users/jiangsai/Downloads/天涯全集/208-虚拟货币的秘密，兼谈比特币的未来和各国的战略布局.pdf"
   final_text = extract_and_clean_text(pdf_path)
   
   # 保存到txt文件
   output_txt_path = "/Users/jiangsai/Desktop/1.txt"
   with open(output_txt_path, "w", encoding="utf-8") as txt_file:
       txt_file.write(final_text)
   
   ```

8. 定时提醒

   1. 每15分钟提醒1次

      > ```python
      > # 时间为15的倍数时铃声提醒 1:15,1:30,1:45
      > import time
      > import os
      > 
      > def play_audio():
      >     # 使用 afplay 播放音频
      >     os.system('afplay /Users/sai/Downloads/冥想-运动/叮咚.MP3') 
      > 
      > while True:
      >     current_time = time.localtime()
      >     minutes = current_time.tm_min
      > 
      >     if minutes % 15 == 0:
      >         print(f"当前时间: {time.strftime('%H:%M', current_time)} - 播放音频")
      >         play_audio()
      >         time.sleep(60)
      > 
      >     time.sleep(1)
      > ```
      >
      > * 更换系统音效
      >
      >   > macOS 内置音效路径是：`/System/Library/Sounds/`
      >   >
      >   > 可改成：`afplay /System/Library/Sounds/Ping.aiff`
      >   >
      >   > 改成任一音频：`subprocess.run(["afplay", " ~/Desktop/提示音.mp3"])`

   2. 每5分钟提醒1次，并做出桌面图标

      > ```python
      > import time
      > import subprocess
      > from datetime import datetime
      > 
      > def send_notification(title, message):
      >  subprocess.run([
      >      "osascript", "-e",
      >      f'display notification "{message}" with title "{title}"'
      >  ])
      > def play_system_sound():
      >  # 播放系统提示音（Sosumi）
      >  subprocess.run([
      >      "afplay", "/System/Library/Sounds/Sosumi.aiff"
      >  ])
      > 
      > def next_5_minute():
      >  now = datetime.now()
      >  # 计算当前时间到下一个5分钟倍数的时间
      >  minutes_to_next_5 = 5 - now.minute % 5
      >  seconds_to_next_5 = minutes_to_next_5 * 60 - now.second
      >  return seconds_to_next_5
      > 
      > while True:
      >  # 计算到下一个5分钟倍数的时间
      >  wait_time = next_5_minute()
      >  time.sleep(wait_time)
      >  play_system_sound()
      >  send_notification("5分钟了", "看一眼盘面")
      >  # 等待到下一个5分钟倍数
      >  time.sleep(30)
      > ```
      >
      > ![image-20250409161602383](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20250409161602383.png)
      >
      > 1. 打开 **Automator** → **新建文稿** → 选择 **应用程序** → 左侧搜索框输入 `Shell`，双击「运行 Shell 脚本」 → 替换默认内容：`python3 ~/Desktop/reminder.py` 
      >
      >    > 如果报错可以指定Python版本
      >    >
      >    > ```bash
      >    > which python3
      >    > /opt/anaconda3/bin/python3
      >    > ```
      >    >
      >    > 「 Shell 脚本」 替换成
      >    >
      >    > `/opt/anaconda3/bin/python3 ~/Desktop/reminder.py`
      >
      > 2. 点击左上角「文件」→「存储」，保存到桌面，比如叫 `5分钟提醒.app`
      >
      > 3. 双击这个 `.app`，它就会启动你的提醒程序了
      >
      > **杀掉程序**
      >
      > * **活动监视器**：搜索框输：`python`

   3. 看盘提醒

      > 用法：用`reminder.command`控制`reminder.py`，双击`.command` 来开关程序
      >
      > 1. `reminder.py`
      >
      >    ```python
      >    # 参数1：python reminder.py 1 每隔半小时语音报时 
      >    # 参数2：python reminder.py 2 每隔5分钟铃声提醒 + 每隔半小时语音报时 
      >    # 参数3：python reminder.py 3 每隔3分钟铃声提醒 + 每隔15分钟语音报时
      >    import os
      >    import sys
      >    import subprocess
      >    import time
      >    from datetime import datetime
      >    import asyncio
      >             
      >    # 中文数字映射
      >    chinese_nums = {
      >     0: '零', 1: '一', 2: '二', 3: '三', 4: '四',
      >     5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十'
      >    }
      >             
      >    def num_to_chinese(n):
      >     if n < 10:
      >         return chinese_nums[n]
      >     elif n == 10:
      >         return '十'
      >     elif n < 20:
      >         return '十' + chinese_nums[n % 10]
      >     else:
      >         return chinese_nums[n // 10] + '十' + (chinese_nums[n % 10] if n % 10 != 0 else '')
      >             
      >    def get_chinese_time():
      >     now = datetime.now()
      >     hour_ch = num_to_chinese(now.hour)
      >     minute_ch = num_to_chinese(now.minute) if now.minute != 0 else '整'
      >     return f"{hour_ch}点{minute_ch}"
      >             
      >    async def speak(text):
      >     from edge_tts import Communicate
      >     communicate = Communicate(text, voice="zh-CN-XiaoxiaoNeural")
      >     await communicate.save("output.mp3")
      >     os.system("afplay output.mp3")
      >             
      >    def send_notification(title, message):
      >     subprocess.run([
      >         "osascript", "-e",
      >         f'display notification "{message}" with title "{title}"'
      >     ])
      >             
      >    def play_system_sound():
      >     subprocess.run(["afplay", "/System/Library/Sounds/Sosumi.aiff"])
      >             
      >    def main_loop(mode):
      >     already_triggered = None
      >     while True:
      >         now = datetime.now()
      >         key = f"{now.hour}:{now.minute}"
      >         if now.second == 0 and key != already_triggered:
      >             minute = now.minute
      >             
      >             # 模式 1：F30（整点和半点播报时间）
      >             if mode == "1":
      >                 if minute in [0, 30]:
      >                     ch_time = get_chinese_time()
      >                     asyncio.run(speak(f"{ch_time}"))
      >             
      >             # 模式 2：F5（每5分钟提示，整点和半点语音）
      >             elif mode == "2":
      >                 if minute in [0, 30]:
      >                     ch_time = get_chinese_time()
      >                     asyncio.run(speak(f"{ch_time}"))
      >                 elif minute % 5 == 0:
      >                     play_system_sound()
      >                     send_notification("5分钟了", "看一眼盘面")
      >             
      >             # 模式 3：F15+F3（15/30/45/整点播报，其余每3分钟提醒）
      >             elif mode == "3":
      >                 if minute in [0, 15, 30, 45]:
      >                     ch_time = get_chinese_time()
      >                     asyncio.run(speak(f"{ch_time}"))
      >                 elif minute % 3 == 0 and minute not in [0, 15, 30, 45]:
      >                     play_system_sound()
      >                     send_notification("3分钟了", "盯一下盘面")
      >             
      >             already_triggered = key
      >         time.sleep(1)
      >    
      >    
      >    
      >    if __name__ == "__main__":
      >     if len(sys.argv) != 2 or sys.argv[1] not in ["1", "2", "3"]:
      >         send_notification("运行参数错误", "用法：python reminder.py 1 或 2 或 3")
      >         asyncio.run(speak("参数错误，参数只能是一、二或三"))
      >         sys.exit(1)
      >    
      >     mode = sys.argv[1]
      >     main_loop(mode)
      >
      > 2. `reminder.command`
      >
      >    ```bash
      >    #!/bin/bash
      >             
      >    LOCK_FILE="$HOME/.reminder.lock"
      >    SCRIPT_PATH="$HOME/Downloads/Python脚本/reminder.py"
      >             
      >    # 如果锁文件存在，读取其中的 PID
      >    if [ -f "$LOCK_FILE" ]; then
      >        OLD_PID=$(cat "$LOCK_FILE")
      >             
      >        # 检查该 PID 是否仍在运行且是我们这个脚本
      >        if ps -p "$OLD_PID" > /dev/null && ps -p "$OLD_PID" -o args= | grep -q "$SCRIPT_PATH"; then
      >            # 是在运行中，关闭它
      >            kill "$OLD_PID"
      >            rm -f "$LOCK_FILE"
      >            osascript -e 'display notification "程序已关闭" with title "提醒助手"'
      >            exit 0
      >        else
      >            # PID 不存在或不是我们的脚本，移除锁文件
      >            rm -f "$LOCK_FILE"
      >        fi
      >    fi
      >             
      >    # 启动脚本（后台），保存 PID
      >    /opt/anaconda3/bin/python3 "$SCRIPT_PATH" 2 &
      >    NEW_PID=$!
      >    echo "$NEW_PID" > "$LOCK_FILE"
      >    osascript -e 'display notification "程序已启动" with title "提醒助手"'
      >             
      >    exit 0
      >    ```

9. 监控币安的币价，达到某个价格区域时，邮件提醒

   > ```python
   > import requests, time, smtplib, datetime
   > from email.mime.text import MIMEText
   > from email.mime.multipart import MIMEMultipart
   > 
   > # 邮件发送函数
   > def send_mail(subject, body, to_email):
   >     # 邮件服务器配置
   >     from_email = "jiangsai0502@gmail.com" # 发件人邮箱
   >     # 1. 开启两步验证
   >     # 2. 在https://myaccount.google.com/u/6/apppasswords?gar=1，创建一个应用特定密码
   >     from_email_password = "ygms zuth hmyd rgsm"
   >     mail_server = "smtp.gmail.com"  # 发件人邮箱SMTP服务器地址
   >     mail_port = 587  # SMTP端口
   >     
   >     # 构造邮件内容
   >     msg = MIMEMultipart()
   >     msg["From"] = from_email
   >     msg["To"] = to_email
   >     msg["Subject"] = subject
   >     msg.attach(MIMEText(body, "plain"))
   > 
   >     try:
   >         server = smtplib.SMTP(mail_server, mail_port)
   >         server.starttls()
   >         server.login(from_email, from_email_password)
   >         server.sendmail(from_email, to_email, msg.as_string())
   >         server.quit()
   >         print("✅ 邮件已发送！")
   >     except Exception as e:
   >         print(f"❌ 发送邮件出错：{e}")
   > 
   > # 获取加密货币价格
   > def get_crypto_price(symbol):
   >     url = "https://api.binance.com/api/v3/ticker/price"
   >     params = {"symbol": symbol}
   >     try:
   >         response = requests.get(url, params=params, timeout=5)
   >         if response.status_code == 200:
   >             data = response.json()
   >             return float(data["price"])
   >     except Exception as e:
   >         print(f"获取 {symbol} 价格失败：{e}")
   >     return None
   > 
   > # 判断是否是整点或半点
   > def is_summary_time():
   >     now = datetime.datetime.now()
   >     # return now.minute in [0, 30] and now.second < 10  # 前10秒内触发
   >     return now.minute % 5 == 0 and now.second < 10  # 测试每5分钟发一次，前10秒内触发
   > 
   > # 主循环
   > def monitor_crypto():
   >     crypto_symbols = {
   >         "BTCUSDT": {"min_price": 25000, "max_price": 130000},
   >         "ETHUSDT": {"min_price": 1800, "max_price": 3000}
   >     }
   > 
   >     to_email = "jiangsai0502@outlook.com"
   > 
   >     # 初始化状态缓存
   >     hit_count = {symbol: 0 for symbol in crypto_symbols}
   >     triggered = set()
   >     last_summary_minute = -1  # 避免一分钟内重复发邮件
   > 
   >     while True:
   >         now = datetime.datetime.now()
   > 
   >         for symbol, price_range in crypto_symbols.items():
   >             price = get_crypto_price(symbol)
   >             if price is None:
   >                 continue
   > 
   >             in_range = price_range["min_price"] <= price <= price_range["max_price"]
   > 
   >             if in_range:
   >                 hit_count[symbol] += 1
   >                 if hit_count[symbol] >= 15:
   >                     triggered.add(symbol)
   >             else:
   >                 hit_count[symbol] = 0  # 一旦脱离区间就清零
   > 
   >         # 整点/半点并且触发币种非空，且不是刚发过邮件
   >         if is_summary_time():
   >             current_minute = now.minute
   >             if triggered and current_minute != last_summary_minute:
   >                 body = "以下币种在过去检测中满足价格条件：\n\n"
   >                 for symbol in triggered:
   >                     body += f"- {symbol}: 当前价格为 {get_crypto_price(symbol)}，超过15次在目标范围内\n"
   >                 subject = f"📈 加密货币价格提醒（{now.strftime('%H:%M')}）"
   >                 print(f"当前时间：{now.strftime('%H:%M')}")
   >                 print(f"邮件内容：\n{body}")
   >                 send_mail(subject, body, to_email)
   >                 triggered.clear()
   >                 hit_count = {symbol: 0 for symbol in crypto_symbols}
   >                 last_summary_minute = current_minute
   > 
   >         time.sleep(2)  # 每10秒检测一次
   > 
   > # 主函数入口
   > if __name__ == "__main__":
   >     monitor_crypto()
   > ```
   >

10. 番茄钟

   > 用法：用`pomodoro.command`控制`pomodoro.py`
   >
   > 1. 提前用Preview打开一个图片，且放在桌面上，不能最小化
   >
   > 2. `pomodoro.py`
   >
   >    ```python
   >    # 功能：番茄钟 + 朗读 + 切换并全屏 Preview
   >    import asyncio
   >    import subprocess
   >    import os
   >    from edge_tts import Communicate
   >    
   >    # 🗣️ 朗读文本函数
   >    async def speak(text):
   >        communicate = Communicate(text, voice="zh-CN-XiaoxiaoNeural")
   >        await communicate.save("output.mp3")
   >        os.system("afplay output.mp3")
   >    
   >    # 🍅 切换并全屏 Preview
   >    def activate_and_fullscreen_preview():
   >        applescript = '''
   >        tell application "Preview"
   >            activate
   >        end tell
   >        delay 1
   >        tell application "System Events"
   >            keystroke "f" using {control down, command down}
   >        end tell
   >        '''
   >        subprocess.run(["osascript", "-e", applescript])
   >    
   >    # 🔁 主循环逻辑封装成 async
   >    async def pomodoro_loop():
   >        try:
   >            while True:
   >                print("🍅 开始专注：25分钟")
   >                await asyncio.sleep(10)
   >                # await asyncio.sleep(25 * 60)
   >                await speak("休息一下吧")
   >                activate_and_fullscreen_preview()
   >    
   >                print("😌 休息中：10分钟")
   >                await asyncio.sleep(5)
   >                # await asyncio.sleep(10 * 60)
   >                await speak("开始干活吧")
   >                activate_and_fullscreen_preview()
   >        except asyncio.CancelledError:
   >            print("番茄钟已被中止。")
   >    
   >    # 👇 顶层事件循环入口
   >    if __name__ == "__main__":
   >        asyncio.run(pomodoro_loop())
   >    ```
   >
   > 3. `pomodoro.command`
   >
   >    ```bash
   >    #!/bin/bash
   >    
   >    LOCK_FILE="$HOME/.pomodoro.lock"
   >    SCRIPT_PATH="$HOME/Downloads/Python脚本/pomodoro.py"
   >    
   >    # 如果锁文件存在，读取其中的 PID
   >    if [ -f "$LOCK_FILE" ]; then
   >        OLD_PID=$(cat "$LOCK_FILE")
   >    
   >        # 检查该 PID 是否仍在运行且是我们这个脚本
   >        if ps -p "$OLD_PID" > /dev/null && ps -p "$OLD_PID" -o args= | grep -q "$SCRIPT_PATH"; then
   >            # 是在运行中，关闭它
   >            kill "$OLD_PID"
   >            rm -f "$LOCK_FILE"
   >            osascript -e 'display notification "关闭番茄钟" with title "提醒助手"'
   >            exit 0
   >        else
   >            # PID 不存在或不是我们的脚本，移除锁文件
   >            rm -f "$LOCK_FILE"
   >        fi
   >    fi
   >    
   >    # 启动脚本（后台），保存 PID
   >    /opt/anaconda3/bin/python3 "$SCRIPT_PATH" >> "$HOME/Desktop/pomodoro.log" 2>&1 &
   >    NEW_PID=$!
   >    echo "$NEW_PID" > "$LOCK_FILE"
   >    osascript -e 'display notification "开启番茄钟" with title "提醒助手"'
   >    ```
   >
   > 4. 授权终端Terminal权限
   >
   >    > 系统偏好设置 → 隐私与安全性 → 辅助功能 → 添加【终端Terminal】
   >
   > 

   