const DEFAULT_STATE = {
  enabled: false,
  triggerPrice: '',
  breakevenPrice: '',
  side: 'long',
  executionMode: 'assist',
  triggered: false,
  lastCurrentPrice: null,
  lastCurrentPriceSource: '',
  lastSnapshot: null,
  lastOrderSnapshot: null,
  logs: [],
  debugEvents: []
};

async function resetRuntimeState() {
  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    logs: [],
    debugEvents: [],
    resetAt: Date.now()
  });
}

chrome.runtime.onInstalled.addListener(() => {
  resetRuntimeState().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({
    enabled: false,
    triggered: false,
    lastExecutionResult: null
  }).catch(() => {});
});

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['page/tradovate-bridge.js']
    });
  } catch (_err) {}
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'tvbe:ping' });
    return;
  } catch (_err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['data/contracts.js', 'content.js']
    });
  }
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab || !tab.id || !/^https:\/\/([a-z0-9-]+\.)?tradingview\.com\//i.test(tab.url || '')) {
    return;
  }
  try {
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'tvbe:toggle-panel' });
  } catch (err) {
    await chrome.storage.local.set({
      lastActionError: err && err.message ? err.message : String(err)
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'tvbe:notify') return false;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: message.title || 'TVBreakEven',
    message: message.message || '需要处理推保',
    priority: 2
  }, notificationId => {
    sendResponse({ ok: true, notificationId });
  });

  return true;
});
