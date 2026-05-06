### 🎯 iPhone 拍摄 Macbook

> 问题：手机拍出来**有滚动条（频闪）**

1. 🧠 Mac 设置

   > - 系统设置 → 显示器 → 刷新率 :  改成**60Hz**（成败关键，**不改必翻车**））
   > - 亮度 75%（拉满会过曝发白）
   > - 关闭 自动调整亮度（不改画面会一会冷一会暖，一会亮一会暗）
   > - 默认分辨率

2. 📱 手机设置

   > 4K + 30fps + 自动对焦后锁对焦（长按屏幕）

3. 🎥 拍摄方式

   > - 距离 40cm（太近会中央清晰而四周发虚）
   >   - 只对准中央的文字进行对焦
   >   - 稍微拉远点距离到40cm，使景深变深来提升四周情绪度，然后编辑再裁切
   > - 轻微斜角（避免反光，减少摩尔纹）
   > - 三脚架固定

4. 💡 环境控制

   > * 侧面弱光（绝对黑暗反而不好，iPhone会自动补光）

### 🎯 iPhone 录音 Macbook

1. 音频质量：压缩
2. 立体声录音：关闭

----

```python
# 录制音频1
# 有可能被检测到 ffmpeg

from pathlib import Path
from datetime import datetime
import subprocess
import tkinter as tk
import sounddevice as sd

DEVICE_NAME = "BlackHole 2ch"
SAMPLERATE = 48000
CHANNELS = 2
BITRATE = "192k"

stream = None
ffmpeg = None
recording = False
output_path = None


def find_device():
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        if (
            DEVICE_NAME.lower() in dev["name"].lower()
            and dev["max_input_channels"] >= CHANNELS
        ):
            return i, dev["name"]
    raise RuntimeError(f"找不到输入设备：{DEVICE_NAME}")


def audio_callback(indata, frames, time, status):
    global ffmpeg
    if status:
        print(status)

    if ffmpeg and ffmpeg.stdin:
        try:
            ffmpeg.stdin.write(indata.tobytes())
        except BrokenPipeError:
            pass


def start_recording():
    global stream, ffmpeg, recording, output_path

    device_id, device_name = find_device()

    downloads = Path("~/Downloads").expanduser()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = downloads / f"mac_audio_{timestamp}.m4a"

    ffmpeg = subprocess.Popen(
        [
            "ffmpeg",
            "-y",
            "-f", "f32le",
            "-ar", str(SAMPLERATE),
            "-ac", str(CHANNELS),
            "-i", "pipe:0",
            "-c:a", "aac",
            "-b:a", BITRATE,
            str(output_path),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    stream = sd.InputStream(
        device=device_id,
        samplerate=SAMPLERATE,
        channels=CHANNELS,
        dtype="float32",
        callback=audio_callback,
    )

    stream.start()
    recording = True

    status_label.config(text=f"正在录制：{device_name}")
    toggle_button.config(text="停止录制")


def stop_recording():
    global stream, ffmpeg, recording

    if stream:
        stream.stop()
        stream.close()
        stream = None

    if ffmpeg:
        ffmpeg.stdin.close()
        ffmpeg.wait()
        ffmpeg = None

    recording = False

    status_label.config(text=f"已保存：{output_path}")
    toggle_button.config(text="开始录制")


def toggle_recording():
    if recording:
        stop_recording()
    else:
        start_recording()


def on_close():
    if recording:
        stop_recording()
    root.destroy()


root = tk.Tk()
root.title("BlackHole 录音")

toggle_button = tk.Button(
    root,
    text="开始录制",
    command=toggle_recording,
    width=20,
    height=2,
)
toggle_button.pack(padx=30, pady=20)

status_label = tk.Label(root, text="未录制")
status_label.pack(padx=30, pady=(0, 20))

root.protocol("WM_DELETE_WINDOW", on_close)
root.mainloop()
```

```python
# 录制音频2
# 绕开了编码器（ffmpeg）写出原始PCM数据
# 录完后可以转：ffmpeg -f f32le -ar 48000 -ac 2 -i input.raw output.m4a

from pathlib import Path
import subprocess
import tkinter as tk
import sounddevice as sd
import uuid
import numpy as np

DEVICE_NAME = "BlackHole 2ch"
SAMPLERATE = 48000
CHANNELS = 2

CHUNK_SIZE_MB = 100
MAX_BUFFER_MB = 500  # 🔥 安全上限，防止炸内存

stream = None
recording = False
output_path = None

audio_buffer = []
buffer_size_bytes = 0


def find_device():
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        if (
            DEVICE_NAME.lower() in dev["name"].lower()
            and dev["max_input_channels"] >= CHANNELS
        ):
            return i, dev["name"]
    raise RuntimeError(f"找不到输入设备：{DEVICE_NAME}")


def random_filename():
    return uuid.uuid4().hex


def flush_to_disk():
    global audio_buffer, buffer_size_bytes

    if not audio_buffer:
        return

    audio = np.concatenate(audio_buffer, axis=0)

    with open(output_path, "ab") as f:
        f.write(audio.tobytes())

    audio_buffer = []
    buffer_size_bytes = 0


def audio_callback(indata, frames, time, status):
    global audio_buffer, buffer_size_bytes

    if status:
        print(status)

    if not recording:
        return

    data = indata.copy()
    audio_buffer.append(data)
    buffer_size_bytes += data.nbytes

    # 达到100MB写入
    if buffer_size_bytes >= CHUNK_SIZE_MB * 1024 * 1024:
        flush_to_disk()

    # 🔥 防止意外爆内存
    if buffer_size_bytes >= MAX_BUFFER_MB * 1024 * 1024:
        print("⚠️ Buffer 超过安全上限，强制写入")
        flush_to_disk()


def start_recording():
    global stream, recording, output_path, audio_buffer, buffer_size_bytes

    device_id, device_name = find_device()

    downloads = Path("~/Downloads").expanduser()
    output_path = downloads / f"{random_filename()}.raw"

    audio_buffer = []
    buffer_size_bytes = 0

    stream = sd.InputStream(
        device=device_id,
        samplerate=SAMPLERATE,
        channels=CHANNELS,
        dtype="float32",
        callback=audio_callback,
    )

    stream.start()
    recording = True

    status_label.config(text=f"正在录制：{device_name}")
    toggle_button.config(text="停止录制")


def stop_recording():
    global stream, recording

    if stream:
        stream.stop()
        stream.close()
        stream = None

    # 最后一波写入
    flush_to_disk()

    recording = False

    status_label.config(text=f"已保存：{output_path}")
    toggle_button.config(text="开始录制")


def toggle_recording():
    if recording:
        stop_recording()
    else:
        start_recording()


def on_close():
    if recording:
        stop_recording()
    root.destroy()


# GUI
root = tk.Tk()
root.title("缓存录音（100MB写入）")

toggle_button = tk.Button(
    root,
    text="开始录制",
    command=toggle_recording,
    width=20,
    height=2,
)
toggle_button.pack(padx=30, pady=20)

status_label = tk.Label(root, text="未录制")
status_label.pack(padx=30, pady=(0, 20))

root.protocol("WM_DELETE_WINDOW", on_close)
root.mainloop()
```



---



##### 001 - 介绍课

1. TV 指标

   > luxalgo - volume delta candles
   >
   > Stpo 
   >
   > svp
   >
   > tpo（不用）
   >
   > vrvp
   >
   > ema
   >
   > 成交量加权平均价vwap
   >
   > previous key levels（fadi）
   >
   > luxalgo - session
   >
   > ICT HTF candle
   >
   > vol
   >
   > fvg
   >
   > op

2. 
