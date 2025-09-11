import os

# 数字
num_collection = ["一", "二", "两", "三", "四", "五", "六", "七", "八", "九", "十"]
# 数字单位进制
num_units = ["零", "百", "千", "万", "亿"]
# 汉字与数字的对应关系
num_dict = {
    "零": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
    "百": 100,
    "千": 1000,
    "万": 10000,
    "亿": 100000000,
}


# 1.从文本中提取数字
def GetChNumber(OriginalStr):
    # 初始化变量
    finalStr = ""  # 最终文本
    CurrentIsNum = False  # 有无汉字数字
    CurrentNum = ""  # 中文数字

    lenStr = len(OriginalStr)  # 文本长度
    for index in range(lenStr):  # 从原文本逐个取字符
        if OriginalStr[index] in num_collection:  # 判断第index个字符是数字
            CurrentNum = CurrentNum + OriginalStr[index]  # 拼接中文数字
            if not CurrentIsNum:
                CurrentIsNum = True
        else:
            if CurrentIsNum:
                if OriginalStr[index] in num_units:  # 判断第index个字符是否数字单位进制
                    CurrentNum = CurrentNum + OriginalStr[index]
                    continue  # 结束本次for循环，进入下一个index
                else:  # 若原字符串包含非数字
                    numResult = str(ChToDigit(CurrentNum))  # 中文数字转阿拉伯数字
                    # 重新初始化
                    CurrentIsNum = False
                    CurrentNum = ""
                    finalStr = finalStr + numResult
            finalStr = finalStr + OriginalStr[index]
    # 若原字符串全是数字
    if len(CurrentNum) > 0:
        numResult = ChToDigit(CurrentNum)
        finalStr = finalStr + str(numResult)
    return finalStr


def ChToDigit(CurrentNum):
    total = 0
    r = 1  # 表示单位：个十百千...
    for i in range(len(CurrentNum) - 1, -1, -1):
        val = num_dict.get(CurrentNum[i])
        if val >= 10 and i == 0:  # 应对 十三 十四 十*之类
            if val > r:
                r = val
                total = total + val
            else:
                r = r * val
                # total =total + r * x
        elif val >= 10:
            if val > r:
                r = val
            else:
                r = r * val
        else:
            total = total + r * val
    return total


if __name__ == "__main__":
    Dir = "/Users/jiangsai/Desktop/smc基础课程"
    # os.walk()产生3-元组 (dirpath, dirnames,folder_names)【文件夹路径, 文件夹名字, 文件名】
    g = os.walk(Dir)

    for path, dir_list, file_list in g:
        # 去除系统文件.DS_Store
        if ".DS_Store" in file_list:
            file_list.remove(".DS_Store")
        if file_list:
            # 文件排序，保证原始文件名从小到大
            file_list.sort()
            folder_name = path.split("/")[-1]
            for f_name in file_list:
                # 利用 os.path.join() 拼接成完整文件名
                old_name = os.path.join(path, f_name)
                f_name = GetChNumber(f_name)
                new_name = os.path.join(path, f_name)
                os.rename(old_name, new_name)
