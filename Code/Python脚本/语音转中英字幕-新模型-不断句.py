"""
音频视频语音转文字
1. 可处理文件/文件夹递归所有文件
2. 音频直接转录，视频先转成临时mp3，再转录，结束后删除临时mp3
3. 支持 OpenAI Whisper / Faster-Whisper 引擎
4. 可选 split_segment=True，对字幕进行句子级合并与优化
5. 可输出SRT（带时间戳字幕），TXT （纯文字）
"""
import os
import time
import re
import subprocess
import tempfile

# =====================
# 工具函数
# =====================

SENT_END_CHARS = set(".?!。？！")

def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def parse_timestamp(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000

# =====================
# Whisper 转录
# =====================

def cpu_rest(start_time):
    elapsed_minutes = (time.time() - start_time) / 60
    rest_seconds = (int(elapsed_minutes // 10) + 1) * 60
    print(f"转录完成，耗时 {elapsed_minutes:.2f} 分钟，休息 {rest_seconds} 秒。")
    time.sleep(rest_seconds)

def transcribe_openai_whisper(model, input_path, output_path, language="en", srt_txt="srt"):
    start_time = time.time()
    result = model.transcribe(input_path, language=language)

    srt_path = output_path.replace(".txt", ".srt")
    txt_path = output_path.replace(".txt", ".txt")

    if srt_txt == "srt":
        with open(srt_path, "w", encoding="utf-8") as f:
            for idx, segment in enumerate(result["segments"], start=1):
                f.write(f"{idx}\n{format_timestamp(segment['start'])} --> {format_timestamp(segment['end'])}\n{segment['text'].strip()}\n\n")
        print(f"[OpenAI-Whisper] ✅ {srt_path} 用时 {(time.time()-start_time)/60:.2f} 分钟")
        cpu_rest(start_time)
        return srt_path
    else:  # txt
        with open(txt_path, "w", encoding="utf-8") as f:
            for segment in result["segments"]:
                text = segment['text'].strip()
                if text:  # 过滤空行
                    f.write(text + "\n")
        print(f"[OpenAI-Whisper] ✅ {txt_path} 用时 {(time.time()-start_time)/60:.2f} 分钟")
        cpu_rest(start_time)
        return txt_path
    
def transcribe_faster_whisper(model, input_path, output_path, language="en", srt_txt="srt"):
    start_time = time.time()
    segments, _ = model.transcribe(input_path, beam_size=5, language=language)

    srt_path = output_path.replace(".txt", ".srt")
    txt_path = output_path.replace(".txt", ".txt")

    if srt_txt == "srt":
        with open(srt_path, "w", encoding="utf-8") as f:
            for idx, segment in enumerate(segments, start=1):
                f.write(f"{idx}\n{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}\n{segment.text.strip()}\n\n")
        print(f"[Faster-Whisper] ✅ {srt_path} 用时 {(time.time()-start_time)/60:.2f} 分钟")
        cpu_rest(start_time)
        return srt_path
    else:  # txt
        with open(txt_path, "w", encoding="utf-8") as f:
            for segment in segments:
                text = segment.text.strip()
                if text:  # 过滤空行
                    f.write(text + "\n")
        print(f"[Faster-Whisper] ✅ {txt_path} 用时 {(time.time()-start_time)/60:.2f} 分钟")
        cpu_rest(start_time)
        return txt_path

# =====================
# SRT 处理
# =====================

def read_srt(path: str):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
    blocks = re.split(r"\n\s*\n", content)
    entries = []
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) >= 3:
            times = lines[1].split("-->")
            start = parse_timestamp(times[0].strip())
            end = parse_timestamp(times[1].strip())
            text = " ".join(lines[2:]).strip()
            entries.append((start, end, text))
    return entries

def write_srt(entries, path: str):
    with open(path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(entries, start=1):
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
            f.write(text + "\n\n")

def split_sentence_with_time(start, end, text):
    parts = re.split(r"([.?!。？！])", text)
    chunks, buffer = [], ""
    for p in parts:
        if not p.strip():
            continue
        buffer += p
        if p in SENT_END_CHARS:
            chunks.append(buffer.strip())
            buffer = ""
    if buffer:
        chunks.append(buffer.strip())

    total_duration = end - start
    total_words = sum(len(c.split()) for c in chunks) or 1
    avg_word_time = total_duration / total_words

    result, cur_start = [], start
    for c in chunks:
        word_count = len(c.split()) or 1
        cur_end = cur_start + word_count * avg_word_time
        result.append((cur_start, cur_end, c))
        cur_start = cur_end
    return result

def merge_sentences(entries):
    merged, cache = [], []
    for start, end, text in entries:
        cache.append((start, end, text))
        if text and text[-1] in SENT_END_CHARS:
            new_start, new_end = cache[0][0], cache[-1][1]
            new_text = " ".join([t for _, _, t in cache])
            merged.extend(split_sentence_with_time(new_start, new_end, new_text))
            cache = []
    if cache:
        new_start, new_end = cache[0][0], cache[-1][1]
        new_text = " ".join([t for _, _, t in cache])
        merged.append((new_start, new_end, new_text))
    return merged

def process_srt(file_path: str):
    entries = read_srt(file_path)
    merged_entries = merge_sentences(entries)

    # ====== 新逻辑：把原始文件移到 original/ 子目录 ======
    base_dir = os.path.dirname(file_path)
    base_name = os.path.basename(file_path)
    original_dir = os.path.join(base_dir, "original")
    os.makedirs(original_dir, exist_ok=True)

    # 移动原始文件
    original_path = os.path.join(original_dir, base_name)
    os.replace(file_path, original_path)

    # 最终字幕文件（和视频同名）
    output_path = file_path  # 直接覆盖原始位置
    write_srt(merged_entries, output_path)
# =====================
# 主入口
# =====================

def extract_audio_temp(input_path: str) -> str:
    """如果是视频文件，提取音频到临时 mp3，返回新路径；否则返回原路径"""
    video_exts = (".mp4", ".mkv", ".avi", ".mov", ".webm")
    if input_path.lower().endswith(video_exts):
        fd, out_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        print(f"🎬 检测到视频文件，提取临时音频: {out_path}")
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vn", "-ac", "1", "-ar", "16000", "-b:a", "128k",
            out_path
        ]
        subprocess.run(cmd, check=True)
        return out_path
    return input_path

def cooking(input_path, engine, model_name, device="cpu", language="en", split_segment=False, srt_txt="srt"):
    if engine == "whisper":
        import whisper
        asr_model = whisper.load_model(model_name)
        transcribe_func = transcribe_openai_whisper
    elif engine == "faster_whisper":
        from faster_whisper import WhisperModel
        compute_type = "int8" if device == "cpu" else "float16"
        asr_model = WhisperModel(model_name, device=device, compute_type=compute_type)
        transcribe_func = transcribe_faster_whisper
    else:
        raise ValueError("❌ engine 必须是 'whisper' 或 'faster_whisper'")

    if os.path.isfile(input_path):
        temp_path = extract_audio_temp(input_path)
        try:
            out_path = os.path.splitext(input_path)[0] + ".txt"
            print(f"🎬 {input_path} 开始转录...")
            srt_path = transcribe_func(asr_model, temp_path, out_path, language, srt_txt=srt_txt)
            if split_segment and srt_txt == "srt":
                process_srt(srt_path)
        finally:
            if temp_path != input_path and os.path.exists(temp_path):
                os.remove(temp_path)
                print(f"🗑️ 已删除临时文件 {temp_path}")
    elif os.path.isdir(input_path):
        for f in os.listdir(input_path):
            if f.endswith((".mp3", ".m4a", ".webm", ".mp4", ".mkv", ".avi")):
                in_path = os.path.join(input_path, f)
                temp_path = extract_audio_temp(in_path)
                try:
                    out_path = os.path.splitext(in_path)[0] + ".txt"
                    print(f"🎬 {f} 开始转录...")
                    srt_path = transcribe_func(asr_model, temp_path, out_path, language, srt_txt=srt_txt)
                    if split_segment and srt_txt == "srt":
                        process_srt(srt_path)
                finally:
                    if temp_path != in_path and os.path.exists(temp_path):
                        os.remove(temp_path)
                        print(f"🗑️ 已删除临时文件 {temp_path}")
    else:
        print(f"❌ 无效路径: {input_path}")


if __name__ == "__main__":
    input_path = "/Users/jiangsai/Downloads/TTT/1 - Introduction to the Course and to Trading.mp4"
    engine = "whisper"    # "whisper" 或 "faster_whisper"
    model = "small"       # "tiny" / "base" / "small" / "medium" / "large-v2"
    split_segment = True  # False = 类似YouTube那种段不成段的字幕 True = 拆分按句号合并
    srt_txt = "srt"       # "srt" = 输出字幕  "txt" = 输出纯文本
    language="en"
    cooking(input_path, engine, model, device="cpu", language=language, split_segment=split_segment, srt_txt=srt_txt)
