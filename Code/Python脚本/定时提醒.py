# 定时提醒程序：每5分钟提醒一次，并在整点和半点时进行语音报时
# 库： pip install edge-tts

import asyncio
import time
from datetime import datetime
import os
import subprocess

# 中文数字映射
chinese_nums = {
    0: '零', 1: '一', 2: '二', 3: '三', 4: '四',
    5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十'
}

def num_to_chinese(n):
    if n < 10:
        return chinese_nums[n]
    elif n == 10:
        return '十'
    elif n < 20:
        return '十' + chinese_nums[n % 10]
    else:
        return chinese_nums[n // 10] + '十' + (chinese_nums[n % 10] if n % 10 != 0 else '')

def get_chinese_time():
    now = datetime.now()
    hour_ch = num_to_chinese(now.hour)
    if now.minute == 0:
        minute_ch = '整'
    else:
        minute_ch = num_to_chinese(now.minute)
    return f"{hour_ch}点{minute_ch}分"

async def speak(text):
    from edge_tts import Communicate
    communicate = Communicate(text, voice="zh-CN-XiaoxiaoNeural")
    await communicate.save("output.mp3")
    os.system("afplay output.mp3")

def send_notification(title, message):
    subprocess.run([
        "osascript", "-e",
        f'display notification "{message}" with title "{title}"'
    ])

def play_system_sound():
    subprocess.run(["afplay", "/System/Library/Sounds/Sosumi.aiff"])

def main_loop():
    already_triggered = None  # 格式：'hh:mm'

    while True:
        now = datetime.now()
        key = f"{now.hour}:{now.minute}"
        if now.second == 0 and key != already_triggered:
            if now.minute in [0, 30]:
                # 整点或半点：语音报时
                ch_time = get_chinese_time()
                asyncio.run(speak(f"现在时间是：{ch_time}"))
                # send_notification("30分钟了", "看一眼盘面")
            elif now.minute % 5 == 0:
                # 普通5分钟倍数
                play_system_sound()
                send_notification("5分钟了", "看一眼盘面")

            already_triggered = key

        time.sleep(1)

if __name__ == "__main__":
    main_loop()
