# import os
# import re
# import time
# from zhconv import convert
# from faster_whisper import WhisperModel

# # =============== 工具函数 ===============

# SENT_END_CHARS = ".?!。？！"

# def format_timestamp(seconds: float) -> str:
#     """把秒数格式化成 SRT 时间戳"""
#     h = int(seconds // 3600)
#     m = int((seconds % 3600) // 60)
#     s = int(seconds % 60)
#     ms = int(round((seconds - int(seconds)) * 1000))
#     return f"{h:02}:{m:02}:{s:02},{ms:03}"

# def split_by_punctuation(text: str):
#     """按结束符拆分句子（保留结束符号）"""
#     parts = re.split(f"([{SENT_END_CHARS}])", text)
#     result = []
#     buffer = ""
#     for p in parts:
#         if not p.strip():
#             continue
#         buffer += p
#         if p in SENT_END_CHARS:  # 碰到结束符就切分
#             result.append(buffer.strip())
#             buffer = ""
#     if buffer:  # 末尾没结束符的残余
#         result.append(buffer.strip())
#     return result

# def refine_sentences(entries):
#     """
#     合并 Whisper 段落，并根据结束符号进一步拆分
#     每个子句分配合理时间戳（按单词数均分）
#     """
#     merged = []
#     cache = []

#     for start, end, text in entries:
#         cache.append((start, end, text))

#         # 当前缓存拼成一条大句子
#         full_text = " ".join([t for _, _, t in cache])
#         if full_text and full_text[-1] in SENT_END_CHARS:
#             new_start = cache[0][0]
#             new_end = cache[-1][1]

#             # 拆成多个子句
#             sub_sentences = split_by_punctuation(full_text)

#             # 时间均分逻辑
#             duration = new_end - new_start
#             total_words = sum(len(s.split()) for s in sub_sentences) or 1
#             avg_word_time = duration / total_words

#             cur_start = new_start
#             for sub in sub_sentences:
#                 word_count = len(sub.split()) or 1
#                 cur_end = cur_start + word_count * avg_word_time
#                 merged.append((cur_start, cur_end, sub))
#                 cur_start = cur_end

#             cache = []

#     # 处理最后没结束符的残余
#     if cache:
#         new_start = cache[0][0]
#         new_end = cache[-1][1]
#         new_text = " ".join([t for _, _, t in cache])
#         merged.append((new_start, new_end, new_text))

#     return merged

# def write_srt(entries, path: str):
#     """写入 SRT 文件"""
#     with open(path, "w", encoding="utf-8") as f:
#         for i, (start, end, text) in enumerate(entries, start=1):
#             f.write(f"{i}\n")
#             f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
#             f.write(text + "\n\n")

# # =============== 转录逻辑 ===============

# def transcribe_audio_file(model, input_path, mode):
#     start_time = time.time()
#     language = "en" if mode == "en" else "zh"

#     # Whisper 转录（逐段，不启用 word_timestamps）
#     segments, info = model.transcribe(
#         input_path,
#         language=language
#     )

#     base_dir = os.path.dirname(input_path)
#     base_name = os.path.splitext(os.path.basename(input_path))[0]

#     if mode == "en":
#         srt_path = os.path.join(base_dir, base_name + ".srt")

#         # 收集原始结果
#         raw_entries = []
#         for seg in segments:
#             start = float(seg.start)
#             end = float(seg.end)
#             text = (seg.text or "").strip()
#             if text:
#                 raw_entries.append((start, end, text))

#         # 调用 refine_sentences 修复断句
#         final_entries = refine_sentences(raw_entries)

#         # 写入最终 SRT
#         write_srt(final_entries, srt_path)
#         print(f"✅ 英文字幕已生成: {srt_path}")

#     elif mode == "zh":
#         txt_path = os.path.join(base_dir, base_name + ".txt")
#         full_text = ""
#         for seg in segments:
#             full_text += (seg.text or "").strip() + "\n"
#         simplified_text = convert(full_text, "zh-cn")
#         with open(txt_path, "w", encoding="utf-8") as txt_file:
#             txt_file.write(simplified_text)
#         print(f"✅ 中文字幕已生成: {txt_path}")

#     elapsed_minutes = (time.time() - start_time) / 60
#     rest_seconds = (int(elapsed_minutes // 10) + 1) * 60
#     print(f"{input_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒。")
#     time.sleep(rest_seconds)

# def transcribe_directory(model, folder_path, mode):
#     for root, dirs, files in os.walk(folder_path):
#         dirs.sort()
#         files.sort()
#         for file in files:
#             if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi", ".wav", ".flac")):
#                 video_path = os.path.join(root, file)
#                 print(f"正在转录: {video_path}")
#                 transcribe_audio_file(model, video_path, mode)

# def cooking(input_path, whisper_model_name, mode):
#     # CPU 环境推荐 int8
#     model = WhisperModel(whisper_model_name, compute_type="int8")

#     if os.path.isdir(input_path):
#         transcribe_directory(model, input_path, mode)
#     elif os.path.isfile(input_path):
#         print(f"正在转录: {input_path}")
#         transcribe_audio_file(model, input_path, mode)
#     else:
#         print(f"❌ 无效路径：{input_path}")

