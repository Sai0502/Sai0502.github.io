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

CHUNK_SIZE_MB = 500
MAX_BUFFER_MB = 1024  # 🔥 安全上限，防止炸内存

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