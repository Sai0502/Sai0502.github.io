// Tradovate 期货合约规格数据表
// tickSize:   最小变动价位
// tickValue:  每跳对应的美元价值 (核心字段，PnL 计算用)
// pointValue: 每整点对应的美元价值 (参考字段)
//
// 验证公式: tickValue == tickSize × pointValue (全部条目都需满足)

const TDV_CONTRACTS = {
  // ===== 股指 (CME) =====
  'ES':   { name: 'E-mini S&P 500',          tickSize: 0.25,     tickValue: 12.50,   pointValue: 50.00 },
  'MES':  { name: 'Micro E-mini S&P 500',    tickSize: 0.25,     tickValue: 1.25,    pointValue: 5.00 },
  'NQ':   { name: 'E-mini NASDAQ 100',       tickSize: 0.25,     tickValue: 5.00,    pointValue: 20.00 },
  'MNQ':  { name: 'Micro E-mini NASDAQ',     tickSize: 0.25,     tickValue: 0.50,    pointValue: 2.00 },
  'YM':   { name: 'E-mini Dow Jones',        tickSize: 1.0,      tickValue: 5.00,    pointValue: 5.00 },
  'MYM':  { name: 'Micro E-mini Dow',        tickSize: 1.0,      tickValue: 0.50,    pointValue: 0.50 },
  'RTY':  { name: 'E-mini Russell 2000',     tickSize: 0.10,     tickValue: 5.00,    pointValue: 50.00 },
  'M2K':  { name: 'Micro E-mini Russell',    tickSize: 0.10,     tickValue: 0.50,    pointValue: 5.00 },
  'NKD':  { name: 'E-mini Nikkei 225 (USD)', tickSize: 5,        tickValue: 25.00,   pointValue: 5.00 },

  // ===== 能源 (NYMEX) =====
  'CL':   { name: 'Crude Oil WTI',           tickSize: 0.01,     tickValue: 10.00,   pointValue: 1000.00 },
  'MCL':  { name: 'Micro Crude Oil',         tickSize: 0.01,     tickValue: 1.00,    pointValue: 100.00 },
  'QM':   { name: 'E-mini Crude Oil',        tickSize: 0.025,    tickValue: 12.50,   pointValue: 500.00 },
  'BZ':   { name: 'Brent Crude Oil',         tickSize: 0.01,     tickValue: 10.00,   pointValue: 1000.00 },
  'NG':   { name: 'Natural Gas',             tickSize: 0.001,    tickValue: 10.00,   pointValue: 10000.00 },
  'QG':   { name: 'E-mini Natural Gas',      tickSize: 0.005,    tickValue: 12.50,   pointValue: 2500.00 },
  'RB':   { name: 'RBOB Gasoline',           tickSize: 0.0001,   tickValue: 4.20,    pointValue: 42000.00 },
  'HO':   { name: 'Heating Oil',             tickSize: 0.0001,   tickValue: 4.20,    pointValue: 42000.00 },

  // ===== 贵金属 (COMEX) =====
  'GC':   { name: 'Gold',                    tickSize: 0.10,     tickValue: 10.00,   pointValue: 100.00 },
  'MGC':  { name: 'Micro Gold',              tickSize: 0.10,     tickValue: 1.00,    pointValue: 10.00 },
  'SI':   { name: 'Silver',                  tickSize: 0.005,    tickValue: 25.00,   pointValue: 5000.00 },
  'SIL':  { name: 'Micro Silver',            tickSize: 0.005,    tickValue: 2.50,    pointValue: 500.00 },
  'HG':   { name: 'Copper',                  tickSize: 0.0005,   tickValue: 12.50,   pointValue: 25000.00 },
  'MHG':  { name: 'Micro Copper',            tickSize: 0.0005,   tickValue: 1.25,    pointValue: 2500.00 },
  'PL':   { name: 'Platinum',                tickSize: 0.10,     tickValue: 5.00,    pointValue: 50.00 },
  'PA':   { name: 'Palladium',               tickSize: 0.10,     tickValue: 10.00,   pointValue: 100.00 },

  // ===== 国债 (CBOT) =====
  // 国债跳数是分数 (1/32 等)，tickValue = pointValue * tickSize
  'ZB':   { name: '30-Year T-Bond',          tickSize: 0.03125,    tickValue: 31.25,   pointValue: 1000.00 },
  'UB':   { name: 'Ultra T-Bond',            tickSize: 0.03125,    tickValue: 31.25,   pointValue: 1000.00 },
  'ZN':   { name: '10-Year T-Note',          tickSize: 0.015625,   tickValue: 15.625,  pointValue: 1000.00 },
  'TN':   { name: 'Ultra 10-Year T-Note',    tickSize: 0.015625,   tickValue: 15.625,  pointValue: 1000.00 },
  'ZF':   { name: '5-Year T-Note',           tickSize: 0.0078125,  tickValue: 7.8125,  pointValue: 1000.00 },
  'ZT':   { name: '2-Year T-Note',           tickSize: 0.0078125,  tickValue: 15.625,  pointValue: 2000.00 },

  // ===== 外汇 (CME) =====
  '6E':   { name: 'Euro FX',                 tickSize: 0.00005,    tickValue: 6.25,    pointValue: 125000.00 },
  'M6E':  { name: 'Micro Euro FX',           tickSize: 0.0001,     tickValue: 1.25,    pointValue: 12500.00 },
  '6J':   { name: 'Japanese Yen',            tickSize: 0.0000005,  tickValue: 6.25,    pointValue: 12500000.00 },
  '6B':   { name: 'British Pound',           tickSize: 0.0001,     tickValue: 6.25,    pointValue: 62500.00 },
  'M6B':  { name: 'Micro British Pound',     tickSize: 0.0001,     tickValue: 0.625,   pointValue: 6250.00 },
  '6A':   { name: 'Australian Dollar',       tickSize: 0.0001,     tickValue: 10.00,   pointValue: 100000.00 },
  'M6A':  { name: 'Micro Australian Dollar', tickSize: 0.0001,     tickValue: 1.00,    pointValue: 10000.00 },
  '6C':   { name: 'Canadian Dollar',         tickSize: 0.00005,    tickValue: 5.00,    pointValue: 100000.00 },
  '6S':   { name: 'Swiss Franc',             tickSize: 0.0001,     tickValue: 12.50,   pointValue: 125000.00 },
  '6N':   { name: 'New Zealand Dollar',      tickSize: 0.0001,     tickValue: 10.00,   pointValue: 100000.00 },
  '6M':   { name: 'Mexican Peso',            tickSize: 0.00001,    tickValue: 5.00,    pointValue: 500000.00 },

  // ===== 农产品 - 谷物 (CBOT) =====
  'ZC':   { name: 'Corn',                    tickSize: 0.25,       tickValue: 12.50,   pointValue: 50.00 },
  'ZS':   { name: 'Soybeans',                tickSize: 0.25,       tickValue: 12.50,   pointValue: 50.00 },
  'ZW':   { name: 'Wheat',                   tickSize: 0.25,       tickValue: 12.50,   pointValue: 50.00 },
  'ZL':   { name: 'Soybean Oil',             tickSize: 0.01,       tickValue: 6.00,    pointValue: 600.00 },
  'ZM':   { name: 'Soybean Meal',            tickSize: 0.10,       tickValue: 10.00,   pointValue: 100.00 },
  'ZO':   { name: 'Oats',                    tickSize: 0.25,       tickValue: 12.50,   pointValue: 50.00 },
  'ZR':   { name: 'Rough Rice',              tickSize: 0.005,      tickValue: 10.00,   pointValue: 2000.00 },

  // ===== 农产品 - 肉类 (CME) =====
  'LE':   { name: 'Live Cattle',             tickSize: 0.025,      tickValue: 10.00,   pointValue: 400.00 },
  'HE':   { name: 'Lean Hogs',               tickSize: 0.025,      tickValue: 10.00,   pointValue: 400.00 },
  'GF':   { name: 'Feeder Cattle',           tickSize: 0.025,      tickValue: 12.50,   pointValue: 500.00 },

  // ===== 加密货币 (CME) =====
  'BTC':  { name: 'Bitcoin',                 tickSize: 5,          tickValue: 25.00,   pointValue: 5.00 },
  'MBT':  { name: 'Micro Bitcoin',           tickSize: 5,          tickValue: 0.50,    pointValue: 0.10 },
  'ETH':  { name: 'Ether',                   tickSize: 0.50,       tickValue: 25.00,   pointValue: 50.00 },
  'MET':  { name: 'Micro Ether',             tickSize: 0.50,       tickValue: 0.05,    pointValue: 0.10 },
};

// 从 TradingView 符号中提取根符号
// 输入示例: "CME_MINI:ESM2026", "NYMEX:CLK2026", "ES1!", "MES", "COMEX:GCM2026", "MGCM6"
// 输出示例: "ES", "CL", "MES", "GC", "MGC"
function tdvNormalizeSymbol(tvSymbol) {
  if (!tvSymbol) return '';
  let sym = String(tvSymbol).toUpperCase();
  // 去掉交易所前缀
  if (sym.includes(':')) sym = sym.split(':')[1];
  // 去掉连续合约标记 "1!", "2!" 等
  sym = sym.replace(/\d+!$/, '');
  // 去掉月份代码(单字母 F G H J K M N Q U V X Z) + 年份(1~4位数字)
  sym = sym.replace(/[FGHJKMNQUVXZ]\d{1,4}$/, '');
  return sym;
}

// 获取合约规格
function tdvGetContractSpec(tvSymbol) {
  const root = tdvNormalizeSymbol(tvSymbol);
  return TDV_CONTRACTS[root] || null;
}
