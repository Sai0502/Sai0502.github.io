### B站-记录订单流的每一天

1. 基础设置

   1. 语言设置：右上角菜单 - 语言 - 简体中文
   2. 时区：默认纽约时间，点击后面的时钟可设为本地市区
   3. 连接数据源：
      1. 自带数据源：
         1. ATAS Sim (15-min delayed)：期货模拟账户连接，比真实市场延迟15分钟。
         2. dxFeed (15-min delayed)：dxFeed数据源连接，比真实市场延迟15分钟。
         3. Crypto Sim：数字货币的模拟账户链接，好像是没有延迟的。
         4. Binance：币安的数据源连接好像也没有延迟。
      2. 自己申请的数据源
         1. 白嫖Rithmic：见 veilflow
         2. 购买defeed：
   4. 学习技巧：「有道词典」，截屏翻译
   5. 快捷键：右上角菜单 → 设置 → 快捷键（推荐：平仓设为 回车键，实现快速平仓）

2. Atas 图表类型

   | 类型              | 说明         | 用途                              |
   | ----------------- | ------------ | --------------------------------- |
   | 图表              | K线主图      | 价格走势分析                      |
   | 市场深度 （没用） | DOM深度图    | 盘口挂单与成交明细                |
   | 智能 Tape（没用） | 逐笔成交打印 | 高频交易参考（日内/中线用处不大） |
   | Bid/Ask Tape      | 不知道       |                                   |
   | 所有价格          | 不知道       |                                   |
   | Heatmap           | 不知道       |                                   |

3. 模板应用

   1. 模板格式

      1. `.cts`： 图表模板（指标、颜色、Footprint、VP、VWAP 等）
      2. `.ws`和`.aws`： 整个工作区布局（数据源、窗口、品种、布局、图标模板等）

   2. `.cts文件`导入

      窗口 → 右键 → 设置 → 模板tab → 底部栏「导入」 → `.cts`

      → 双击覆盖 → 在模板列表中找到`Atas-Deepchart-theme` → 双击 → 选择要应用的部分

      ![longshot20260725185055](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607251852109.png)

   3. `.ws文件`和`.aws文件`导入

      顶部栏「工作区」 → 加载  → `.ws`和`.aws`

4. 图表基础操作

   1. 图表加载多少天历史数据

      * 图表顶部 Time 区域（1m、5m 那个区域） → 进入：✅Set dates → Days count 就是加载天数

   2. 在当前tab复制一个一摸一样的新页面

      * 页面右键 → 克隆 → 新窗口左上角可变更品种

   3. 在当前window复制一个一摸一样的新tab

      * tab右键 → 克隆 → 新tab的窗口左上角可变更品种

   4. 图表基本设置

      ![image-20260728221858398](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607282218499.png)

   5. 订单轨迹的显示模式

      | 模式                  | 特点                               |
      | --------------------- | ---------------------------------- |
      | **Bid × Ask**（默认） | 左边 Bid，右边 Ask，最常用         |
      | **Bid × Ask Delta**   | 加入 Delta 差值                    |
      | **William Trader**    | 威廉姆交易量显示                   |
      | **Delta**             | 逐 Tick 级别 Delta 值              |
      | **其他组合**          | 能量条、Profile、Tick 交易量叠加等 |

      - **去中间差**：右键 → 集群设置 → 内容模式 → 关闭中间差显示

   6. 交易量分布指标 Volume Profile & TPO（4种）

      1. 顶部指标集
         1. Volume Profile & TPO（不常用）：搜索该名称，双击增加进来；展示固定周期的每一个 VP
      2. 左侧指标列表 Volume Analysis 
         1. Volume Profile & TPO（常用）：手动选中任意范围，背景上展示其 VP
         2. Fixed Volume Profile & TPO（不常用）：展示最近1个指定周期的 VP
         3. Anchored Volume Profile & TPO（不常用）：圈定任意范围，屏幕左侧/右侧展示其 VP
      3. Volume Profile & TPO 通用设置（例：4小时内的成交量分布）
         1. Data数据：Common常规设置 → Mode模式 → Profile
         2. Data：Common → External period 时间周期 → H4
         3. Visualization视觉化：Common常规设置 → Area Color区域颜色 → 透明度：调成0
         4. Visualization：Common → Draw above price在价格上方绘制：不勾选（压在K线下面）
         5. Visualization：Profile. Colors → Profile. Colors：蓝色
         6. Visualization：Profile. Colors → Visualization Mode可视化模式：Bars条形图
         7. Visualization：Profile. Colors → Gradient渐变：勾选
      4. 疑问：
         1. Data数据：Filter过滤：干啥的，好像会加重某些区域的颜色

   7. VWAP：比均线更强，将成交量纳入计算，可替代传统均线

      ![image-20260729110120142](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607291101201.png)

