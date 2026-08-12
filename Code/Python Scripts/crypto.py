import requests, time, smtplib, datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# 邮件发送函数
def send_mail(subject, body, to_email):
    # 邮件服务器配置
    from_email = "jiangsai0502@gmail.com" # 发件人邮箱
    # 1. 开启两步验证
    # 2. 在https://myaccount.google.com/u/6/apppasswords?gar=1，创建一个应用特定密码
    from_email_password = "ygms zuth hmyd rgsm"
    mail_server = "smtp.gmail.com"  # 发件人邮箱SMTP服务器地址
    mail_port = 587  # SMTP端口
    
    # 构造邮件内容
    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(mail_server, mail_port)
        server.starttls()
        server.login(from_email, from_email_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        print("✅ 邮件已发送！")
    except Exception as e:
        print(f"❌ 发送邮件出错：{e}")

# 获取加密货币价格
def get_crypto_price(symbol):
    url = "https://api.binance.com/api/v3/ticker/price"
    params = {"symbol": symbol}
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return float(data["price"])
    except Exception as e:
        print(f"获取 {symbol} 价格失败：{e}")
    return None

# 判断是否是整点或半点
def is_summary_time():
    now = datetime.datetime.now()
    # return now.minute in [0, 30] and now.second < 10  # 前10秒内触发
    return now.minute % 5 == 0 and now.second < 10  # 测试每5分钟发一次，前10秒内触发

# 主循环
def monitor_crypto():
    crypto_symbols = {
        "BTCUSDT": {"min_price": 25000, "max_price": 130000},
        "ETHUSDT": {"min_price": 1800, "max_price": 3000}
    }

    to_email = "jiangsai0502@outlook.com"

    # 初始化状态缓存
    hit_count = {symbol: 0 for symbol in crypto_symbols}
    triggered = set()
    last_summary_minute = -1  # 避免一分钟内重复发邮件

    while True:
        now = datetime.datetime.now()

        for symbol, price_range in crypto_symbols.items():
            price = get_crypto_price(symbol)
            if price is None:
                continue

            in_range = price_range["min_price"] <= price <= price_range["max_price"]

            if in_range:
                hit_count[symbol] += 1
                if hit_count[symbol] >= 15:
                    triggered.add(symbol)
            else:
                hit_count[symbol] = 0  # 一旦脱离区间就清零

        # 整点/半点并且触发币种非空，且不是刚发过邮件
        if is_summary_time():
            current_minute = now.minute
            if triggered and current_minute != last_summary_minute:
                body = "以下币种在过去检测中满足价格条件：\n\n"
                for symbol in triggered:
                    body += f"- {symbol}: 当前价格为 {get_crypto_price(symbol)}，超过15次在目标范围内\n"
                subject = f"📈 加密货币价格提醒（{now.strftime('%H:%M')}）"
                print(f"当前时间：{now.strftime('%H:%M')}")
                print(f"邮件内容：\n{body}")
                # send_mail(subject, body, to_email)
                triggered.clear()
                hit_count = {symbol: 0 for symbol in crypto_symbols}
                last_summary_minute = current_minute

        time.sleep(2)  # 每10秒检测一次

# 主函数入口
if __name__ == "__main__":
    monitor_crypto()