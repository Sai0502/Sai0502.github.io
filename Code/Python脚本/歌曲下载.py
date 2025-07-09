import requests

# 设置API地址和参数
api_url = "http://127.0.0.1:9880/tts"
data = {
    "text": "要想成为一名成功的交易者，对市场的理解就必须比你的竞争对手更深入。运用计算机可以更深入地分析市场。市场上与你竞争的许多交易者都已经有了计算机。",  # 要合成的文本
    "text_lang": "zh",  # 文本语言
    "ref_audio_path": "/Users/jiangsai/Downloads/GPT-SoVITS/output/slicer_opt/十年一梦.wav",  # 参考音频路径
    "prompt_text": "经历过一场艰难岁月时期的操盘手，我的内心无疑充满了激动和兴奋",  # 参考文本
    "prompt_lang": "zh"  # 参考文本语言
}

# 发送 POST 请求
response = requests.post(api_url, json=data)

# 检查响应
if response.status_code == 200:
    # 保存生成的音频
    with open("output.wav", "wb") as f:
        f.write(response.content)
    print("音频已保存为 output.wav")
else:
    print(f"请求失败，状态码：{response.status_code}")
    print("响应内容：", response.text)




### 下载歌曲
# import os
# import yt_dlp
# from datetime import datetime

# # 读取歌曲名称列表
# songs = [
#     "痴心绝对	李圣杰",
#     "小情歌	苏打绿",
#     "童话	光良",
#     "威尼斯的泪	永邦",
#     "我可以	蔡旻佑",
#     "平凡之路	朴树",
#     "起风了	",
#     "飞鸟与蝉	任然",
#     "我曾	",
#     "南征北战	",
#     "谁明浪子心	王杰",
#     "一生中所爱	谭咏麟",
#     "朋友	谭咏麟",
#     "敢爱敢做	林子祥",
#     "偏偏喜欢你	陈百强",
#     "几许风雨	罗文",
#     "无赖	郑中基",
#     "一生所爱	卢冠庭",
#     "沉默是金	张国荣",
#     "饿狼传说	张学友",
#     "铁血丹心	罗文/甄妮",
#     "千千阙歌	",
#     "偷心	张学友",
#     "安妮	王杰",
#     "月半小夜曲	李克勤",
#     "一生何求	陈百强",
#     "难得有情人	关淑怡",
#     "雨中的恋人	黄凯芹",
#     "最爱	周慧敏",
#     "痴心换情深	周慧敏",
#     "讲不出再见	谭咏麟",
#     "十七岁	刘德华",
#     "我们的爱	飞儿乐队",
#     "你的微笑	飞儿乐队",
#     "千年之恋	飞儿乐队",
#     "Lydia	飞儿乐队",
#     "去大理	郝云",
#     "旅行	许巍",
#     "加州旅馆	老鹰乐队",
#     "此情可待	理查德马克思",
#     "布列瑟农	马连修恩",
#     "卡萨布兰卡	贝蒂希金斯",
#     "寂静之声	保罗西蒙",
#     "昨日重现	卡朋特乐队",
#     "we are the world	欧美群星",
#     "我会永远和你在一起	惠特尼休斯顿",
#     "country road	",
#     "five hundred miles	旅行者乐队",
#     "my love	西域男孩",
#     "cry on my shouder	",
#     "pretty boy	M2M",
#     "the day you went away	M2M",
#     "la isla bonita	",
#     "burning	",
#     "because of you	凯莉凯莱森",
#     "only love	",
#     "the nights	AVICII",
#     "hall of fame	手稿乐队",
#     "take me to your heart	",
#     "big big world	艾米莉亚",
#     "free loop	",
#     "此情永不移	George Benson",
#     "apologize	",
# ]

# # 获取今天的日期并在桌面上创建文件夹
# today_date = datetime.now().strftime("%Y-%m-%d")
# desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
# output_folder = os.path.join(desktop_path, today_date)
# os.makedirs(output_folder, exist_ok=True)


# # Bilibili 搜索并下载视频
# def download_from_bilibili(search_query):
#     ydl_opts = {
#         "format": "bestaudio/best",
#         "postprocessors": [
#             {
#                 "key": "FFmpegExtractAudio",
#                 "preferredcodec": "mp3",
#                 "preferredquality": "192",
#             }
#         ],
#         "outtmpl": os.path.join(output_folder, f"{search_query}.%(ext)s"),
#         "noplaylist": True,
#         "default_search": "ytsearch",
#         "quiet": True,
#     }

