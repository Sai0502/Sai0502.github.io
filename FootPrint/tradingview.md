1. 回放时，早晨8点展示1条黑线

   > ```bash
   > //@version=5
   > indicator("早晨8点", overlay=true)
   > 
   > // 设置目标时间：每天的 8 点
   > targetHour = 0
   > targetMinute = 0
   > 
   > // 使用 `var` 关键字创建并初始化一个线条对象
   > // `var` 变量只会在脚本第一次加载时初始化一次
   > var line future8AMLine = na
   > 
   > // 在脚本第一次运行时，或者当 `future8AMLine` 为 `na` 时，创建线条
   > if na(future8AMLine)
   >     future8AMLine := line.new(x1=time, y1=low, x2=time, y2=high, // 初始位置不重要，之后会更新
   >                              color=color.black, style=line.style_solid, width=1, xloc=xloc.bar_time)
   > 
   > // --- 核心逻辑：计算并更新线条位置及可见性 ---
   > 
   > // 1. 获取当前 K 线的日期和时间信息
   > currentYear = year(time)
   > currentMonth = month(time)
   > currentDayOfMonth = dayofmonth(time)
   > currentHour = hour(time)
   > currentMinute = minute(time)
   > 
   > // 2. 构建当前 K 线所在日期的 8 AM 时间戳
   > today8AMTimestamp = timestamp(currentYear, currentMonth, currentDayOfMonth, targetHour, targetMinute, 0)
   > 
   > // 3. 确定要显示的目标时间戳
   > int targetDisplayTimestamp = na
   > 
   > // 判断当前 K 线时间是否已经过了当天的 8 AM
   > // 如果当前 K 线时间严格在今天 8 AM 之后 (或等于 8 AM)
   > if currentHour > targetHour or (currentHour == targetHour and currentMinute >= targetMinute)
   >     // 那么我们要显示的是“明天”的 8 AM 的线
   >     targetDisplayTimestamp := timestamp(currentYear, currentMonth, currentDayOfMonth + 1, targetHour, targetMinute, 0)
   > else
   >     // 如果当前 K 线时间还在今天 8 AM 之前
   >     // 并且根据您的要求：“早晨8点的时候，不展示任何黑线”
   >     // 所以在这种情况下，我们将线条隐藏
   >     targetDisplayTimestamp := na // 设置为 na 表示不指向任何有效时间点
   > 
   > // 4. 更新线条的位置和可见性
   > if na(targetDisplayTimestamp) // 如果目标时间戳无效（即不应该显示线）
   >     line.set_color(future8AMLine, color.rgb(0,0,0,0)) // 设置为完全透明以隐藏
   > else
   >     // 否则，更新线条位置并显示
   >     line.set_x1(future8AMLine, targetDisplayTimestamp)
   >     line.set_x2(future8AMLine, targetDisplayTimestamp)
   >     line.set_y1(future8AMLine, low - 5000)
   >     line.set_y2(future8AMLine, high + 5000)
   >     line.set_color(future8AMLine, color.black) // 显示黑色
   > ```

2. ATR止损通道

   > ```bash
   > //@version=5
   > indicator("ATR止损通道", overlay=true)
   > 
   > // 参数设置
   > atrLength = input.int(14, title="ATR周期")
   > mult = input.float(1.0, title="ATR倍数")  // 可调节倍数
   > 
   > // 计算ATR
   > atrValue = ta.atr(atrLength)
   > 
   > // 当前K线极值点
   > highPoint = high
   > lowPoint = low
   > 
   > // 止损通道线
   > upperStop = highPoint + mult * atrValue  // 空头止损线
   > lowerStop = lowPoint - mult * atrValue  // 多头止损线
   > 
   > // 绘图
   > plot(upperStop, color=color.red, title="空头止损线")
   > plot(lowerStop, color=color.green, title="多头止损线")
   > ```
   >
   > 