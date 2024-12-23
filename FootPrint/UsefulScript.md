1. OpenAI语音转文字模型Whisper

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
   >   import whisper
   >   from zhconv import convert
   >   
   >   # 处理单个音视频
   >   def transcribe_audio_file(model, input_path, output_path, language):
   >       # 使用Whisper模型进行语音转文字
   >       result = model.transcribe(input_path, language=language)
   >       # 将转换后的文字从繁体中文转换为简体中文
   >       simplified_text = convert(result["text"], "zh-cn")
   >       # 将转换后的文字保存到文本文件中
   >       with open(output_path, "w") as f:
   >           f.write(simplified_text)
   >       print(f"{output_path} 转录完成")
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
   >       # 加载Whisper模型 "tiny", "base", "small", "medium", "large", "turbo"
   >       # 使用时会自动下载到~/.cache/whisper
   >       input_path = "/Users/jiangsai/Downloads/【第47期】怎么数K线.mp4"
   >       whisper_model = "turbo"
   >       cooking(input_path, whisper_model)
   >   ```
   >
   > * 在线视频转文字
   >
   >   ```python
   >   python
   >     import subprocess  # 导入subprocess模块，用于执行系统命令
   >     import whisper  # 导入whisper模块，用于语音转文字
   >       
   >     # 定义YouTube视频的URL
   >     youtube_url = "https://www.youtube.com/watch?v=qZ3T5hunOuQ"
   >     # 定义输出的音频文件名
   >     output_audio = "audio.m4a"
   >       
   >     # 使用yt-dlp下载音频并提取为m4a格式，设置为低等品质
   >     # -f bestaudio: 选择最佳音频质量
   >     # --extract-audio: 只提取音频
   >     # --audio-format m4a: 转换音频为m4a格式
   >     # --audio-quality 2: 设置音频质量为低等，0最低，9最高
   >     # -o output_audio: 指定输出文件名为 output_audio
   >     subprocess.run(
   >         [
   >             "yt-dlp",
   >             "-f",
   >             "bestaudio",
   >             "--extract-audio",
   >             "--audio-format",
   >             "m4a",
   >             "--audio-quality",
   >             "2",
   >             "-o",
   >             output_audio,
   >             youtube_url,
   >         ]
   >     )
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
   >   ```

2. 微软文字转语音库

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

3. 分割中英字幕脚本

   ```python
   import re
   
   text = """Excuse me. My name is Richard Stewart. 对不起，我叫Richard Stewart。
   I'm a photographer. 我是一位摄影师。"""
   
   # 使用正则表达式在每段中文的第一个汉字前面增加数字112
   result = re.sub(r"(^|[^\u4e00-\u9fff])([\u4e00-\u9fff])", r"\1 分割词 \2", text, count=1)
   result = re.sub(r"([。！？\n])([^\u4e00-\u9fff]*)([\u4e00-\u9fff])", r"\1\2 分割词 \3", result)
   
   print(result)
   ```

4. 获取目录下所有视频的时长

   ```python
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
       directory_to_scan = "/Users/jiangsai/Desktop/熊猫/01-初中课"
       
       # 生成 Markdown 表格
       markdown_table = generate_markdown_table(directory_to_scan)
       
       # 输出表格到终端
       print(markdown_table)
       
       # 保存到文件
       with open("video_durations.md", "w") as md_file:
           md_file.write(markdown_table)
   ```

   >| Video Name                       | Duration     |
   >| -------------------------------- | ------------ |
   >| **00-课前说明&学习资料 (Total)** | **00:45:10** |
   >| 01-课前说明.mp4                  | 00:15:33     |
   >| 02-怎么学习历史课和直播课.mp4    | 00:05:26     |
   >| **01-认知篇 (Total)**            | **13:18:02** |
   >| 01-课前说明.mp4                  | 01:51:10     |
   >| 02-普通人能不能通过交易赚钱.mp4  | 01:29:28     |

5. 批量删除文件夹内所有视频的开头 x 秒，结尾 y 秒

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

6. PDF转txt

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

7. 定时提醒

   ```python
   # 时间为15的倍数时铃声提醒 1:15,1:30,1:45
   import time
   import os
   
   def play_audio():
       # 使用 afplay 播放音频
       os.system('afplay /Users/sai/Downloads/冥想-运动/叮咚.MP3') 
   
   while True:
       current_time = time.localtime()
       minutes = current_time.tm_min
   
       if minutes % 15 == 0:
           print(f"当前时间: {time.strftime('%H:%M', current_time)} - 播放音频")
           play_audio()
           time.sleep(60)
   
       time.sleep(1)
   ```

   