#     with yt_dlp.YoutubeDL(ydl_opts) as ydl:
#         # 使用ytsearch在YouTube上搜索
#         info = ydl.extract_info(f"ytsearch:{search_query}", download=False)["entries"][0]
#         video_url = info["webpage_url"]
#         ydl.download([video_url])


# for song in songs:
#     print(f"正在处理: {song}")
#     download_from_bilibili(song)
#     print(f"{song} 下载并转换完成")

# print(f"所有文件已保存到文件夹: {output_folder}")

### 汉字转数字
# import os

# # 数字
# num_collection = ["一", "二", "两", "三", "四", "五", "六", "七", "八", "九", "十"]
# # 数字单位进制
# num_units = ["零", "百", "千", "万", "亿"]
# # 汉字与数字的对应关系
# num_dict = {
#     "零": 0,
#     "一": 1,
#     "二": 2,
#     "两": 2,
#     "三": 3,
#     "四": 4,
#     "五": 5,
#     "六": 6,
#     "七": 7,
#     "八": 8,
#     "九": 9,
#     "十": 10,
#     "百": 100,
#     "千": 1000,
#     "万": 10000,
#     "亿": 100000000,
# }


# # 1.从文本中提取数字
# def GetChNumber(OriginalStr):
#     # 初始化变量
#     finalStr = ""  # 最终文本
#     CurrentIsNum = False  # 有无汉字数字
#     CurrentNum = ""  # 中文数字

#     lenStr = len(OriginalStr)  # 文本长度
#     for index in range(lenStr):  # 从原文本逐个取字符
#         if OriginalStr[index] in num_collection:  # 判断第index个字符是数字
#             CurrentNum = CurrentNum + OriginalStr[index]  # 拼接中文数字
#             if not CurrentIsNum:
#                 CurrentIsNum = True
#         else:
#             if CurrentIsNum:
#                 if OriginalStr[index] in num_units:  # 判断第index个字符是否数字单位进制
#                     CurrentNum = CurrentNum + OriginalStr[index]
#                     continue  # 结束本次for循环，进入下一个index
#                 else:  # 若原字符串包含非数字
#                     numResult = str(ChToDigit(CurrentNum))  # 中文数字转阿拉伯数字
#                     # 重新初始化
#                     CurrentIsNum = False
#                     CurrentNum = ""
#                     finalStr = finalStr + numResult
#             finalStr = finalStr + OriginalStr[index]
#     # 若原字符串全是数字
#     if len(CurrentNum) > 0:
#         numResult = ChToDigit(CurrentNum)
#         finalStr = finalStr + str(numResult)
#     return finalStr


# def ChToDigit(CurrentNum):
#     total = 0
#     r = 1  # 表示单位：个十百千...
#     for i in range(len(CurrentNum) - 1, -1, -1):
#         val = num_dict.get(CurrentNum[i])
#         if val >= 10 and i == 0:  # 应对 十三 十四 十*之类
#             if val > r:
#                 r = val
#                 total = total + val
#             else:
#                 r = r * val
#                 # total =total + r * x
#         elif val >= 10:
#             if val > r:
#                 r = val
#             else:
#                 r = r * val
#         else:
#             total = total + r * val
#     return total


# def main():
#     Dir = input("输入要转换的路径: ")
#     # os.walk()产生3-元组 (dirpath, dirnames,folder_names)【文件夹路径, 文件夹名字, 文件名】
#     g = os.walk(Dir)

#     for path, dir_list, file_list in g:
#         # 去除系统文件.DS_Store
#         if ".DS_Store" in file_list:
#             file_list.remove(".DS_Store")
#         if file_list:
#             # 文件排序，保证原始文件名从小到大
#             file_list.sort()
#             folder_name = path.split("/")[-1]
#             for f_name in file_list:
#                 # 利用 os.path.join() 拼接成完整文件名
#                 old_name = os.path.join(path, f_name)
#                 f_name = GetChNumber(f_name)
#                 new_name = os.path.join(path, f_name)
#                 os.rename(old_name, new_name)


# if __name__ == "__main__":
#     main()
