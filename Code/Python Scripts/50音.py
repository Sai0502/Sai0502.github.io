import random
from pynput import keyboard
import re

PingJia = [
    "あ","い","う","え","お",
    "か","き","く","け","こ",
    "さ","し","す","せ","そ",
    "た","ち","つ","て","と",
    "な","に","ぬ","ね","の",
    "は","ひ","ふ","へ","ほ",
    "ま","み","む","め","も",
    "や","ゆ","よ",
    "ら","り","る","れ","ろ",
    "わ","を","ん"
]

PianJia = [
    "ア","イ","ウ","エ","オ",
    "カ","キ","ク","ケ","コ",
    "サ","シ","ス","セ","ソ",
    "タ","チ","ツ","テ","ト",
    "ナ","ニ","ヌ","ネ","ノ",
    "ハ","ヒ","フ","ヘ","ホ",
    "マ","ミ","ム","メ","モ",
    "ヤ","ユ","ヨ",
    "ラ","リ","ル","レ","ロ",
    "ワ","ヲ","ン"
]

ZhuoHua = [
    "が", "ガ", "ぎ", "ギ", "ぐ", "グ", "げ", "ゲ", "ご", "ゴ",
    "ざ", "ザ", "じ", "ジ", "ず", "ズ", "ぜ", "ゼ", "ぞ", "ゾ",
    "だ", "ダ", "ぢ", "ヂ", "づ", "ヅ", "で", "デ", "ど", "ド",
    "ば", "バ", "び", "ビ", "ぶ", "ブ", "べ", "ベ", "ぼ", "ボ",
    "ぱ", "パ", "ぴ", "ピ", "ぷ", "プ", "ぺ", "ペ", "ぽ", "ポ"
]

AoYin = [
    "きゃ", "キャ", "きゅ", "キュ", "きょ", "キョ",
    "ぎゃ", "ギャ", "ぎゅ", "ギュ", "ぎょ", "ギョ",
    "しゃ", "シャ", "しゅ", "シュ", "しょ", "ショ",
    "じゃ", "ジャ", "じゅ", "ジュ", "じょ", "ジョ",
    "ちゃ", "チャ", "ちゅ", "チュ", "ちょ", "チョ",
    "にゃ", "ニャ", "にゅ", "ニュ", "にょ", "ニョ",
    "ひゃ", "ヒャ", "ひゅ", "ヒュ", "ひょ", "ヒョ",
    "びゃ", "ビャ", "びゅ", "ビュ", "びょ", "ビョ",
    "ぴゃ", "ピャ", "ぴゅ", "ピュ", "ぴょ", "ピョ",
    "みゃ", "ミャ", "みゅ", "ミュ", "みょ", "ミョ",
    "りゃ", "リャ", "りゅ", "リュ", "りょ", "リョ"
]

# 菜单映射
menu = {
    "1": ("平假名 PingJia", PingJia),
    "2": ("片假名 PianJia", PianJia),
    "3": ("浊音 ZhuoHua", ZhuoHua),
    "4": ("拗音 AoYin", AoYin)
}

def study(kana_list):
    """进入学习模式"""
    random.shuffle(kana_list)
    print("按空格键显示一个假名（无重复）。按 ESC 键退出学习，返回选择界面。\n")

    def on_press(key):
        nonlocal kana_list
        # ESC 退出学习
        if key == keyboard.Key.esc:
            print("退出学习，返回选择界面。\n")
            return False
        # 空格显示假名
        if key == keyboard.Key.space:
            if kana_list:
                kana = kana_list.pop()
                print("👉", kana)
            else:
                print("\n所有假名都已经显示完了！返回选择界面。\n")
                return False

    with keyboard.Listener(on_press=on_press) as listener:
        listener.join()

def main():
    while True:
        print("请选择学习内容：")
        for k, v in menu.items():
            print(f"{k}. {v[0]}")
        print("输入 q 退出程序。")

        choice = input("请输入编号：").strip()
        # 去掉控制字符，只保留数字和字母
        choice = re.sub(r"[^\w]", "", choice)

        if not choice:
            continue
        elif choice.lower() == "q":
            print("已退出程序。")
            break
        elif choice in menu:
            _, kana_list = menu[choice]
            study(kana_list.copy())
        else:
            print("无效选择，请重新输入。\n")

if __name__ == "__main__":
    main()
