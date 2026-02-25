import os
import whisper
import srt
import datetime
from tqdm import tqdm

# 支持的文件扩展名
_SUPPORTED_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.m4a')

def _transcribe_and_save_srt(file_path: str, output_dir: str, model_name: str, model):
    """
    使用本地安装的 Whisper 模型转录文件并保存为 SRT 格式。
    """
    base_name = os.path.basename(file_path)
    print(f"\n--- 🚀 正在处理文件: {base_name} (模型: {model_name}) ---")
    
    try:
        # 1. 调用本地 Whisper 模型进行转录
        result = model.transcribe(
            file_path, 
            verbose=False, # 隐藏详细输出
            language="zh", # 明确指定语言为中文
        )
        
        if not result.get('segments'):
            print(f"❌ 转录结果中未找到 segments 数据，跳过文件 {base_name}。")
            return

        # 2. 构造 SRT 内容
        subtitles = []
        for i, segment in enumerate(result['segments']):
            start_time = datetime.timedelta(seconds=segment['start'])
            end_time = datetime.timedelta(seconds=segment['end'])
            
            sub = srt.Subtitle(
                index=i + 1,
                start=start_time,
                end=end_time,
                content=segment['text'].strip(),
            )
            subtitles.append(sub)

        # 3. 确定输出路径并保存 SRT 文件
        output_srt_path = os.path.join(output_dir, os.path.splitext(base_name)[0] + ".srt")
        
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        srt_content = srt.compose(subtitles) 
        
        with open(output_srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
            
        print(f"✅ 成功保存字幕到: {output_srt_path}")

    except Exception as e:
        print(f"❌ 处理文件 {base_name} 时发生错误: {e}")


def _process_directory(input_dir: str, output_dir: str, model_name: str):
    """
    遍历输入目录，加载模型，并进行批量转录。
    """
    if not os.path.isdir(input_dir):
        print(f"错误：输入路径 '{input_dir}' 不是一个有效的目录。")
        return

    # 1. 查找所有符合条件的文件
    files_to_transcribe = []
    for item in os.listdir(input_dir):
        file_path = os.path.join(input_dir, item)
        if os.path.isfile(file_path) and item.lower().endswith(_SUPPORTED_EXTENSIONS):
            files_to_transcribe.append(file_path)

    if not files_to_transcribe:
        print(f"在目录 '{input_dir}' 中未找到支持的媒体文件。")
        return

    print(f"\n找到 {len(files_to_transcribe)} 个文件待转录。")

    # 2. 加载模型 (只需加载一次)
    print(f"--- ⚙️ 载入本地 Whisper 模型: {model_name}... ---")
    try:
        model = whisper.load_model(model_name)
    except Exception as e:
        print("❌ 载入模型失败：'tiny', 'base', 'small', 'medium', 'large'")
        return

    # 3. 批量转录文件
    for file_path in tqdm(files_to_transcribe, desc="总进度"):
        _transcribe_and_save_srt(file_path, output_dir, model_name, model)

    print("\n🎉 所有文件转录完成！")


# --- 用户交互和参数传入 (核心暴露区域) ---
if __name__ == "__main__":
    input_dir = "/Users/jiangsai/Downloads/ICT" # 包含要转录的视频/音频文件的目录路径
    output_dir = "./srt_output" # 默认输出到脚本所在目录的 srt_output 子文件夹
    model_name = "turbo" # "tiny", "base", "small", "medium", "large", "turbo"
    # 英语语料时，.en 模型表现更好，tiny.en；base.en；small.en；medium.en（small.en 和medium.en差不多）
    # turbo 模型是 Large-v3 的优化版本，可提供更快的转录速度，同时将准确性降低最小化。

    _process_directory(input_dir,output_dir,model_name)