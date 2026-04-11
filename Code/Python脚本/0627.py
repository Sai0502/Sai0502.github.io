import os
import re

# ====== 文件夹路径 ======
folder_path = "/Users/jiangsai/Downloads/弗里东讲ICT_副本"  # 改成你的目录

# ====== 目标文件名列表 ======
target_names = [
    "001 - 第1集 2022模型概述.mp4",
    "002 - 第2集 Setup的要素.mp4",
    "003 - 第3集 内部流动性和市场结构转换.mp4",
    "004 - 编者语.mp4",
    "005 - 第4集 内部流动性和结构转换实例讲解.mp4",
    "006 - 第5集 日内订单流&理解日内区间.mp4",
    "007 - 实例讲解.mp4",
    "008 - 第6集 市场运行模式和机构订单流.mp4",
    "009 - 第7集 日内偏见和盘整.mp4",
    "010 - 第8集 机构订单流在外汇市场的应用.mp4",
    "011 - 第9集 po3和纽约下午场机会.mp4",
    "012 - 第10集  如何使用财经日历事件.mp4",
    "013 - 第11集  分析技巧梳理回顾.mp4",
    "014 - 第12集  市场结构 高阶价格行为理论.mp4",
    "015 - 第13集  市场结构 高阶价格行为理论应用.mp4",
    "016 - 第14集   实盘演示—如何使用2022模型.mp4",
    "017 - 第15集   实盘账户演示.mp4",
    "018 - 第16集  在交易时段寻找sit up.mp4",
    "019 - 第17集 如何在外汇市场使用2022模型.mp4",
    "020 - 第18集 如何设置盘面图表.mp4",
    "021 - 第19集 学习如何阅读市场.mp4",
    "022 - 第20集 做市商模型.mp4",
    "023 - 第21集 回测分析美元指数.mp4",
    "024 - 第22集 Emini标普分析.mp4",
    "025 - 第23集 E-mini Micro NASDAQ分析.mp4",
    "026 - 第24集 正确的心态.mp4",
    "027 - 第25集 ICT订单流—SMC订单流.mp4",
    "028 - 第26集 ICT订单流—SMC订单流.mp4",
    "029 - 第27集 ICT订单流—SMC订单流.mp4",
    "030 - 第28集 ICT订单流—SMC订单流.mp4",
    "031 - 第29集 ICT订单流—SMC订单流.mp4",
    "032 - 第30集 ICT订单流—SMC订单流.mp4",
    "033 - 第31集 ICT订单流—SMC订单流.mp4",
    "034 - 第32集 ICT订单流—SMC订单流.mp4",
    "035 - 第33集 ICT订单流—SMC订单流.mp4",
    "036 - 第34集 ICT订单流—SMC订单流.mp4",
    "037 - 第35集 ICT订单流—SMC订单流.mp4",
    "038 - 第36集 复盘 E-mini标准普尔.mp4",
    "039 - 第37集 复盘标普6月合约.mp4",
    "040 - 第38集  盘中概况和日内区间.mp4",
    "041 - 第39集  订单流复盘细节.mp4",
    "042 - 第40集  订单流课程总结1.mp4",
]

# ====== 提取“第X集” ======
pattern = re.compile(r"第\s*(\d+)\s*集")

# ====== 建立“第X集 → 文件名”映射 ======
target_map = {}

for name in target_names:
    match = pattern.search(name)
    if match:
        episode = int(match.group(1))
        target_map[episode] = name

# ====== 遍历源文件 ======
for filename in os.listdir(folder_path):
    if not filename.endswith(".mp4"):
        continue

    match = pattern.search(filename)
    if not match:
        print(f"跳过（未识别集数）: {filename}")
        continue

    episode = int(match.group(1))

    if episode not in target_map:
        print(f"跳过（未找到目标）: {filename}")
        continue

    old_path = os.path.join(folder_path, filename)
    new_filename = target_map[episode]
    new_path = os.path.join(folder_path, new_filename)

    # 防止覆盖
    if os.path.exists(new_path):
        print(f"跳过（已存在）: {new_filename}")
        continue

    os.rename(old_path, new_path)

    print(f"重命名成功：")
    print(f"  原文件名：{filename}")
    print(f"  新文件名：{new_filename}")
    print("-" * 50)

print("全部处理完成！")