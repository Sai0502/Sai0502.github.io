import requests
import datetime
import subprocess
import time

# 获取经济日历（这里用Trading Economics API的公开接口）
API_URL = "https://api.tradingeconomics.com/calendar?c=guest:guest&f=json"

def get_today_events():
    today = datetime.date.today().strftime("%Y-%m-%d")
    events = []
    try:
        resp = requests.get(API_URL, timeout=10)
        data = resp.json()
        for item in data:
            if "date" not in item:
                continue
            if item["date"].startswith(today) and item.get("importance") == 3:  # 3 = 高影响
                time_str = item.get("date", "").split("T")[-1][:5]  # 提取时间 HH:MM
                country = item.get("country", "")
                event = item.get("event", "")
                events.append(f"{time_str} - {country}: {event}")
    except Exception as e:
        events.append(f"获取失败: {e}")
    return events

def send_notification(message):
    script = f'display notification "{message}" with title "今日财经日历提醒"'
    subprocess.run(["osascript", "-e", script])

if __name__ == "__main__":
    events = get_today_events()
    if events:
        msg = "\n".join(events[:5])  # 只显示前5个，避免太长
    else:
        msg = "今天没有高影响数据"
    print(msg)


    notify_times = ["19:00", "19:30", "20:00"]

    while True:
        now = datetime.datetime.now().strftime("%H:%M")
        if now in notify_times:
            events = get_today_events()
            if events:
                msg = "\n".join(events[:5])  # 只显示前5个，避免太长
            else:
                msg = "今天没有高影响数据"
            send_notification(msg)
            time.sleep(60)  # 避免同一分钟多次提醒
        time.sleep(20)