# # =============== 主程序入口 ===============

# if __name__ == "__main__":
#     input_path = "/Users/jiangsai/Downloads/幻影交易2024/Module 9 - Risk Management/PTS-M9_3、Fixed Percent Risk vs Fixed Lot Sizes.mp4"
#     # 模型可选 "tiny", "base", "small", "medium", "large"
#     whisper_model_name = "medium"     # 英文推荐 "medium.en"，中英混合/中文用 "medium"
#     mode = "en"  # "en" -> 英文SRT, "zh" -> 中文TXT
#     cooking(input_path, whisper_model_name, mode)
import os
import re
import time
from zhconv import convert
from faster_whisper import WhisperModel

SENT_END_CHARS = ".?!。？！"

# =============== 工具函数 ===============

def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def split_by_punctuation(text: str):
    parts = re.split(f"([{SENT_END_CHARS}])", text)
    result, buffer = [], ""
    for p in parts:
        if not p.strip():
            continue
        buffer += p
        if p in SENT_END_CHARS:
            result.append(buffer.strip())
            buffer = ""
    if buffer:
        result.append(buffer.strip())
    return result

def refine_sentences(entries):
    global SPLIT_MULTI_END   # ⬅️ 告诉 Python 用全局开关
    merged, cache = [], []

    for start, end, text in entries:
        cache.append((start, end, text))
        full_text = " ".join([t for _, _, t in cache])

        if full_text and full_text[-1] in SENT_END_CHARS:
            new_start, new_end = cache[0][0], cache[-1][1]

            if SPLIT_MULTI_END:
                sub_sentences = split_by_punctuation(full_text)
                duration = new_end - new_start
                total_words = sum(len(s.split()) for s in sub_sentences) or 1
                avg_word_time = duration / total_words

                cur_start = new_start
                for sub in sub_sentences:
                    word_count = len(sub.split()) or 1
                    cur_end = cur_start + word_count * avg_word_time
                    merged.append((cur_start, cur_end, sub))
                    cur_start = cur_end
            else:
                merged.append((new_start, new_end, full_text))
            cache = []

    if cache:
        new_start, new_end = cache[0][0], cache[-1][1]
        merged.append((new_start, new_end, " ".join([t for _, _, t in cache])))

    return merged

def write_srt(entries, path: str):
    with open(path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(entries, start=1):
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
            f.write(text + "\n\n")

# =============== 转录逻辑 ===============

def transcribe_audio_file(model, input_path, mode):
    start_time = time.time()
    language = "en" if mode == "en" else "zh"

    segments, info = model.transcribe(input_path, language=language)

    base_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]

    if mode == "en":
        srt_path = os.path.join(base_dir, base_name + ".srt")
        raw_entries = [(float(seg.start), float(seg.end), (seg.text or "").strip())
                       for seg in segments if (seg.text or "").strip()]
        final_entries = refine_sentences(raw_entries)
        write_srt(final_entries, srt_path)
        print(f"✅ 英文字幕已生成: {srt_path}")

    elif mode == "zh":
        txt_path = os.path.join(base_dir, base_name + ".txt")
        full_text = "\n".join((seg.text or "").strip() for seg in segments)
        simplified_text = convert(full_text, "zh-cn")
        with open(txt_path, "w", encoding="utf-8") as txt_file:
            txt_file.write(simplified_text)
        print(f"✅ 中文字幕已生成: {txt_path}")

    elapsed_minutes = (time.time() - start_time) / 60
    rest_seconds = (int(elapsed_minutes // 10) + 1) * 60
    print(f"{input_path} 转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒。")
    time.sleep(rest_seconds)

def transcribe_directory(model, folder_path, mode):
    for root, dirs, files in os.walk(folder_path):
        dirs.sort()
        files.sort()
        for file in files:
            if file.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi", ".wav", ".flac")):
                video_path = os.path.join(root, file)
                print(f"正在转录: {video_path}")
                transcribe_audio_file(model, video_path, mode)

def cooking(input_path, whisper_model_name, mode):
    model = WhisperModel(whisper_model_name, compute_type="int8")
    if os.path.isdir(input_path):
        transcribe_directory(model, input_path, mode)
    elif os.path.isfile(input_path):
        print(f"正在转录: {input_path}")
        transcribe_audio_file(model, input_path, mode)
    else:
        print(f"❌ 无效路径：{input_path}")

# =============== 主程序入口（配置集中在这里） ===============

if __name__ == "__main__":
    input_path = "/Users/jiangsai/Downloads/幻影交易2024/Module 9 - Risk Management/PTS-M9_3、Fixed Percent Risk vs Fixed Lot Sizes.mp4"
    whisper_model_name = "medium"  # "tiny", "base", "small", "medium", "large"
    mode = "en"                    # "en" -> 英文SRT, "zh" -> 中文TXT
    SPLIT_MULTI_END = True         # True=拆分子句， False =整句输出

    cooking(input_path, whisper_model_name, mode)
