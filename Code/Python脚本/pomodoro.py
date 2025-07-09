# 功能：番茄钟 + 朗读 + 切换并全屏 Preview
# 需要提前用Preview打开一个图片，并不能最小化
import asyncio
import subprocess
import os
from edge_tts import Communicate

# 🗣️ 朗读文本函数
async def speak(text):
    communicate = Communicate(text, voice="zh-CN-XiaoxiaoNeural")
    await communicate.save("output.mp3")
    os.system("afplay output.mp3")

# 🍅 切换并全屏 Preview
def activate_and_fullscreen_preview():
    applescript = '''
    tell application "Firefox"
        activate
    end tell
    delay 1
    tell application "System Events"
        keystroke "f" using {control down, command down}
    end tell
    '''
    subprocess.run(["osascript", "-e", applescript])

# 🔁 主循环逻辑封装成 async
async def pomodoro_loop():
    try:
        while True:
            print("🍅 开始专注：25分钟")
            await asyncio.sleep(10)
            # await asyncio.sleep(25 * 60)
            await speak("休息一下吧")
            activate_and_fullscreen_preview()

            print("😌 休息中：10分钟")
            await asyncio.sleep(5)
            # await asyncio.sleep(10 * 60)
            await speak("开始干活吧")
            activate_and_fullscreen_preview()
    except asyncio.CancelledError:
        print("番茄钟已被中止。")

# 👇 顶层事件循环入口
if __name__ == "__main__":
    asyncio.run(pomodoro_loop())
