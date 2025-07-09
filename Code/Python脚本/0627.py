from websocket import create_connection

try:
    ws = create_connection("wss://data.tradingview.com/socket.io/websocket", http_proxy_host="127.0.0.1", http_proxy_port=8234, timeout=10)
    print("连接成功！")
    ws.close()
except Exception as e:
    print(f"连接失败：{e}")
