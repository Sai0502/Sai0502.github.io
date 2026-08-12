const DEFAULTS = {
  enabled: false,
  triggerPrice: '',
  breakevenPrice: '',
  side: 'long',
  executionMode: 'assist',
  triggered: false,
  lastCurrentPrice: null,
  lastCurrentPriceSource: '',
  lastSnapshot: null,
  lastSeenAt: null,
  logs: [],
  debugEvents: []
};

const $ = id => document.getElementById(id);
const TRADINGVIEW_RE = /^https:\/\/([a-z0-9-]+\.)?tradingview\.com\//i;

let isTradingView = false;

function fmt(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toFixed(number >= 100 ? 2 : 4).replace(/\.?0+$/, '');
}

function parsePrice(value) {
  const raw = String(value || '').replace(/−/g, '-').trim();
  if (!raw) return null;
  const normalized = raw.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function cleanPriceText(value) {
  return String(value || '').replace(/[^\d.,\-−]/g, '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('找不到当前标签页');
  return tab;
}

async function sendMessage(type, payload = {}) {
  const tab = await getActiveTab();
  if (!TRADINGVIEW_RE.test(tab.url || '')) {
    throw new Error('请先切到 TradingView 页面');
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(message)) throw err;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    return chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }
}

async function addLog(message, level = 'info') {
  const data = await chrome.storage.local.get({ logs: [] });
  const logs = Array.isArray(data.logs) ? data.logs : [];
  logs.unshift({
    at: Date.now(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    level,
    message
  });
  await chrome.storage.local.set({ logs: logs.slice(0, 80) });
}

async function addDebug(event, details = {}) {
  const data = await chrome.storage.local.get({ debugEvents: [] });
  const debugEvents = Array.isArray(data.debugEvents) ? data.debugEvents : [];
  debugEvents.unshift({
    at: Date.now(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    event,
    details
  });
  await chrome.storage.local.set({ debugEvents: debugEvents.slice(0, 120) });
}

async function updatePageWarning() {
  const tab = await getActiveTab();
  isTradingView = TRADINGVIEW_RE.test(tab.url || '');
  $('pageWarning').classList.toggle('hidden', isTradingView);
  $('pageWarningUrl').textContent = tab.url || '';
  document.querySelectorAll('button, input, select').forEach(el => {
    el.disabled = !isTradingView;
  });
}

function renderState(data) {
  $('currentPrice').textContent = fmt(data.lastCurrentPrice);
  const stateText = data.triggered
    ? '已触发'
    : data.enabled
      ? '监控中'
      : '未启动';
  $('stateText').textContent = stateText;
  const statusCards = document.querySelectorAll('.status-grid div');
  statusCards[1]?.classList.toggle('running', Boolean(data.enabled && !data.triggered));
  statusCards[1]?.classList.toggle('triggered', Boolean(data.triggered));
  setControlValueIfIdle('triggerPrice', data.triggerPrice || '');
  setControlValueIfIdle('breakevenPrice', data.breakevenPrice || '');
  setControlValueIfIdle('side', data.side || 'long');
  setControlValueIfIdle('executionMode', data.executionMode || 'assist');
}

function setControlValueIfIdle(id, value) {
  const el = $(id);
  if (document.activeElement === el) return;
  el.value = value;
}

function renderSnapshot(data) {
  const snapshot = data.lastSnapshot || {};
  $('snapshot').textContent = JSON.stringify({
    currentPrice: data.lastCurrentPrice ?? snapshot.currentPrice ?? null,
    source: data.lastCurrentPriceSource || snapshot.currentPriceSource || '',
    entryPrice: snapshot.entryPrice ?? null,
    entrySource: snapshot.entryPriceSource || '',
    sideHint: snapshot.sideHint || '',
    hasTradovate: Boolean(snapshot.textHints && snapshot.textHints.hasTradovate),
    hasPaperTrading: Boolean(snapshot.textHints && snapshot.textHints.hasPaperTrading),
    hasPosition: Boolean(snapshot.textHints && snapshot.textHints.hasPosition),
    hasStop: Boolean(snapshot.textHints && snapshot.textHints.hasStop),
    hasProfit: Boolean(snapshot.textHints && snapshot.textHints.hasProfit)
  }, null, 2);
}

function renderLogs(data) {
  const logs = Array.isArray(data.logs) ? data.logs.slice(0, 12) : [];
  if (!logs.length) {
    $('logs').innerHTML = '<div class="log-item">还没有日志。</div>';
    return;
  }
  $('logs').innerHTML = logs.map(item => {
    const level = item.level || 'info';
    const message = String(item.message || '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
    return `<div class="log-item ${level}"><strong>${item.time || ''}</strong> ${message}</div>`;
  }).join('');
}

function buildDebugPayload(data) {
  return {
    urlMatched: isTradingView,
    activeValues: {
      side: $('side').value,
      executionMode: $('executionMode').value,
      triggerPriceInput: $('triggerPrice').value,
      breakevenPriceInput: $('breakevenPrice').value
    },
    storage: {
      enabled: data.enabled,
      triggered: data.triggered,
      side: data.side,
      executionMode: data.executionMode,
      triggerPrice: data.triggerPrice,
      breakevenPrice: data.breakevenPrice,
      lastCurrentPrice: data.lastCurrentPrice,
      lastCurrentPriceSource: data.lastCurrentPriceSource,
      lastSeenAt: data.lastSeenAt,
      lastExecutionResult: data.lastExecutionResult || null
    },
    snapshot: data.lastSnapshot || null,
    logs: Array.isArray(data.logs) ? data.logs.slice(0, 20) : [],
    debugEvents: Array.isArray(data.debugEvents) ? data.debugEvents.slice(0, 40) : []
  };
}

function renderDebug(data) {
  $('debugOutput').textContent = JSON.stringify(buildDebugPayload(data), null, 2);
}

async function load() {
  await updatePageWarning();
  const data = await chrome.storage.local.get(DEFAULTS);
  renderState(data);
  renderSnapshot(data);
  renderLogs(data);
  renderDebug(data);
}

async function loadWithFreshSnapshot() {
  await updatePageWarning();
  if (isTradingView) {
    try {
      await refreshSnapshot();
      return;
    } catch (err) {
      await addDebug('error:autoRefreshOnOpen', { message: err.message || String(err) });
    }
  }
  await load();
}

async function saveSettings(extra = {}) {
  const settings = {
    side: $('side').value || 'long',
    executionMode: $('executionMode').value || 'assist',
    triggerPrice: cleanPriceText($('triggerPrice').value),
    breakevenPrice: cleanPriceText($('breakevenPrice').value),
    ...extra
  };
  await chrome.storage.local.set(settings);
  await addDebug('saveSettings', settings);
  $('saveStatus').textContent = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  return settings;
}

async function tryFillBreakevenFromPage() {
  if (parsePrice($('breakevenPrice').value) > 0) return false;
  const result = await sendMessage('tvbe:snapshot');
  if (!result || !result.ok) throw new Error(result && result.error ? result.error : '读取失败');
  const snapshot = result.snapshot || {};
  await chrome.storage.local.set({
    lastSnapshot: snapshot,
    lastCurrentPrice: snapshot.currentPrice || null,
    lastCurrentPriceSource: snapshot.currentPriceSource || '',
    lastSeenAt: Date.now()
  });
  await addDebug('autoFillBreakeven:snapshot', snapshot);

  const entry = parsePrice(snapshot.entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return false;

  const formatted = fmt(entry);
  $('breakevenPrice').value = formatted;
  await chrome.storage.local.set({ breakevenPrice: formatted });
  await addLog(`已自动识别开仓价作为推保价 ${formatted}`, 'good');
  await addDebug('autoFillBreakeven:filled', {
    breakevenPrice: formatted,
    source: snapshot.entryPriceSource || ''
  });
  return true;
}

async function refreshSnapshot() {
  if (!isTradingView) return;
  const result = await sendMessage('tvbe:snapshot');
  if (!result || !result.ok) throw new Error(result && result.error ? result.error : '读取失败');
  const snapshot = result.snapshot || {};
  await chrome.storage.local.set({
    lastSnapshot: snapshot,
    lastCurrentPrice: snapshot.currentPrice || null,
    lastCurrentPriceSource: snapshot.currentPriceSource || '',
    lastSeenAt: Date.now()
  });
  await addDebug('refreshSnapshot', snapshot);
  await addLog(`读取当前页：当前价 ${fmt(snapshot.currentPrice)}`, 'info');
  await load();
}

for (const id of ['triggerPrice', 'breakevenPrice']) {
  $(id).addEventListener('input', () => {
    const cleaned = cleanPriceText($(id).value);
    if ($(id).value !== cleaned) $(id).value = cleaned;
    addDebug('input', { id, value: $(id).value });
  });
  $(id).addEventListener('keydown', event => {
    if (event.key === 'Enter') $(id).blur();
  });
  $(id).addEventListener('blur', () => {
    saveSettings();
  });
}

$('side').addEventListener('change', () => saveSettings());
$('executionMode').addEventListener('change', () => saveSettings());

$('refresh').addEventListener('click', async () => {
  try {
    await addDebug('click:refresh');
    $('saveStatus').textContent = '正在读取当前页...';
    await refreshSnapshot();
  } catch (err) {
    await addDebug('error:refresh', { message: err.message || String(err) });
    $('saveStatus').textContent = err.message || String(err);
  }
});

$('pickLine').addEventListener('click', async () => {
  try {
    await addDebug('click:pickLine');
    await saveSettings();
    const result = await sendMessage('tvbe:create-line');
    if (!result || !result.ok) throw new Error(result && result.error ? result.error : '创建水平线失败');
    await addDebug('pickLine:created', result);
    $('saveStatus').textContent = '已创建触发价水平线，拖动会自动保存';
  } catch (err) {
    await addDebug('error:pickLine', { message: err.message || String(err) });
    $('saveStatus').textContent = err.message || String(err);
  }
});

$('pickBreakevenLine').addEventListener('click', async () => {
  try {
    await addDebug('click:pickBreakevenLine');
    await saveSettings();
    const result = await sendMessage('tvbe:create-breakeven-line');
    if (!result || !result.ok) throw new Error(result && result.error ? result.error : '创建推保价水平线失败');
    await addDebug('pickBreakevenLine:created', result);
    $('saveStatus').textContent = '已创建推保价水平线，拖动会自动保存';
  } catch (err) {
    await addDebug('error:pickBreakevenLine', { message: err.message || String(err) });
    $('saveStatus').textContent = err.message || String(err);
  }
});

$('showPanel').addEventListener('click', async () => {
  try {
    await addDebug('click:showPanel');
    await saveSettings();
    const result = await sendMessage('tvbe:show-panel');
    if (!result || !result.ok) throw new Error(result && result.error ? result.error : '打开常驻面板失败');
    await addDebug('showPanel:opened', result);
    $('saveStatus').textContent = '已打开图表右侧常驻面板';
  } catch (err) {
    await addDebug('error:showPanel', { message: err.message || String(err) });
    $('saveStatus').textContent = err.message || String(err);
  }
});

$('start').addEventListener('click', async () => {
  try {
    await addDebug('click:start');
    if (!Number.isFinite(parsePrice($('breakevenPrice').value)) || parsePrice($('breakevenPrice').value) <= 0) {
      $('saveStatus').textContent = '正在尝试从页面识别开仓价...';
      await tryFillBreakevenFromPage();
    }
    const settings = await saveSettings({ enabled: true, triggered: false, startedAt: Date.now() });
    const trigger = parsePrice(settings.triggerPrice);
    const breakeven = parsePrice(settings.breakevenPrice);
    if (!Number.isFinite(trigger) || !Number.isFinite(breakeven) || trigger <= 0 || breakeven <= 0) {
      await chrome.storage.local.set({ enabled: false });
      await addDebug('start:invalid-price', settings);
      $('saveStatus').textContent = '请先填写大于 0 的触发价和推保价；当前页未稳定识别到开仓价';
      await load();
      return;
    }
    await sendMessage('tvbe:start-loop');
    await addDebug('start:ok', settings);
    await addLog(`启动监控：${settings.side === 'short' ? '空单' : '多单'} 触发价 ${fmt(trigger)}，推保价 ${fmt(breakeven)}`, 'good');
    await load();
  } catch (err) {
    await addDebug('error:start', { message: err.message || String(err) });
    $('saveStatus').textContent = err.message || String(err);
  }
});

$('stop').addEventListener('click', async () => {
  await addDebug('click:stop');
  await chrome.storage.local.set({ enabled: false });
  await addLog('已停止监控', 'warn');
  await load();
});

$('copySnapshot').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('snapshot').textContent || '');
  $('saveStatus').textContent = '已复制识别信息';
  await addDebug('copy:snapshot');
});

$('copyLogs').addEventListener('click', async () => {
  const data = await chrome.storage.local.get({ logs: [] });
  await navigator.clipboard.writeText(JSON.stringify(data.logs || [], null, 2));
  $('saveStatus').textContent = '已复制日志';
  await addDebug('copy:logs');
});

$('copyDebug').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('debugOutput').textContent || '');
  $('saveStatus').textContent = '已复制调试信息';
  await addDebug('copy:debug');
});

loadWithFreshSnapshot();
setInterval(load, 1200);
