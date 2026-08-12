const DEFAULTS = {
  autoMonitorEnabled: true,
  autoLockEnabled: true,
  dailyLossLimit: 200,
  dailyProfitTarget: 300,
  scanIntervalSeconds: 60,
  lockDuration: 'end_of_day',
  scheduledLockEnabled: false,
  scheduledLockTime: '10:30',
  scheduledLockMessage: '10:30，流动性最好的时段结束',
  lastPnl: null,
  lastEquity: null,
  lastPnlSource: '',
  lastSeenAt: null,
  nextScanAt: null,
  lastPageUrl: '',
  lastPageTitle: '',
  lastCalendarCandidates: [],
  tradovateAutoLockState: {}
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'tradovate-auto-lock:open-popup') return false;

  (async () => {
    if (!chrome.action || typeof chrome.action.openPopup !== 'function') {
      throw new Error('当前 Chrome 不支持从页面打开插件窗口，请手动点击插件图标');
    }
    await chrome.action.openPopup();
    return { ok: true };
  })()
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message || String(err) }));

  return true;
});
