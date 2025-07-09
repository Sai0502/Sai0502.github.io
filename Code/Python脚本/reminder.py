# 接收一个带括号的参数
# python3 reminder.py "(15)"：单参数模式，每小时的15、30、45 分钟语音播报时间
# python3 reminder.py "(3+15)"：双参数模式，每 3 分钟提醒一次，每小时的15、30、45 分钟语音播报时间
# 无论单参数双参数，都在每小时的第 0 分钟，语音播报时间和提醒“筛一下新标的”
import os
import sys
import subprocess
import time
from datetime import datetime
import asyncio

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
    minute_ch = num_to_chinese(now.minute) if now.minute != 0 else '整'
    return f"{hour_ch}点{minute_ch}"

async def speak(text):
    from edge_tts import Communicate
    communicate = Communicate(text, voice="zh-CN-XiaoxiaoNeural")
    await communicate.save("output.mp3")
    os.system("afplay output.mp3")
    os.remove("output.mp3")  # 播放完成后删除文件

def send_notification(title, message):
    subprocess.run([
        "osascript", "-e",
        f'display notification "{message}" with title "{title}"'
    ])

def play_system_sound():
    subprocess.run(["afplay", "/System/Library/Sounds/Sosumi.aiff"])

def main_loop(params):
    try:
        # 解析参数
        if "+" in params:
            x, y = map(int, params.split("+"))
        else:
            x = int(params)
            y = None
    except ValueError:
        send_notification("运行参数错误", "参数格式错误，请使用 (x) 或 (x+y)")
        asyncio.run(speak("参数错误，格式错误"))
        sys.exit(1)

    already_triggered = None
    while True:
        now = datetime.now()
        key = f"{now.hour}:{now.minute}"
        if now.second == 0 and key != already_triggered:
            minute = now.minute

            # 每小时的第 0 分钟，语音播报时间和提醒“筛一下新标的”
            if minute == 0:
                ch_time = get_chinese_time()
                asyncio.run(speak(f"{ch_time}"))
                # asyncio.run(speak("筛一下新标的"))
                already_triggered = key  # 立即更新 already_triggered，避免重复触发
                continue  # 跳过后续逻辑，防止重复播报

            # 处理单参数模式：每小时的第 0 分钟、第 x 分钟、第 2x 分钟等语音播报
            if y is None:
                if minute % x == 0:
                    ch_time = get_chinese_time()
                    asyncio.run(speak(f"{ch_time}"))

            # 处理双参数模式：每 x 分钟播放系统声音并发送通知；每小时的第 0 分钟、第 y 分钟等语音播报
            else:
                if minute % x == 0:
                    play_system_sound()
                    send_notification(f"{x}分钟了", "看一眼盘面")
                if minute % y == 0:
                    ch_time = get_chinese_time()
                    asyncio.run(speak(f"{ch_time}"))
                    

            already_triggered = key
        time.sleep(1)

if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1].startswith("(") or not sys.argv[1].endswith(")"):
        send_notification("运行参数错误", "用法：python reminder.py '(x)' 或 '(x+y)'")
        asyncio.run(speak("参数错误，参数必须在括号内"))
        sys.exit(1)

    params = sys.argv[1][1:-1]  # 去掉括号
    main_loop(params)

