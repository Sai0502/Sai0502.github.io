### [声音克隆](https://www.yuque.com/baicaigongchang1145haoyuangong/ib3g1e/znoph9dtetg437xb)

1. [一键安装包](https://www.icloud.com/iclouddrive/00f6r6VvLE8WLDUDCCfH7ciGw#GPT-SoVITS)

2. [安装教程](https://www.bilibili.com/video/BV1Cf421m7Ft)

3. 初始化程序：终端运行 `bash 空格 拖入install for mac.sh`

4. 更新：双击`update.command`

5. 启动webUI：双击`go-webui.command`
   1. 打开 `http://localhost:9874/`

6. 训练集处理
   1. 如果数据集有背景音乐或者混响
      1. 在 `0-前置数据集获取工貝` ，`Oa-UVR5人声伴奏分离&去混响去延迟工貝` 点击 `开启 UVR5 webUl`
      2. 打开 `http://localhost:9873/`
         1. 模型：`VR-DeEchoDeReverb`
         2. 输入待处理音频文件夹路径：`/Users/jiangsai/Downloads/十年一梦`
         3. 导出文件格式：`wav`
      3. 转换结果在：`……/GPT-SoVITS/output/uvr5_opt`
      4. 删除结果里的纯音乐文件：`instrument`开头的文件
   2. 切分音频
      1. 在 `0-前置数据集获取工貝` ，`0b-语音切分工貝` ，`音频自动切分输入路径，可文件可文件夹` 粘贴 `/Users/jiangsai/Desktop/GPT-SoVITS/output/uvr5_opt`
      2. 点击`开启语音切割`
      3. 切割结果在：`/GPT-SoVITS/output/slicer_opt`
   3. 音频降噪（有噪音再处理）
      1. 各选项的路径默认不变，点击 `开启语音降噪`
   4. oc-中文批量离线ASR工具
      1. 各选项的路径默认不变，点击 `开启离线批量ASR`
      2. 输出结果在：`ASR 任务完成->标注文件路径: ……/GPT-SoVITS/output/asr_opt/slicer_opt.list`
   5. od-语音文本校对标注工具
      1. 各选项的路径默认不变，点击 `开启打标WebUI`
      2. 打开 `http://localhost:9871/`，进行手工校对
         1. 有错误就更改，然后点击 `Submit Text`
         2. 没有错误就不动
         3. 点击 `Next Index` 翻页继续校对
      3. 校对完成后，关闭 `http://localhost:9871/`，回到 `http://localhost:9874/`，点击 `关闭打标WebUI`

7. 数据格式化
   1. 进入 `1-GPT-SOVITS-TTS`
      1. 实验/模型名：`JS_test`
      2. 其余默认
   2. 在 `1A-训练集格式化工貝`
      1. 文本标注文件、训练集音频文件目录都默认
   3. 在 `1Aa-文本内容`
      1. 点击 `开启文本获取`，等待终端完成
   4. 在 `1Ab-SSL自监督特征提取`
      1. 点击 `开启SSL提取`，等待终端完成
   5. 在 `1AC-语义token提取`
      1. 点击 `开启语义token提取`，等待终端完成

8. 训练
   1. 进入 `1B- 微调训练`
   2. 点击 `开启SoVITS训练`，等待终端完成
   3. 点击 `开启GFT训练`，等待终端完成

9. webUI推理
   1. 进入 `1C-推理`
   2. 勾选 `启用并行推理版本(推理速度更快）`
   3. 点击 `开启TTS推理WebUI`
   4. 打开 `http://localhost:9872/`
      1. GPT模型列表：`GPT_weights_v2/JS_test-e5.ckpt`
      2. SoVITS模型列表：`SoVITS_weights_v2/JS_test_e4_s80.pth`
      3. 请上传并填写参考信息：`/GPT-SoVITS/output/slicer_opt`（任选一个）
      4. 开启无参考文本模式。不填参考文本亦相当于开启：`不勾选`
      5. 需要合成的文本：要语音转文字的内容

10. API推理

    1. 启动服务

       ```bash
       cd GPT-SoVITS
       conda activate GPTSoVits
       python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
       ```

       > 其中要调用的模型类型可以在……GPT-SoVITS/GPT_SoVITS/configs/tts_infer.yaml中修改
       >
       > ```bash
       > custom:
       >   bert_base_path: GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large
       >   cnhuhbert_base_path: GPT_SoVITS/pretrained_models/chinese-hubert-base
       >   device: cpu
       >   is_half: false
       >   t2s_weights_path: GPT_weights_v2/JS_test-e5.ckpt（这里）
       >   version: v2
       >   vits_weights_path: SoVITS_weights_v2/JS_test_e4_s80.pth（这里）
       > ```

       > 保持启动服务的终端不被关闭

    2. Python程序

       ```python
       import sys
       import os
       from pydub import AudioSegment
       from PyQt5.QtWidgets import (
           QApplication,
           QWidget,
           QVBoxLayout,
           QTextEdit,
           QPushButton,
           QLabel,
           QHBoxLayout,
           QFileDialog,
       )
       from PyQt5.QtCore import pyqtSlot, QThread, pyqtSignal
       from PyQt5.QtGui import QFont
       import requests
       
       # 获取用户的桌面路径
       desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
       # 生成完整的文件路径
       OUTPUT_FILE = os.path.join(desktop_path, "output.mp3")
       
       MAX_SEGMENT_LENGTH = 20  # 设置每个文本段的最大长度
       
       def call_gpt_sovits(text):
           api_url = "http://127.0.0.1:9880/tts"
           data = {
               "text": text,  # 要合成的文本
               "text_lang": "zh",  # 文本语言
               "ref_audio_path": "/Users/jiangsai/Downloads/GPT-SoVITS/output/slicer_opt/十年一梦.wav",  # 参考音频路径
               "prompt_text": "经历过一场艰难岁月时期的操盘手，我的内心无疑充满了激动和兴奋",  # 参考文本
               "prompt_lang": "zh"  # 参考文本语言
           }
           response = requests.post(api_url, json=data)
           if response.status_code == 200:
               return response.content
           else:
               print(f"请求失败，状态码：{response.status_code}")
               print("响应内容：", response.text)
               return b''
       
       class TTSWorker(QThread):
           finished = pyqtSignal(str)
           progress = pyqtSignal(int, int)  # 进度信号
       
           def __init__(self, text):
               super().__init__()
               self.text = text
       
           def run(self):
               segments = [self.text[i : i + MAX_SEGMENT_LENGTH] for i in range(0, len(self.text), MAX_SEGMENT_LENGTH)]
               temp_files = []
               total_segments = len(segments)
               for i, segment in enumerate(segments):
                   if segment.strip():  # 处理非空段落
                       self.progress.emit(i + 1, total_segments)  # 发送进度信号
                       segment_audio = call_gpt_sovits(segment)
                       if segment_audio:
                           temp_file = os.path.join(desktop_path, f"temp_{i}.mp3")
                           with open(temp_file, "wb") as f:
                               f.write(segment_audio)
                           temp_files.append(temp_file)
       
               self.merge_audio(temp_files)
       
           def merge_audio(self, temp_files):
               # 使用 pydub 合并音频文件
               combined_audio = AudioSegment.silent(duration=0)
               for file in temp_files:
                   audio_segment = AudioSegment.from_file(file)
                   combined_audio += audio_segment
               combined_audio.export(OUTPUT_FILE, format="mp3")
       
               # 删除临时文件
               for file in temp_files:
                   os.remove(file)
               self.finished.emit("语音文件生成完毕！")
       
       def play_completion_sound():
           os.system("afplay /System/Library/Sounds/Glass.aiff")  # 完成后的提示音
       
       class TTSApp(QWidget):
           def __init__(self):
               super().__init__()
               self.setWindowTitle("文字转语音工具")
               self.setGeometry(300, 300, 1000, 800)
               self.loaded_text = ""  # 初始化 loaded_text 属性
               self.setupUI()
       
           def setupUI(self):
               self.layout = QVBoxLayout(self)
               font = QFont("Arial", 14)
               self.setFont(font)
               self.text_input = QTextEdit()
               self.text_input.setPlaceholderText("请输入文字...")
               self.layout.addWidget(self.text_input)
               self.button_layout = QHBoxLayout()
               self.layout.addLayout(self.button_layout)
               button_style = """
                   QPushButton {
                       background-color: #4CAF50;
                       border: none;
                       color: white;
                       padding: 10px 20px;
                       text-align: center;
                       text-decoration: none;
                       font-size: 16px;
                       margin: 4px 2px;
                       border-radius: 10px;
                   }
                   QPushButton:hover {
                       background-color: #45a049;
                   }
                   QPushButton:disabled {
                       background-color: #ccc;
                       color: #666;
                   }
               """
               self.load_button = QPushButton("上传TXT文件", self)
               self.load_button.setStyleSheet(button_style)
               self.load_button.clicked.connect(self.load_text_file)
               self.button_layout.addWidget(self.load_button)
               self.generate_button = QPushButton("生成")
               self.generate_button.setStyleSheet(button_style)
               self.generate_button.clicked.connect(self.start_tts)
               self.button_layout.addWidget(self.generate_button)
               self.status_label = QLabel("")
               self.layout.addWidget(self.status_label)
       
           def load_text_file(self):
               options = QFileDialog.Options()
               options |= QFileDialog.ReadOnly
               file_path, _ = QFileDialog.getOpenFileName(
                   self,
                   "Open Text File",
                   os.path.expanduser("~/Desktop"),
                   "Text Files (*.txt);;All Files (*)",
                   options=options,
               )
               if file_path:
                   with open(file_path, "r", encoding="utf-8") as file:
                       self.loaded_text = file.read()
                       self.text_input.clear()
                       self.text_input.setPlainText(self.loaded_text)
       
           @pyqtSlot()
           def start_tts(self):
               text = self.loaded_text or self.text_input.toPlainText()
               if not text.strip():
                   self.status_label.setText("请输入一些文本！")
                   return
               self.unload_and_remove_old_audio()
               self.generate_button.setDisabled(True)
               self.load_button.setDisabled(True)
               self.tts_thread = TTSWorker(text)
               self.tts_thread.finished.connect(self.tts_finished)
               self.tts_thread.progress.connect(self.update_progress)
               self.tts_thread.start()
       
           def unload_and_remove_old_audio(self):
               try:
                   if os.path.exists(OUTPUT_FILE):
                       os.remove(OUTPUT_FILE)
               except Exception as e:
                   print(f"删除旧音频文件时出错: {e}")
       
           @pyqtSlot(int, int)
           def update_progress(self, current, total):
               self.status_label.setText(f"共需转录 {total} 个文件，正在转录第 {current} 个")
       
           @pyqtSlot()
           def tts_finished(self):
               self.generate_button.setDisabled(False)
               self.load_button.setDisabled(False)
               self.status_label.setText(f"语音文件生成完毕，文件位置：{OUTPUT_FILE}")
               play_completion_sound()
       
       if __name__ == "__main__":
           app = QApplication(sys.argv)
           ex = TTSApp()
           ex.show()
           sys.exit(app.exec_())
       ```