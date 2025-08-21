import edge_tts
import asyncio
import re

async def srt_to_single_tts(file_path, output_file):
    # 读取 SRT 并拼接文本
    text_list = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if "-->" not in line and not line.strip().isdigit() and line.strip():
                text_list.append(line.strip())

    full_text = " ".join(text_list)  # 合并成一个完整字符串
    print("合成语音中...")

    # 生成语音
    tts = edge_tts.Communicate(full_text, voice="zh-CN-XiaoxiaoNeural", rate="+0%")
    await tts.save(output_file)

    print(f"音频已保存: {output_file}")

if __name__ == "__main__":
    asyncio.run(srt_to_single_tts("/Users/jiangsai/Desktop/PTS-M3_1、2 Phases.srt", "/Users/jiangsai/Desktop/output.mp3"))
