# 绕开 ffmpeg，直接录制原始 PCM 数据
# 录完后可以转换：
# ffmpeg -f f32le -ar 48000 -ac 2 -i input.raw output.m4a

import sys
print("python:", sys.executable)
print("version:", sys.version)

from pathlib import Path
import threading
import tkinter as tk
from tkinter import messagebox, ttk
import uuid

DEVICE_NAME = "BlackHole 2ch"
SAMPLERATE = 48000
CHANNELS = 2

# 缓存达到多少 MB 后写入磁盘
CHUNK_SIZE_MB = 300

stream = None
recording = False
starting = False
output_path = None

audio_buffer = []
buffer_size_bytes = 0

# 实时音量
current_volume = 0

sd = None
np = None


def load_audio_modules():
    global sd, np

    if sd is None:
        import sounddevice as sounddevice_module
        sd = sounddevice_module

    if np is None:
        import numpy as numpy_module
        np = numpy_module


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
    global audio_buffer
    global buffer_size_bytes

    if not audio_buffer:
        return

    audio = np.concatenate(audio_buffer, axis=0)

    with open(output_path, "ab") as f:
        f.write(audio.tobytes())

    audio_buffer = []
    buffer_size_bytes = 0


def audio_callback(indata, frames, time, status):
    global audio_buffer
    global buffer_size_bytes
    global current_volume

    if status:
        print(status)

    if not recording:
        return

    data = indata.copy()

    # 🔥 RMS 音量检测（更专业、更稳定）
    current_volume = float(
        np.sqrt(np.mean(indata ** 2))
    )

    audio_buffer.append(data)
    buffer_size_bytes += data.nbytes

    # 达到缓存大小后写入磁盘
    if buffer_size_bytes >= CHUNK_SIZE_MB * 1024 * 1024:
        flush_to_disk()


def update_volume_meter():
    global current_volume

    # 🔥 降低灵敏度
    level = min(int(current_volume * 700), 100)

    volume_bar["value"] = level

    # 100ms 刷新一次
    root.after(100, update_volume_meter)


def start_recording_worker():
    global stream
    global recording
    global output_path
    global audio_buffer
    global buffer_size_bytes
    global starting

    try:
        root.after(
            0,
            lambda: status_label.config(text="正在初始化音频模块...")
        )

        load_audio_modules()

        root.after(
            0,
            lambda: status_label.config(text="正在查找 BlackHole 设备...")
        )

        device_id, device_name = find_device()

        downloads = Path("~/Downloads").expanduser()

        output_path = downloads / f"{random_filename()}.raw"

        audio_buffer = []
        buffer_size_bytes = 0

        root.after(
            0,
            lambda: status_label.config(text="正在打开输入流...")
        )

        new_stream = sd.InputStream(
            device=device_id,
            samplerate=SAMPLERATE,
            channels=CHANNELS,
            dtype="float32",
            callback=audio_callback,
            blocksize=1024,
        )

        recording = True

        new_stream.start()

        stream = new_stream

        root.after(
            0,
            lambda: recording_started(device_name)
        )

    except Exception as e:
        recording = False

        root.after(
            0,
            lambda error=e: recording_start_failed(error)
        )

    finally:
        starting = False


def recording_started(device_name):
    status_label.config(
        text=f"正在录制：{device_name}"
    )

    toggle_button.config(
        text="停止录制",
        state=tk.NORMAL
    )


def recording_start_failed(error):
    status_label.config(text="启动录音失败")

    toggle_button.config(
        text="开始录制",
        state=tk.NORMAL
    )

    messagebox.showerror(
        "启动录音失败",
        str(error)
    )


def start_recording():
    global starting

    if starting:
        return

    starting = True

    toggle_button.config(
        text="正在启动...",
        state=tk.DISABLED
    )

    status_label.config(text="正在启动录音...")

    worker = threading.Thread(
        target=start_recording_worker,
        daemon=True
    )

    worker.start()


def stop_recording():
    global stream
    global recording
    global starting
    global current_volume

    if starting:
        status_label.config(
            text="正在启动音频模块，请稍等..."
        )
        return

    if stream:
        stream.stop()
        stream.close()
        stream = None

    # 最后一波写入
    flush_to_disk()

    recording = False
    current_volume = 0

    volume_bar["value"] = 0

    status_label.config(
        text=f"已保存：{output_path}"
    )

    toggle_button.config(text="开始录制")


def toggle_recording():
    if recording:
        stop_recording()
    else:
        try:
            start_recording()

        except Exception as e:
            status_label.config(text="启动录音失败")

            messagebox.showerror(
                "启动录音失败",
                str(e)
            )


def on_close():
    if recording:
        stop_recording()

    root.destroy()


# ===== GUI =====

root = tk.Tk()

root.title("缓存录音（300MB写入）")

root.geometry("420x180+200+200")

# 启动时临时置顶
root.lift()

root.attributes("-topmost", True)

root.after(
    1000,
    lambda: root.attributes("-topmost", False)
)

root.focus_force()

toggle_button = tk.Button(
    root,
    text="开始录制",
    command=toggle_recording,
    width=20,
    height=2,
)

toggle_button.pack(
    padx=30,
    pady=20
)

status_label = tk.Label(
    root,
    text="未录制"
)

status_label.pack(
    padx=30,
    pady=(0, 10)
)

# 音量条
volume_bar = ttk.Progressbar(
    root,
    orient="horizontal",
    length=300,
    mode="determinate",
    maximum=100,
)

volume_bar.pack(
    pady=(10, 20)
)

root.protocol(
    "WM_DELETE_WINDOW",
    on_close
)

# 启动音量刷新
update_volume_meter()

root.mainloop()

