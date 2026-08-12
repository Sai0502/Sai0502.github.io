"""
Trading‑View 迷你黄金MGC1! 5分钟K线抓取工具
依赖：tvdatafeed、pandas；自动选取昨日/今日18点至今行情，输出控制台并导出CSV
"""
from tvdatafeed import TvDatafeed, Interval
import pandas as pd
from datetime import datetime, timedelta
import time

# 初始化（无需登录也能用，推荐登录以获取更多数据）
tv = TvDatafeed()  # 如果有账号：TvDatafeed(username="你的用户名", password="你的密码")

# 参数设置
symbol = "MGC1!"          # 连续合约，TradingView常用符号
exchange = "COMEX_MINI"   # 或试试 "CME" / "COMEX"
interval = Interval.in_5_minute

# 时间范围：今天18:00到现在（北京时间）
end_time = datetime.now()
start_time = datetime.now().replace(hour=18, minute=0, second=0, microsecond=0)

# 如果今天还没到18:00，就取昨天18:00
if end_time.hour < 18:
    start_time = start_time - timedelta(days=1)

print(f"获取时间范围: {start_time} 到 {end_time}")

# 获取数据（n_bars最多5000，足够5分钟K线）
data = tv.get_hist(
    symbol=symbol,
    exchange=exchange,
    interval=interval,
    n_bars=500,          # 调大一些，确保覆盖时间范围
    extended_session=False
)

# 过滤时间范围
if data is not None and not data.empty:
    data = data[(data.index >= start_time) & (data.index <= end_time)]
    
    # 重命名列为中文方便查看
    data = data.rename(columns={
        'open': '开盘价',
        'high': '最高价',
        'low': '最低价',
        'close': '收盘价',
        'volume': '成交量'
    })
    
    print(f"\n共获取 {len(data)} 根5分钟K线：")
    print(data[['开盘价', '最高价', '最低价', '收盘价', '成交量']])
    
    # 保存到CSV
    filename = f"mgc_5min_{start_time.strftime('%Y%m%d')}.csv"
    data.to_csv(filename, encoding='utf-8-sig')
    print(f"\n数据已保存到：{filename}")
else:
    print("未获取到数据，请检查符号/网络")

# 显示最新几根
if not data.empty:
    print("\n最近5根K线：")
    print(data[['开盘价', '最高价', '最低价', '收盘价']].tail())