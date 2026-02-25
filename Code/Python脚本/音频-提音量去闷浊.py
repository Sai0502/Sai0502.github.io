from pydub import AudioSegment, effects
import os

# === 配置路径 ===
input_folder = "/Users/jiangsai/Downloads/TLBB"
output_folder = "/Users/jiangsai/Downloads/TLBB/mp3_output"
os.makedirs(output_folder, exist_ok=True)

# 高频提亮（让声音不闷）：+8 dB
def boost_high_freq(sound, gain_db=8, cutoff=6000):
    high = sound.high_pass_filter(cutoff)
    return sound.overlay(high + gain_db)

for filename in os.listdir(input_folder):
    if filename.lower().endswith(".mp3"):
        print(f"\n正在处理：{filename}")
        input_path = os.path.join(input_folder, filename)

        audio = AudioSegment.from_mp3(input_path)

        # === 1. 高频提亮 ===
        print("  [1/4] 高频提亮（让声音不闷）...")
        audio = boost_high_freq(audio, gain_db=8, cutoff=6000)

        # === 2. 高通滤波：去掉闷浊低频 ===
        print("  [2/4] 轻微高通滤波（去掉闷浊低频）...")
        audio = audio.high_pass_filter(120)

        # === 3. 去浑浊区（降低 250Hz）===
        print("  [3/4] 去浑浊区（降低 250Hz 区间）...")

        # 提取 200~300Hz
        band = audio.low_pass_filter(300).high_pass_filter(200)

        # 降低 6dB 后叠加（削弱该频段）
        audio = audio.overlay(band - 6)

        # === 4. 标准化 ===
        print("  [4/4] 标准化处理（避免爆音）...")
        audio = effects.normalize(audio)

        # 输出
        output_path = os.path.join(output_folder, filename)
        audio.export(output_path, format="mp3")

        print(f"完成 -> {output_path}")

print("\n全部处理完成！")