####################################################################################
# # 绕开了编码器（ffmpeg）写出原始PCM数据
# # 录完后可以转：ffmpeg -f f32le -ar 48000 -ac 2 -i input.raw output.m4a


# import sys
# print("python:", sys.executable)
# print("version:", sys.version)


# from pathlib import Path
# import threading
# import tkinter as tk
# from tkinter import messagebox
# import uuid


# DEVICE_NAME = "BlackHole 2ch"
# SAMPLERATE = 48000
# CHANNELS = 2

# CHUNK_SIZE_MB = 300
# MAX_BUFFER_MB = 800  # 🔥 安全上限，防止炸内存

# stream = None
# recording = False
# starting = False
# output_path = None

# audio_buffer = []
# buffer_size_bytes = 0

# sd = None
# np = None


# def load_audio_modules():
#     global sd, np

#     if sd is None:
#         import sounddevice as sounddevice_module
#         sd = sounddevice_module

#     if np is None:
#         import numpy as numpy_module
#         np = numpy_module


# def find_device():
#     devices = sd.query_devices()
#     for i, dev in enumerate(devices):
#         if (
#             DEVICE_NAME.lower() in dev["name"].lower()
#             and dev["max_input_channels"] >= CHANNELS
#         ):
#             return i, dev["name"]
#     raise RuntimeError(f"找不到输入设备：{DEVICE_NAME}")


# def random_filename():
#     return uuid.uuid4().hex


# def flush_to_disk():
#     global audio_buffer, buffer_size_bytes

#     if not audio_buffer:
#         return

#     audio = np.concatenate(audio_buffer, axis=0)

#     with open(output_path, "ab") as f:
#         f.write(audio.tobytes())

#     audio_buffer = []
#     buffer_size_bytes = 0


# def audio_callback(indata, frames, time, status):
#     global audio_buffer, buffer_size_bytes

#     if status:
#         print(status)

#     if not recording:
#         return

#     data = indata.copy()
#     audio_buffer.append(data)
#     buffer_size_bytes += data.nbytes

#     # 达到100MB写入
#     if buffer_size_bytes >= CHUNK_SIZE_MB * 1024 * 1024:
#         flush_to_disk()

#     # 🔥 防止意外爆内存
#     if buffer_size_bytes >= MAX_BUFFER_MB * 1024 * 1024:
#         print("⚠️ Buffer 超过安全上限，强制写入")
#         flush_to_disk()


# def start_recording_worker():
#     global stream, recording, output_path, audio_buffer, buffer_size_bytes, starting

#     try:
#         root.after(0, lambda: status_label.config(text="正在初始化音频模块..."))
#         load_audio_modules()

#         root.after(0, lambda: status_label.config(text="正在查找 BlackHole 设备..."))
#         device_id, device_name = find_device()

#         downloads = Path("~/Downloads").expanduser()
#         output_path = downloads / f"{random_filename()}.raw"

#         audio_buffer = []
#         buffer_size_bytes = 0

#         root.after(0, lambda: status_label.config(text="正在打开输入流..."))
#         new_stream = sd.InputStream(
#             device=device_id,
#             samplerate=SAMPLERATE,
#             channels=CHANNELS,
#             dtype="float32",
#             callback=audio_callback,
#         )

#         recording = True
#         new_stream.start()
#         stream = new_stream

#         root.after(0, lambda: recording_started(device_name))
#     except Exception as e:
#         recording = False
#         root.after(0, lambda error=e: recording_start_failed(error))
#     finally:
#         starting = False


# def recording_started(device_name):
#     status_label.config(text=f"正在录制：{device_name}")
#     toggle_button.config(text="停止录制", state=tk.NORMAL)


# def recording_start_failed(error):
#     status_label.config(text="启动录音失败")
#     toggle_button.config(text="开始录制", state=tk.NORMAL)
#     messagebox.showerror("启动录音失败", str(error))


# def start_recording():
#     global starting

#     if starting:
#         return

#     starting = True
#     toggle_button.config(text="正在启动...", state=tk.DISABLED)
#     status_label.config(text="正在启动录音...")

#     worker = threading.Thread(target=start_recording_worker, daemon=True)
#     worker.start()


# def stop_recording():
#     global stream, recording, starting

#     if starting:
#         status_label.config(text="正在启动音频模块，请稍等...")
#         return

#     if stream:
#         stream.stop()
#         stream.close()
#         stream = None

#     # 最后一波写入
#     flush_to_disk()

#     recording = False

#     status_label.config(text=f"已保存：{output_path}")
#     toggle_button.config(text="开始录制")


# def toggle_recording():
#     if recording:
#         stop_recording()
#     else:
#         try:
#             start_recording()
#         except Exception as e:
#             status_label.config(text="启动录音失败")
#             messagebox.showerror("启动录音失败", str(e))


# def on_close():
#     if recording:
#         stop_recording()
#     root.destroy()


# # GUI
# print("创建 Tk 窗口", flush=True)
# root = tk.Tk()
# print("Tk 窗口已创建", flush=True)

# root.title("缓存录音（300MB写入）")
# root.geometry("360x160+200+200")

# # 强制把窗口拉到前面，1 秒后取消置顶
# root.lift()
# root.attributes("-topmost", True)
# root.after(1000, lambda: root.attributes("-topmost", False))
# root.focus_force()

# toggle_button = tk.Button(
#     root,
#     text="开始录制",
#     command=toggle_recording,
#     width=20,
#     height=2,
# )
# toggle_button.pack(padx=30, pady=20)

# status_label = tk.Label(root, text="未录制")
# status_label.pack(padx=30, pady=(0, 20))

# root.protocol("WM_DELETE_WINDOW", on_close)

# print("进入 mainloop", flush=True)
# root.mainloop()
# print("mainloop 结束", flush=True)
