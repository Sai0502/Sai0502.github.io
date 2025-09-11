import re
import os

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

def read_srt(path: str):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
    blocks = re.split(r"\n\s*\n", content)
    entries = []
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) >= 3:
            idx = lines[0].strip()
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
    """把一句里多个结束符拆成多句，并按单词数分配时间"""
    parts = re.split(r"([.?!。？！])", text)  # 按结束符切分
    chunks = []
    buffer = ""
    for p in parts:
        if not p.strip():
            continue
        buffer += p
        if p in SENT_END_CHARS:  # 碰到结束符就输出
            chunks.append(buffer.strip())
            buffer = ""
    if buffer:  # 如果最后还有残余（没有结束符的）
        chunks.append(buffer.strip())

    # 时间分配
    total_duration = end - start
    total_words = sum(len(c.split()) for c in chunks) or 1
    avg_word_time = total_duration / total_words

    result = []
    cur_start = start
    for c in chunks:
        word_count = len(c.split()) or 1
        cur_end = cur_start + word_count * avg_word_time
        result.append((cur_start, cur_end, c))
        cur_start = cur_end
    return result

def merge_sentences(entries):
    merged = []
    cache = []
    for start, end, text in entries:
        cache.append((start, end, text))
        if text and text[-1] in SENT_END_CHARS:
            new_start = cache[0][0]
            new_end = cache[-1][1]
            new_text = " ".join([t for _, _, t in cache])
            merged.extend(split_sentence_with_time(new_start, new_end, new_text))
            cache = []
    if cache:
        new_start = cache[0][0]
        new_end = cache[-1][1]
        new_text = " ".join([t for _, _, t in cache])
        merged.append((new_start, new_end, new_text))
    return merged

def process_file(file_path: str):
    if not file_path.lower().endswith(".srt"):
        return
    try:
        entries = read_srt(file_path)
        merged_entries = merge_sentences(entries)
        dir_name = os.path.dirname(file_path)
        base, ext = os.path.splitext(os.path.basename(file_path))
        output_path = os.path.join(dir_name, f"{base}-Merge{ext}")
        write_srt(merged_entries, output_path)
        print(f"✅ 处理完成: {output_path}")
    except Exception as e:
        print(f"❌ 处理失败 {file_path}: {e}")

def process_path(path: str):
    if os.path.isfile(path):
        process_file(path)
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for name in files:
                process_file(os.path.join(root, name))
    else:
        print(f"⚠️ 输入路径无效: {path}")

if __name__ == "__main__":
    # 👉 修改这里的路径，可以是文件或文件夹
    input_path = "/Users/jiangsai/Downloads/[English (auto-generated)] PTS M1 6、A Beginners Guide to Trading Psychology [DownSub.com].srt"
    process_path(input_path)
