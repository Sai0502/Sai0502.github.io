import os
from pydub import AudioSegment

# ====== 配置区 ======
INPUT_DIR = "/Users/jiangsai/Downloads/孙宇晨-财富自由革命之路/待处理"    # 原始 MP3 文件夹
OUTPUT_DIR = "/Users/jiangsai/Downloads/孙宇晨-财富自由革命之路/已处理"  # 输出文件夹
CUT_MS = 15 * 1000                   # 前 1 分钟（毫秒）
# ===================

os.makedirs(OUTPUT_DIR, exist_ok=True)

for filename in os.listdir(INPUT_DIR):
    if not filename.lower().endswith(".mp3"):
        continue

    input_path = os.path.join(INPUT_DIR, filename)
    output_path = os.path.join(OUTPUT_DIR, filename)

    try:
        audio = AudioSegment.from_mp3(input_path)

        if len(audio) <= CUT_MS:
            print(f"⚠️ 跳过（音频不足1分钟）: {filename}")
            continue

        trimmed_audio = audio[CUT_MS:]
        trimmed_audio.export(output_path, format="mp3")

        print(f"✅ 已处理: {filename}")

    except Exception as e:
        print(f"❌ 处理失败 {filename}: {e}")