5. **下单（下面的不准，要单独找教程）**

   1. 调出交易栏：图标右键 → Chart Trader
   2. 交易栏
      1. 订单管理
         - Clear Bid：关闭限价买单挂单
         - Clear Ask：关闭限价卖单挂单
         - Clear All：关闭所有限价挂单
         - Close：平仓 / 关闭所有订单
         - 反向交易：平仓同时，自动下反向市价单
      2. 退出策略：自动止盈止损

         1. 点击 ▲ 打开设置 → 选择策略类型（最常用：固定止盈止损）
         2. 示例：止盈 30 Tick，止损 10 Tick
         3. 特性：
            - 下市价单成交后，自动挂上止盈止损
            - 下限价单成交后，才会显示并挂上止盈止损
            - 可手动拖动止盈止损价位调整
            - 平仓后，对应的止盈止损自动取消
      3. 图表交易
         - 默认关闭，可开启后在 K线图上点击 `Buy` / `Sell` 下单
         - 操作较麻烦，一般不使用
      4. 订单有效期
         - GTC（Good Till Cancelled）：订单一直有效，必须手动平仓，否则永久存在
         - Day：当天有效，美国市场收盘后自动平仓所有单（含浮动盈亏、限价单）
      5. 账户选择
         - `Demo`：软件自带模拟账户
         - 下方：实盘期货账户（需提前开户并连接）

6. 订单轨迹

   ![image-20260728191020343](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607281910418.png)

   1. 左卖右买

      |              | 代表方向   | 具体含义                                             |
      | ------------ | ---------- | ---------------------------------------------------- |
      | **左边数字** | **主动卖** | 卖方主动吃掉买方的**限价挂单**，即主动卖出成交的数量 |
      | **右边数字** | **主动买** | 买方主动吃掉卖方的**限价挂单**，即主动买入成交的数量 |

   2. 失衡（Imbalance）

      > **关键：不是横向对比，而是斜对角对比**
      >
      > ```bash
      >        买 3
      > 卖 3   买 2
      > 卖 2   买 1
      > 卖 1
      > ```

      1. 判定标准

         | 类型             | 判定条件                                                   | 视觉表现             |
         | ---------------- | ---------------------------------------------------------- | -------------------- |
         | **2 倍失衡**     | 某价位成交量 > 前一位的 2 倍                               | 数字变**红色**       |
         | **3 倍买方失衡** | 连续 3 个以上价位，买方成交量 **3 倍于**斜对角的卖方成交量 | 形成连续的买方力量带 |
         | **3 倍卖方失衡** | 连续 3 个以上价位，卖方成交量 **3 倍于**斜对角的买方成交量 | 形成连续的卖方力量带 |

      2. 实战意义：连续失衡带 FVG，一般用3～4个连续失衡做信号

      3. 用法：顶部栏「指标集」 → Stacked Imbalance

         ![image-20260727174014636](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607271740697.png)

   3. POC（Point of Control / 控制点）

      1. 定义：每根 K 线都有且只有一个，代表该 K 线内，成交量最大的价位

      2. 意义

         | POC 位置   | 收盘价位置         | 含义                                                         |
         | ---------- | ------------------ | ------------------------------------------------------------ |
         | 下影线里   | 收在高位，远离 POC | 下方成交最多，但价格被强行推到高位 <br />→ **强势多头**，可能是反转信号 |
         | 上影线里   | 收在低位，远离 POC | 与上反之                                                     |
         | 接近收盘价 | 靠近 POC           | 多空力量均衡，短期偏震荡                                     |

   4. Delta

      1. 

7. DOM（Depth of Market 市场深度）

   1. 作用：展示当前价格上下方，挂着多少“等待成交”的限价买单和限价卖单。

   2. Footprint vs DOM

      1. Footprint：看“已经成交了什么”
      2. DOM：看“现在市场上挂着什么”

   3. 用法：顶部栏「指标集」 → Depth of Market

      ![image-20260728182011368](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202607281820481.png)

8. 