const DEFAULTS = {
  debugLog: [],
  autoMonitorEnabled: true,
  autoLockEnabled: true,
  dailyLossLimit: 200,
  dailyProfitTarget: 300,
  scanIntervalSeconds: 60,
  lockDuration: 'end_of_day',
  tradeCountLockEnabled: false,
  dailyEntryLimit: 30,
  scheduledLockEnabled: false,
  scheduledLockTime: '10:30',
  scheduledLockMessage: '10:30，流动性最好的时段结束',
  lastPnl: null,
  lastEquity: null,
  lastPnlSource: '',
  lastSeenAt: null,
  nextScanAt: null,
  lastCalendarCandidates: [],
  tradovateAutoLockState: {},
  settingsLockedUntil: null
};

const startButton = document.getElementById('start');
const nextButton = document.getElementById('next');
const clearButton = document.getElementById('clear');
const executeLockButton = document.getElementById('executeLock');
const lockSettingsButton = document.getElementById('lockSettings');
const nudgeEl = document.getElementById('nudge');
const resetOffsetButton = document.getElementById('resetOffset');
const flowStatusEl = document.getElementById('flowStatus');
const statusEl = document.getElementById('status');
const saveStatusEl = document.getElementById('saveStatus');
const pageWarningEl = document.getElementById('pageWarning');
const lockableSettingsEl = document.getElementById('lockableSettings');
const copySummaryButton = document.getElementById('copySummary');
const copySummaryExpandedButton = document.getElementById('copySummaryExpanded');
const copySummaryFromOverlayButton = document.getElementById('copySummaryFromOverlay');
const copyDetailedButton = document.getElementById('copyDetailed');
const copyRawButton = document.getElementById('copyRaw');
const diagnosticDetailsEl = document.getElementById('diagnosticDetails');
const diagnosticPreviewEl = document.getElementById('diagnosticPreview');
const appTitleEl = document.getElementById('appTitle');
const dataLoadingOverlayEl = document.getElementById('dataLoadingOverlay');

const NUDGE_STEP = 5;
const WS_CAPTURE_STORAGE_KEY = 'tradovateWsCapture';
const INTEGER_SETTING_IDS = ['dailyLossLimit', 'dailyProfitTarget', 'scanIntervalSeconds', 'dailyEntryLimit'];
const LOCKABLE_SETTING_IDS = [
  ...INTEGER_SETTING_IDS,
  'lockDuration',
  'tradeCountLockEnabled',
  'scheduledLockEnabled',
  'scheduledLockTime',
  'scheduledLockMessage'
];
let isBlockedPage = false;
let isBusyState = false;
let isDataLoading = false;
let settingsLockedUntil = null;
let activeAccountId = 'default';
let countdownTimer = null;
let scheduledLoadTimer = null;
let scheduledRuntimeRefreshTimer = null;
let lastDiagnosticBundle = null;
let lastDiagnosticMarkdown = '';
let scheduledLockAutoEnableMigratedAt = null;
const POPUP_BUILD_LABEL = 'Tradovate PL Auto Lock v2026_0721_103000';

function applyPopupViewportHeight() {
  // Let Chrome size the extension popup naturally. If content exceeds Chrome's
  // popup limit, Chrome provides the single outer scrollbar.
}

function $(id) {
  return document.getElementById(id);
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(err && err.message ? err.message : err);
  }
}

function hasFiniteNumberValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function settingsLockStorageKey(accountId = activeAccountId) {
  return `tradovateSettingsLockedUntil:${accountId || 'default'}`;
}

function monitorSettingsStorageKey(accountId = activeAccountId) {
  return `tradovateMonitorSettings:${accountId || 'default'}`;
}

function runtimeStateStorageKey(accountId = activeAccountId) {
  return `tradovateRuntimeState:${accountId || 'default'}`;
}

function accountKey(value) {
  const key = String(value ?? '').trim();
  return key || '';
}

function selectTradeStatsForAccount(capture, accountId = activeAccountId) {
  if (!capture || typeof capture !== 'object') return null;
  const wanted = accountKey(accountId);
  if (!wanted || wanted === 'default') return null;

  const byAccount = capture.tradeStatsByAccount && typeof capture.tradeStatsByAccount === 'object'
    ? capture.tradeStatsByAccount
    : null;
  if (byAccount) {
    if (byAccount[wanted] && typeof byAccount[wanted] === 'object') {
      return {
        ...byAccount[wanted],
        accountMatchedBy: byAccount[wanted].accountMatchedBy || 'exact_key'
      };
    }
    const mappings = Array.isArray(capture.accountMappings) ? capture.accountMappings : [];
    const mapping = mappings.find(item =>
      accountKey(item.name) === wanted ||
      accountKey(item.accountName) === wanted ||
      accountKey(item.displayName) === wanted ||
      accountKey(item.id) === wanted ||
      accountKey(item.accountId) === wanted
    );
    const mappedId = accountKey(mapping && (mapping.id || mapping.accountId));
    if (mappedId && byAccount[mappedId] && typeof byAccount[mappedId] === 'object') {
      return {
        ...byAccount[mappedId],
        accountName: mapping.name || byAccount[mappedId].accountName || wanted,
        numericAccountId: mappedId,
        accountMatchedBy: 'account_mapping'
      };
    }
    return null;
  }

  const legacy = capture.tradeStats && typeof capture.tradeStats === 'object'
    ? capture.tradeStats
    : null;
  if (!legacy) return null;
  if (
    accountKey(legacy.accountId) === wanted ||
    accountKey(legacy.accountName) === wanted ||
    accountKey(legacy.numericAccountId) === wanted
  ) {
    return {
      ...legacy,
      accountMatchedBy: 'legacy_exact'
    };
  }
  return null;
}

function fmt(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
}

function moneyClass(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value) >= 0 ? 'good' : 'bad';
}

function setFlowStatus(text, kind = '') {
  flowStatusEl.textContent = text;
  flowStatusEl.className = kind;
}

function setBusy(isBusy) {
  isBusyState = isBusy;
  const disabled = isBusy || isBlockedPage || isDataLoading;
  startButton.disabled = disabled;
  nextButton.disabled = disabled;
  clearButton.disabled = disabled;
  nudgeEl.querySelectorAll('button').forEach(button => {
    button.disabled = disabled;
  });
  executeLockButton.disabled = disabled;
  lockSettingsButton.disabled = disabled || isSettingsLocked();
  applySettingsLockState();
}

function canUseWhileDataLoading(el) {
  return el === copySummaryButton ||
    el === copySummaryExpandedButton ||
    el === copySummaryFromOverlayButton ||
    el === copyDetailedButton ||
    el === copyRawButton;
}

function showStepControls(show) {
  startButton.classList.toggle('hidden', show);
  nextButton.classList.toggle('hidden', !show);
  clearButton.classList.toggle('hidden', !show);
  nudgeEl.classList.toggle('hidden', !show);
  applyPopupViewportHeight();
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('找不到当前标签页');
  if (!/^https:\/\/trader\.tradovate\.com\//i.test(tab.url || '')) {
    throw new Error('请先切到 trader.tradovate.com 页面');
  }
  return tab;
}

async function updatePageWarning() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isTradovate = /^https:\/\/trader\.tradovate\.com\//i.test(tab?.url || '');
  isBlockedPage = !isTradovate;
  pageWarningEl.classList.toggle('hidden', isTradovate);
  document.body.classList.toggle('blocked-page', !isTradovate);
  document.querySelectorAll('input, select, button, textarea').forEach(el => {
    el.disabled = !isTradovate || ((isDataLoading || isBusyState) && !canUseWhileDataLoading(el));
  });
  applySettingsLockState();
}

async function sendMessage(type, payload = {}) {
  const tab = await getActiveTab();

  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(message)) {
      throw err;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await sleep(300);
    return chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }
}

async function loadAccountContext() {
  if (isBlockedPage) {
    return null;
  }
  try {
    const result = await sendMessage('tradovate-auto-lock:debug-snapshot');
    activeAccountId = result && result.accountIdGuess ? result.accountIdGuess : 'default';
    return result;
  } catch (err) {
    console.warn('[TradovateAutoLock popup] account context failed:', err);
    return null;
  }
}

function collectPopupBrowserEnvironment() {
  return {
    navigator: {
      userAgent: navigator.userAgent || '',
      appVersion: navigator.appVersion || '',
      platform: navigator.platform || '',
      vendor: navigator.vendor || '',
      language: navigator.language || '',
      languages: Array.from(navigator.languages || []),
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      maxTouchPoints: navigator.maxTouchPoints || 0
    },
    time: {
      now: Date.now(),
      iso: new Date().toISOString(),
      localString: new Date().toString(),
      beijing: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      timezoneOffsetMinutes: new Date().getTimezoneOffset()
    },
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  };
}

function queryExtensionPermissions() {
  return new Promise(resolve => {
    if (!chrome.permissions || typeof chrome.permissions.getAll !== 'function') {
      resolve({ available: false, error: 'chrome.permissions.getAll unavailable' });
      return;
    }
    try {
      chrome.permissions.getAll(result => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ available: true, error: err.message || String(err) });
          return;
        }
        resolve({ available: true, ...result });
      });
    } catch (err) {
      resolve({ available: true, error: err && err.message ? err.message : String(err) });
    }
  });
}

function safeUrlSummaryForPopup(url) {
  try {
    const parsed = new URL(url || '');
    return `${parsed.origin}${parsed.pathname}${parsed.search ? ' ?query=present' : ''}${parsed.hash ? ' #hash=present' : ''}`;
  } catch (_) {
    return String(url || '').slice(0, 240);
  }
}

function compactLogLine(item) {
  if (!item) return '- empty log';
  const ts = item.ts || item.time || item.at || '';
  const event = item.event || item.type || item.level || 'log';
  const details = item.details || item.message || item.reason || '';
  const detailText = typeof details === 'string' ? details : safeJson(details).replace(/\s+/g, ' ');
  return `- ${ts} ${event}: ${detailText.slice(0, 240)}`;
}

function boolText(value) {
  return value ? 'yes' : 'no';
}

async function buildFullDiagnosticBundle() {
  if (isBlockedPage) {
    throw new Error('当前不是 Tradovate 页面，无法复制 Summary');
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageBundle = await sendMessage('tradovate-auto-lock:diagnostic-bundle');
  const manifest = chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
  return {
    diagnosticBundleVersion: '2026-07-01-v2',
    copiedFormat: 'markdown-with-json',
    popupBuild: POPUP_BUILD_LABEL,
    copiedFromPopupAt: new Date().toISOString(),
    activeTab: {
      id: tab?.id || null,
      url: tab?.url || '',
      title: tab?.title || '',
      status: tab?.status || '',
      discarded: Boolean(tab?.discarded),
      audible: Boolean(tab?.audible),
      mutedInfo: tab?.mutedInfo || null
    },
    extension: {
      id: chrome.runtime.id || '',
      manifest,
      permissions: await queryExtensionPermissions()
    },
    popupEnvironment: collectPopupBrowserEnvironment(),
    popupState: {
      isBlockedPage,
      isDataLoading,
      isBusyState,
      activeAccountId,
      settingsLockedUntil,
      statusText: statusEl.textContent || '',
      saveStatus: saveStatusEl.textContent || '',
      flowStatus: flowStatusEl.textContent || '',
      diagnosticDetailsOpen: diagnosticDetailsEl.open
    },
    pageBundle
  };
}

function diagnosticSignals(bundle) {
  const pageBundle = bundle.pageBundle || {};
  const runtime = pageBundle.storage && pageBundle.storage.runtimeState ? pageBundle.storage.runtimeState : {};
  const extraction = pageBundle.pnlExtraction || {};
  const debugSnapshot = pageBundle.debugSnapshot || {};
  const autoState = pageBundle.storage && pageBundle.storage.autoState ? pageBundle.storage.autoState : {};
  const debugLogs = pageBundle.storage && Array.isArray(pageBundle.storage.debugLogTail)
    ? pageBundle.storage.debugLogTail
    : [];
  const runtimeEvents = Array.isArray(pageBundle.runtimeDiagnosticEvents) ? pageBundle.runtimeDiagnosticEvents : [];
  const websocketCapture = pageBundle.websocketCapture || {};
  const errors = [
    ...runtimeEvents.filter(item => /error|unhandledrejection|failed|exception/i.test(String(item.type || item.event || ''))),
    ...debugLogs.filter(item => /error|failed|fail|warn|skip/i.test(String(item.event || '')))
  ].slice(-10);
  const warnings = debugLogs.filter(item => /skip|warn|not_restored|failed/i.test(String(item.event || ''))).slice(-10);
  const resources = pageBundle.performance && Array.isArray(pageBundle.performance.recentResources)
    ? pageBundle.performance.recentResources.slice(-10)
    : [];
  const feature = pageBundle.featureDetection || {};
  const permissions = pageBundle.permissions || {};
  const candidates = runtime.lastCalendarCandidates || [];
  const lastCandidate = Array.isArray(candidates) && candidates.length ? candidates[candidates.length - 1] : null;
  const recentActions = [
    ...debugLogs,
    ...runtimeEvents
  ].slice(-20);

  return {
    pageBundle,
    runtime,
    extraction,
    debugSnapshot,
    autoState,
    debugLogs,
    runtimeEvents,
    errors,
    warnings,
    resources,
    websocketCapture,
    feature,
    permissions,
    lastCandidate,
    recentActions
  };
}

function inferWhatCodexShouldLookAt(signals, bundle) {
  const tips = [];
  const pnlValue = signals.extraction.pnl ?? signals.runtime.lastPnl;
  const pnlSource = signals.extraction.source || signals.runtime.lastPnlSource || '';
  const ws = signals.websocketCapture || {};
  if (!ws.hookReady) {
    tips.push('WebSocket 捕获未就绪，优先检查 manifest 注入顺序、MAIN world 支持和是否刷新过 Tradovate 页面。');
  } else if (!Number(ws.frameCount)) {
    tips.push('WebSocket hook 已就绪但未捕获到消息，先刷新 Tradovate 页面并等待账户数据加载。');
  } else if (!Number(ws.keywordHitCount)) {
    tips.push('WebSocket 有消息但没有 order/fill/position 关键词，下一步需要看 Detailed 里的 recentEvents 判断消息格式。');
  } else {
    tips.push('WebSocket 已捕获疑似交易相关消息，优先看 WebSocket Capture 的 keywordCounts 和 recentFrames。');
  }
  if (!Number.isFinite(Number(pnlValue)) || !/total pnl/i.test(pnlSource)) {
    tips.push('PNL 未从 Total PnL/总损益直接读取，优先检查 domDiagnostics 与 pnlExtraction。');
  }
  if (bundle.popupState && bundle.popupState.isDataLoading) {
    tips.push('Popup 处于数据获取中，优先检查 pnlExtraction.source、lastPnlSource 和页面总损益 DOM。');
  }
  if (signals.errors.length) {
    tips.push('存在 error/failed 事件，优先看 Errors / Warnings 与 runtimeDiagnosticEvents。');
  }
  if (signals.debugSnapshot && signals.debugSnapshot.pageIndicatesLocked && signals.autoState && signals.autoState.status !== 'locked') {
    tips.push('页面显示已锁定但 autoState 不一致，检查 lockButtonState 与 autoState 同步逻辑。');
  }
  if (signals.debugSnapshot && !signals.debugSnapshot.manualLockButtonFound) {
    tips.push('未找到手动锁定按钮，检查 Tradovate DOM 是否变更。');
  }
  if (!tips.length) {
    tips.push('先核对 Summary 中的 PNL 来源、锁定状态、最近操作日志。');
    tips.push('如果 Summary 不够，再索取 Detailed；不要优先看 Raw。');
  }
  return tips.slice(0, 5);
}

function formatSummaryMarkdown(bundle) {
  const s = diagnosticSignals(bundle);
  const page = s.pageBundle.page || {};
  const env = s.pageBundle.browserEnvironment || bundle.popupEnvironment || {};
  const nav = env.navigator || {};
  const time = env.time || {};
  const monitorSettings = s.pageBundle.storage ? s.pageBundle.storage.monitorSettings : null;
  const lockState = s.debugSnapshot.lockButtonState || {};
  const pnlValue = s.extraction.pnl ?? s.runtime.lastPnl ?? '';
  const pnlSource = s.extraction.source || s.runtime.lastPnlSource || '';
  const ws = s.websocketCapture || {};
  const wsKeywordCounts = ws.keywordCounts || {};
  const wsEntityCounts = ws.entityCounts || {};
  const wsTradeStats = selectTradeStatsForAccount(ws, s.pageBundle.accountId || bundle.popupState?.activeAccountId) ||
    s.runtime.lastTradeStats ||
    {};
  const positionGuard = s.autoState.tradePositionGuard || s.runtime.lastTradePositionGuard || {};
  const visiblePosition = s.extraction.visiblePositionStatus || s.runtime.lastVisiblePositionStatus || {};
  const wsRecentFrames = Array.isArray(ws.recentFrames) ? ws.recentFrames.slice(-8) : [];
  const wsFrameLines = wsRecentFrames.map(item => {
    const keywords = Array.isArray(item.keywords) && item.keywords.length ? ` keywords=${item.keywords.join(',')}` : '';
    const entitySummaries = Array.isArray(item.entitySummaries) && item.entitySummaries.length
      ? ` entities=${safeJson(item.entitySummaries.slice(0, 3)).replace(/\n/g, ' ').slice(0, 520)}`
      : '';
    const snippets = Array.isArray(item.snippets) && item.snippets.length
      ? ` snippets=${safeJson(item.snippets.slice(0, 2)).replace(/\n/g, ' ').slice(0, 520)}`
      : '';
    const sample = item.sample || item.jsonPreview || '';
    return `- ${item.ts || ''} ${item.direction || ''} ${item.dataType || ''} size=${item.size || 0}${keywords}${entitySummaries}${snippets || ` sample=${String(sample).replace(/\s+/g, ' ').slice(0, 220)}`}`;
  });
  const networkLines = s.resources.map(item => {
    const name = item.name || {};
    return `- ${name.origin || ''}${name.pathname || ''} ${item.initiatorType || ''} ${item.duration || 0}ms status=${item.responseStatus ?? 'n/a'}`;
  });
  const featureLines = [
    `- chromeRuntime=${boolText(s.feature.chromeRuntime)}, chromeStorage=${boolText(s.feature.chromeStorage)}, extensionContextValid=${boolText(s.feature.extensionContextValid)}`,
    `- notifications=${boolText(s.feature.notification)}, permissionsApi=${boolText(s.feature.permissionsApi)}, clipboardApi=${boolText(s.feature.clipboardApi)}`
  ];
  const permissionLines = [
    `- notificationPermission=${s.permissions.notificationPermission || 'unknown'}`,
    ...(Array.isArray(s.permissions.queried) ? s.permissions.queried.slice(0, 6).map(item => `- ${item.name}: ${item.state}`) : [])
  ];
  const recentLogLines = s.recentActions.slice(-20).map(compactLogLine);
  const errorLines = [...s.errors, ...s.warnings].slice(-10).map(compactLogLine);
  const lookAt = inferWhatCodexShouldLookAt(s, bundle).map((item, index) => `${index + 1}. ${item}`);

  return [
    '# TradovateAutoLock AI Debug Summary',
    '',
    '## Problem Context',
    '用户当前正在做什么：Tradovate PnL 风控/自动锁账户插件运行中',
    '实际结果：请用户在粘贴时补充实际现象',
    '预期结果：PNL 达到阈值后稳定自动锁账户，未读到数据时不误判',
    '',
    '## Environment',
    `版本：${bundle.popupBuild || ''} / ${(s.pageBundle.build && s.pageBundle.build.scriptBuild) || ''}`,
    `浏览器：${nav.userAgent || 'unknown'}`,
    `系统：${nav.platform || 'unknown'}`,
    `页面：${safeUrlSummaryForPopup(page.url || '')}`,
    `时间：${time.beijing || bundle.copiedFromPopupAt || ''}`,
    '',
    '## Current State',
    `核心状态：popupDataLoading=${boolText(bundle.popupState && bundle.popupState.isDataLoading)}, pageLocked=${boolText(s.debugSnapshot.pageIndicatesLocked)}, autoState=${s.autoState.status || ''}`,
    `核心数据：PnL=${pnlValue}, openPnL=${s.extraction.openPnl ?? s.runtime.lastOpenPnl ?? ''}, equity=${s.extraction.equity ?? s.runtime.lastEquity ?? ''}, source=${pnlSource}`,
    `配置摘要：loss=${monitorSettings?.dailyLossLimit ?? ''}, profit=${monitorSettings?.dailyProfitTarget ?? ''}, scan=${monitorSettings?.scanIntervalSeconds ?? ''}s, duration=${monitorSettings?.lockDuration ?? ''}, tradeCountLock=${boolText(monitorSettings?.tradeCountLockEnabled)}, dailyEntryLimit=${monitorSettings?.dailyEntryLimit ?? ''}`,
    `交易状态：lockButton="${lockState.text || ''}", remainingMs=${lockState.remainingMs || 0}`,
    `WebSocket：hookReady=${boolText(ws.hookReady)}, sockets=${ws.socketCount || 0}, frames=${ws.frameCount || 0}, text=${ws.textFrameCount || 0}, binary=${ws.binaryFrameCount || 0}, keywordHits=${ws.keywordHitCount || 0}`,
    `WebSocket关键词：${Object.keys(wsKeywordCounts).length ? safeJson(wsKeywordCounts).replace(/\n/g, ' ') : '无'}`,
    `WebSocket原始实体命中：${Object.keys(wsEntityCounts).length ? safeJson(wsEntityCounts).replace(/\n/g, ' ') : '无'}（含历史/缓存消息，不等于今天交易次数）`,
    `今日交易次数诊断：account=${wsTradeStats.accountName || wsTradeStats.accountId || ''}, matchedBy=${wsTradeStats.accountMatchedBy || ''}, tradeDay=${wsTradeStats.dateKeyBeijing || ''} ${wsTradeStats.tradeDayStartAtBeijing || ''}-${wsTradeStats.tradeDayEndAtBeijing || ''}, tradeCountToday=${wsTradeStats.tradeCountToday ?? ''}, tradeCountSource=${wsTradeStats.tradeCountSource || ''}, fillsToday=${wsTradeStats.fillCountToday ?? ''}, entryFillsToday=${wsTradeStats.entryFillsToday ?? ''}, flatToPositionEntriesToday=${wsTradeStats.flatToPositionEntriesToday ?? ''}, completedTradesToday=${wsTradeStats.completedTradesToday ?? ''}, positionTradeCountEstimate=${wsTradeStats.positionTradeCountEstimate ?? ''}, positionFillCountEstimate=${wsTradeStats.positionFillCountEstimate ?? ''}, fills30m=${wsTradeStats.fillCountLast30m ?? ''}, fills60m=${wsTradeStats.fillCountLast60m ?? ''}`,
    `持仓判断：source=${positionGuard.source || wsTradeStats.positionStatusSource || 'unknown'}, available=${boolText(positionGuard.available)}, hasOpenPosition=${boolText(positionGuard.hasOpenPosition)}, netAbs=${positionGuard.netAbs ?? ''}, blockedByOpenPosition=${boolText(s.autoState.tradeCountBlockedByOpenPosition)}, visiblePosition=${visiblePosition.ok ? `${boolText(visiblePosition.hasOpenPosition)} ${visiblePosition.text || ''}` : '未读取'}`,
    '',
    '## Detection Result',
    `数据来源：${pnlSource || '未获取'}`,
    `解析结果：${safeJson({ pnl: pnlValue, source: pnlSource, text: s.extraction.text || '' }).replace(/\n/g, ' ')}`,
    `是否成功：${Number.isFinite(Number(pnlValue)) && /total pnl/i.test(pnlSource) ? '是' : '否'}`,
    `失败原因：${s.extraction.error || (!/total pnl/i.test(pnlSource) ? '未从总损益直接读取' : '')}`,
    `最近一次解析候选：${s.lastCandidate ? safeJson(s.lastCandidate).replace(/\n/g, ' ').slice(0, 320) : '无'}`,
    `最近一次点击/自动操作目标：${s.debugSnapshot.lockButtonState ? s.debugSnapshot.lockButtonState.text || '无' : '无'}`,
    '',
    '## Recent Actions',
    ...(recentLogLines.length ? recentLogLines : ['- 无']),
    '',
    '## Errors / Warnings',
    ...(errorLines.length ? errorLines : ['- 无']),
    '',
    '## Recent Logs',
    ...(s.debugLogs.slice(-20).map(compactLogLine).length ? s.debugLogs.slice(-20).map(compactLogLine) : ['- 无']),
    '',
    '## Network Summary',
    ...(networkLines.length ? networkLines : ['- 无可用 PerformanceResourceTiming']),
    '',
    '## WebSocket Capture',
    ...(wsFrameLines.length ? wsFrameLines : ['- 无疑似交易相关 WebSocket 消息；请刷新 Tradovate 后复制，或下 1 笔测试单后复制 Detailed。']),
    '',
    '## Feature / Permission Summary',
    ...featureLines,
    ...permissionLines,
    '',
    '## What Codex Should Look At First',
    ...lookAt,
    ''
  ].join('\n');
}

function compactDetailedBundle(bundle) {
  const s = diagnosticSignals(bundle);
  return {
    diagnosticBundleVersion: bundle.diagnosticBundleVersion,
    copiedAt: bundle.copiedFromPopupAt,
    activeTab: {
      ...bundle.activeTab,
      url: safeUrlSummaryForPopup(bundle.activeTab && bundle.activeTab.url)
    },
    extension: {
      id: bundle.extension && bundle.extension.id,
      manifest: bundle.extension && bundle.extension.manifest
        ? {
            name: bundle.extension.manifest.name,
            version: bundle.extension.manifest.version,
            permissions: bundle.extension.manifest.permissions,
            host_permissions: bundle.extension.manifest.host_permissions
          }
        : null,
      permissions: bundle.extension && bundle.extension.permissions
    },
    popupEnvironment: bundle.popupEnvironment,
    popupState: bundle.popupState,
    page: {
      ...s.pageBundle.page,
      url: safeUrlSummaryForPopup(s.pageBundle.page && s.pageBundle.page.url)
    },
    build: s.pageBundle.build,
    accountId: s.pageBundle.accountId,
    browserEnvironment: s.pageBundle.browserEnvironment,
    permissions: s.pageBundle.permissions,
    featureDetection: s.pageBundle.featureDetection,
    performance: {
      ...(s.pageBundle.performance || {}),
      recentResources: s.resources
    },
    websocketCapture: s.pageBundle.websocketCapture || null,
    pnlExtraction: s.pageBundle.pnlExtraction,
    domDiagnostics: s.pageBundle.domDiagnostics,
    debugSnapshot: s.pageBundle.debugSnapshot,
    storage: s.pageBundle.storage,
    runtimeDiagnosticEvents: s.pageBundle.runtimeDiagnosticEvents
  };
}

function formatDetailedMarkdown(bundle) {
  return [
    '# TradovateAutoLock AI Debug Detailed',
    '',
    '比 Summary 更完整，但仍然尽量避免大体积 Raw 数据。优先给 Codex 看 Summary；只有需要深入时再贴 Detailed。',
    '',
    '```json',
    safeJson(compactDetailedBundle(bundle)),
    '```',
    ''
  ].join('\n');
}

function formatRawMarkdown(bundle) {
  return [
    '# TradovateAutoLock AI Debug Raw',
    '',
    'Raw 可能很长，也可能包含较多本地状态。只有 Codex 明确要求时再粘贴。',
    '',
    '```json',
    safeJson(bundle),
    '```',
    ''
  ].join('\n');
}

function formatDiagnosticMarkdown(bundle, level = 'summary') {
  if (level === 'raw') return formatRawMarkdown(bundle);
  if (level === 'detailed') return formatDetailedMarkdown(bundle);
  return formatSummaryMarkdown(bundle);
}

async function refreshDiagnosticPreview({ copy = false, level = 'summary' } = {}) {
  const bundle = await buildFullDiagnosticBundle();
  lastDiagnosticBundle = bundle;
  const markdown = formatDiagnosticMarkdown(bundle, level);
  lastDiagnosticMarkdown = markdown;
  diagnosticPreviewEl.textContent = markdown;
  if (copy) {
    await navigator.clipboard.writeText(markdown);
    saveStatusEl.textContent = `诊断包 ${level} 已复制`;
  } else {
    saveStatusEl.textContent = `诊断包 ${level} 已刷新`;
  }
  saveStatusEl.className = 'save-status';
  return markdown;
}

async function copyDiagnosticBundle(event, level = 'summary') {
  event.preventDefault();
  event.stopPropagation();
  try {
    await refreshDiagnosticPreview({ copy: true, level });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    saveStatusEl.textContent = message;
    saveStatusEl.className = 'save-status warn';
    diagnosticPreviewEl.textContent = `诊断包生成失败：${message}`;
  }
}

function handleFlowResult(result) {
  if (!result || !result.ok) {
    throw new Error(result && result.error ? result.error : '执行失败，但页面没有返回具体原因');
  }

  if (result.done) {
    nextButton.classList.add('hidden');
    setFlowStatus(result.message || '已完成测试，最后一步没有点击。', 'good');
    applyPopupViewportHeight();
    return;
  }

  showStepControls(true);
  setFlowStatus(result.message || '已高亮当前步骤，确认位置后点“下一步”。', 'good');
  applyPopupViewportHeight();
}

async function runCommand(type, pendingText) {
  setBusy(true);
  setFlowStatus(pendingText);

  try {
    const result = await sendMessage(type);
    handleFlowResult(result);
    await load();
  } catch (err) {
    setFlowStatus(err && err.message ? err.message : String(err), 'bad');
  } finally {
    setBusy(false);
  }
}

async function adjust(dx, dy) {
  setBusy(true);
  try {
    const result = await sendMessage('tradovate-auto-lock:adjust', {
      dx: dx * NUDGE_STEP,
      dy: dy * NUDGE_STEP
    });
    handleFlowResult(result);
  } catch (err) {
    setFlowStatus(err && err.message ? err.message : String(err), 'bad');
  } finally {
    setBusy(false);
  }
}

function renderStatus(data, tradeStats = null) {
  const entriesToday = Number(tradeStats && (tradeStats.tradeCountToday ?? tradeStats.flatToPositionEntriesToday));
  statusEl.innerHTML = `
    <div class="pnl-card">
      <span>Daily PnL</span>
      <strong class="${moneyClass(data.lastPnl)}">${fmt(data.lastPnl)}</strong>
    </div>
    <div class="status-metric-row">
      <span>今日开仓 <strong class="entry-count">${Number.isFinite(entriesToday) ? entriesToday : '-'}</strong></span>
      <span>下次自动扫描 <strong id="scanCountdown">${formatCountdown(data.nextScanAt)}</strong></span>
    </div>
  `;
  startCountdown(data.nextScanAt);
}

function hasDirectPnlData(data) {
  if (!data || typeof data !== 'object') return false;
  if (hasFiniteNumberValue(data.lastPnl)) return true;
  if (hasFiniteNumberValue(data.lastOpenPnl)) return true;
  if (hasFiniteNumberValue(data.lastEquity)) return true;
  if (data.lastVisiblePositionStatus) return true;
  const source = String(data.lastPnlSource || '');
  if (/no match|unavailable|failed|error/i.test(source)) return false;
  return /total pnl|open pnl|equity/i.test(source);
}

function setDataLoading(loading) {
  isDataLoading = Boolean(loading) && !isBlockedPage;
  dataLoadingOverlayEl.classList.toggle('hidden', !isDataLoading);
  document.body.classList.toggle('data-loading', isDataLoading);
  document.querySelectorAll('input, select, button, textarea').forEach(el => {
    el.disabled = isBlockedPage || ((isDataLoading || isBusyState) && !canUseWhileDataLoading(el));
  });
  applySettingsLockState();
}

function formatCountdown(nextScanAt) {
  const ts = Number(nextScanAt);
  if (!Number.isFinite(ts) || ts <= 0) return '-';
  const seconds = Math.max(0, Math.ceil((ts - Date.now()) / 1000));
  return `${seconds}s`;
}

function startCountdown(nextScanAt) {
  if (countdownTimer) window.clearInterval(countdownTimer);
  const startedWithFutureScan = Number.isFinite(Number(nextScanAt)) && Number(nextScanAt) > Date.now();
  let didExpireRefresh = false;
  const update = () => {
    const el = document.getElementById('scanCountdown');
    if (el) el.textContent = formatCountdown(nextScanAt);
    if (!startedWithFutureScan || didExpireRefresh) return;
    if (Number.isFinite(Number(nextScanAt)) && Number(nextScanAt) <= Date.now()) {
      didExpireRefresh = true;
      scheduleLoad(150);
    }
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

function scheduleLoad(delay = 0) {
  if (scheduledLoadTimer) window.clearTimeout(scheduledLoadTimer);
  scheduledLoadTimer = window.setTimeout(() => {
    scheduledLoadTimer = null;
    load().catch(err => {
      console.warn('[TradovateAutoLock popup] scheduled load failed:', err);
    });
  }, delay);
}

function scheduleRuntimeRefresh(delay = 0) {
  if (scheduledRuntimeRefreshTimer) window.clearTimeout(scheduledRuntimeRefreshTimer);
  scheduledRuntimeRefreshTimer = window.setTimeout(() => {
    scheduledRuntimeRefreshTimer = null;
    refreshRuntimeStatus().catch(err => {
      console.warn('[TradovateAutoLock popup] runtime refresh failed:', err);
    });
  }, delay);
}

function isSettingsLocked() {
  return Number.isFinite(Number(settingsLockedUntil)) && Number(settingsLockedUntil) > currentTimestamp();
}

function currentTimestamp() {
  const testNow = Number(window.__tradovateAutoLockNow);
  return Number.isFinite(testNow) && testNow > 0 ? testNow : Date.now();
}

function formatBeijingDateTime(timestamp) {
  if (!Number.isFinite(Number(timestamp))) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(Number(timestamp)));
}

function beijingDateParts(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const value = type => Number(parts.find(part => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour')
  };
}

function settingsUnlockAtBeijing4am(timestamp = currentTimestamp()) {
  const { year, month, day, hour } = beijingDateParts(timestamp);
  const addDays = hour >= 4 ? 1 : 0;
  const targetBeijing4amAsUtc = new Date(Date.UTC(year, month - 1, day + addDays, 4, 0, 0));
  return targetBeijing4amAsUtc.getTime() - 8 * 60 * 60 * 1000;
}

async function normalizeSettingsLock(until) {
  const lockUntil = Number(until);
  if (Number.isFinite(lockUntil) && lockUntil > currentTimestamp()) {
    settingsLockedUntil = lockUntil;
    return lockUntil;
  }
  settingsLockedUntil = null;
  if (until) await chrome.storage.local.set({ [settingsLockStorageKey()]: null, settingsLockedUntil: null });
  return null;
}

function applySettingsLockState() {
  const locked = !isBlockedPage && isSettingsLocked();
  lockableSettingsEl.classList.toggle('settings-locked', locked);
  for (const id of LOCKABLE_SETTING_IDS) {
    $(id).disabled = isBlockedPage || isDataLoading || locked;
  }
  lockSettingsButton.disabled = isBlockedPage || isDataLoading || locked || isBusyState;
  lockSettingsButton.textContent = locked ? '已锁定' : '锁定设置';
}

function hydrateSettingValue(id, value) {
  const input = $(id);
  if (document.activeElement === input) return;
  input.value = String(value);
}

function hydrateSettingChecked(id, checked) {
  const input = $(id);
  if (document.activeElement === input) return;
  input.checked = Boolean(checked);
}

async function refreshRuntimeStatus() {
  if (isBlockedPage) return;
  const runtimeKey = runtimeStateStorageKey();
  const data = await chrome.storage.local.get({
    [runtimeKey]: null,
    [WS_CAPTURE_STORAGE_KEY]: null
  });
  const runtimeState = data[runtimeKey] && typeof data[runtimeKey] === 'object'
    ? data[runtimeKey]
    : {};
  const websocketCapture = data[WS_CAPTURE_STORAGE_KEY] && typeof data[WS_CAPTURE_STORAGE_KEY] === 'object'
    ? data[WS_CAPTURE_STORAGE_KEY]
    : null;
  const scopedTradeStats =
    selectTradeStatsForAccount(websocketCapture, activeAccountId) ||
    runtimeState.lastTradeStats;
  renderStatus(runtimeState, scopedTradeStats);
  setDataLoading(!hasDirectPnlData(runtimeState));
  applyPopupViewportHeight();
}

async function load() {
  appTitleEl.textContent = POPUP_BUILD_LABEL;
  await updatePageWarning();
  const snapshot = await loadAccountContext();
  activeAccountId = snapshot && snapshot.accountIdGuess ? snapshot.accountIdGuess : activeAccountId;
  const settingsKey = settingsLockStorageKey();
  const monitorKey = monitorSettingsStorageKey();
  const runtimeKey = runtimeStateStorageKey();
  const data = await chrome.storage.local.get({
    [settingsKey]: null,
    [monitorKey]: null,
    [runtimeKey]: null,
    [WS_CAPTURE_STORAGE_KEY]: null,
    dailyLossLimit: DEFAULTS.dailyLossLimit,
    dailyProfitTarget: DEFAULTS.dailyProfitTarget,
    scanIntervalSeconds: DEFAULTS.scanIntervalSeconds,
    lockDuration: DEFAULTS.lockDuration,
    tradeCountLockEnabled: DEFAULTS.tradeCountLockEnabled,
    dailyEntryLimit: DEFAULTS.dailyEntryLimit,
    scheduledLockEnabled: DEFAULTS.scheduledLockEnabled,
    scheduledLockTime: DEFAULTS.scheduledLockTime,
    scheduledLockMessage: DEFAULTS.scheduledLockMessage
  });
  const scopedSettings = data[monitorKey] && typeof data[monitorKey] === 'object'
    ? data[monitorKey]
    : null;
  let runtimeState = data[runtimeKey] && typeof data[runtimeKey] === 'object'
    ? data[runtimeKey]
    : {};
  const nextScanAt = Number(runtimeState.nextScanAt) || 0;
  if (!isBlockedPage && (!nextScanAt || nextScanAt <= currentTimestamp())) {
    try {
      await sendMessage('tradovate-auto-lock:ensure-monitor-loop');
      await sleep(250);
      const refreshed = await chrome.storage.local.get({ [runtimeKey]: {} });
      runtimeState = refreshed[runtimeKey] && typeof refreshed[runtimeKey] === 'object'
        ? refreshed[runtimeKey]
        : runtimeState;
    } catch (_) {
    }
  }
  await normalizeSettingsLock(data[settingsKey]);
  hydrateSettingValue('dailyLossLimit',
    Number(scopedSettings && scopedSettings.dailyLossLimit) > 0
      ? Number(scopedSettings.dailyLossLimit)
      : (data.dailyLossLimit || DEFAULTS.dailyLossLimit)
  );
  hydrateSettingValue('dailyProfitTarget',
    Number(scopedSettings && scopedSettings.dailyProfitTarget) > 0
      ? Number(scopedSettings.dailyProfitTarget)
      : (data.dailyProfitTarget || DEFAULTS.dailyProfitTarget)
  );
  hydrateSettingValue('scanIntervalSeconds',
    Number(scopedSettings && scopedSettings.scanIntervalSeconds) > 0
      ? Number(scopedSettings.scanIntervalSeconds)
      : (data.scanIntervalSeconds || DEFAULTS.scanIntervalSeconds)
  );
  hydrateSettingValue('lockDuration', (scopedSettings && scopedSettings.lockDuration) || data.lockDuration || 'end_of_day');
  const storedTradeCountLockEnabled = scopedSettings && typeof scopedSettings.tradeCountLockEnabled === 'boolean'
    ? scopedSettings.tradeCountLockEnabled
    : data.tradeCountLockEnabled;
  hydrateSettingChecked('tradeCountLockEnabled', storedTradeCountLockEnabled);
  hydrateSettingValue('dailyEntryLimit',
    Number(scopedSettings && scopedSettings.dailyEntryLimit) > 0
      ? Number(scopedSettings.dailyEntryLimit)
      : (data.dailyEntryLimit || DEFAULTS.dailyEntryLimit)
  );
  const scheduledTime = (scopedSettings && scopedSettings.scheduledLockTime) || data.scheduledLockTime || DEFAULTS.scheduledLockTime;
  const scheduledMessage = (scopedSettings && scopedSettings.scheduledLockMessage) || data.scheduledLockMessage || DEFAULTS.scheduledLockMessage;
  const storedScheduledEnabled = scopedSettings && typeof scopedSettings.scheduledLockEnabled === 'boolean'
    ? scopedSettings.scheduledLockEnabled
    : data.scheduledLockEnabled;
  scheduledLockAutoEnableMigratedAt = scopedSettings && scopedSettings.scheduledLockAutoEnableMigratedAt
    ? scopedSettings.scheduledLockAutoEnableMigratedAt
    : null;
  const shouldAutoEnableScheduledLock = Boolean(
    scopedSettings &&
    storedScheduledEnabled === false &&
    scheduledTime &&
    scheduledTime !== DEFAULTS.scheduledLockTime &&
    !scheduledLockAutoEnableMigratedAt
  );
  if (shouldAutoEnableScheduledLock) {
    scheduledLockAutoEnableMigratedAt = new Date().toISOString();
  }
  hydrateSettingChecked('scheduledLockEnabled', storedScheduledEnabled || shouldAutoEnableScheduledLock);
  hydrateSettingValue('scheduledLockTime', scheduledTime);
  hydrateSettingValue('scheduledLockMessage', scheduledMessage);
  applySettingsLockState();
  if (shouldAutoEnableScheduledLock && !isSettingsLocked() && !isBlockedPage) {
    await saveSettings({ silent: true });
  }
  if (isSettingsLocked()) {
    saveStatusEl.textContent = `设置已锁定至北京时间 ${formatBeijingDateTime(settingsLockedUntil)}`;
    saveStatusEl.className = 'save-status warn';
  }
  const websocketCapture = data[WS_CAPTURE_STORAGE_KEY] && typeof data[WS_CAPTURE_STORAGE_KEY] === 'object'
    ? data[WS_CAPTURE_STORAGE_KEY]
    : null;
  let livePageState = null;
  if (!isBlockedPage) {
    try {
      livePageState = await sendMessage('tradovate-auto-lock:read-current-page-state');
      if (livePageState && livePageState.runtimeState && typeof livePageState.runtimeState === 'object') {
        runtimeState = livePageState.runtimeState;
      }
    } catch (err) {
      console.warn('[TradovateAutoLock popup] live page state read failed:', err);
    }
  }
  const scopedTradeStats =
    selectTradeStatsForAccount(websocketCapture, activeAccountId) ||
    (livePageState && livePageState.tradeStats) ||
    runtimeState.lastTradeStats;
  renderStatus(runtimeState, scopedTradeStats);
  const liveStateHasData = Boolean(
    livePageState && (
      hasDirectPnlData(livePageState.runtimeState) ||
      hasDirectPnlData({
        lastPnl: livePageState.pnlExtraction && livePageState.pnlExtraction.pnl,
        lastOpenPnl: livePageState.pnlExtraction && livePageState.pnlExtraction.openPnl,
        lastEquity: livePageState.pnlExtraction && livePageState.pnlExtraction.equity,
        lastVisiblePositionStatus: livePageState.pnlExtraction && livePageState.pnlExtraction.visiblePositionStatus,
        lastPnlSource: livePageState.pnlExtraction && livePageState.pnlExtraction.source
      })
    )
  );
  setDataLoading(!(liveStateHasData || hasDirectPnlData(runtimeState)));
  applyPopupViewportHeight();
}

function cleanIntegerText(value) {
  return String(value || '').replace(/\D/g, '');
}

function positiveIntegerFromInput(id, fallback) {
  const input = $(id);
  const cleaned = cleanIntegerText(input.value);
  const value = Number(cleaned);
  if (!Number.isInteger(value) || value <= 0) {
    input.value = String(fallback);
    return fallback;
  }
  input.value = String(value);
  return value;
}

async function saveSettings({ silent = false } = {}) {
  if (isBlockedPage) return null;
  if (isSettingsLocked()) {
    if (!silent) {
      saveStatusEl.textContent = `设置已锁定至北京时间 ${formatBeijingDateTime(settingsLockedUntil)}`;
      saveStatusEl.className = 'save-status warn';
    }
    applySettingsLockState();
    return null;
  }
  const settings = {
    autoMonitorEnabled: true,
    autoLockEnabled: true,
    dailyLossLimit: positiveIntegerFromInput('dailyLossLimit', DEFAULTS.dailyLossLimit),
    dailyProfitTarget: positiveIntegerFromInput('dailyProfitTarget', DEFAULTS.dailyProfitTarget),
    scanIntervalSeconds: positiveIntegerFromInput('scanIntervalSeconds', DEFAULTS.scanIntervalSeconds),
    lockDuration: $('lockDuration').value || 'end_of_day',
    tradeCountLockEnabled: Boolean($('tradeCountLockEnabled').checked),
    dailyEntryLimit: positiveIntegerFromInput('dailyEntryLimit', DEFAULTS.dailyEntryLimit),
    scheduledLockEnabled: Boolean($('scheduledLockEnabled').checked),
    scheduledLockTime: /^([01]\d|2[0-3]):[0-5]\d$/.test($('scheduledLockTime').value)
      ? $('scheduledLockTime').value
      : DEFAULTS.scheduledLockTime,
    scheduledLockMessage: $('scheduledLockMessage').value.trim() || DEFAULTS.scheduledLockMessage,
    scheduledLockAutoEnableMigratedAt: scheduledLockAutoEnableMigratedAt || new Date().toISOString()
  };
  $('scheduledLockTime').value = settings.scheduledLockTime;
  $('scheduledLockMessage').value = settings.scheduledLockMessage;
  await chrome.storage.local.set({
    [monitorSettingsStorageKey()]: settings
  });
  if (!silent) {
    saveStatusEl.textContent = `已自动保存 ${new Date().toLocaleTimeString()}`;
    saveStatusEl.className = 'save-status';
  }
  return settings;
}

function showIntegerHint() {
  saveStatusEl.textContent = '只能输入大于0的整数';
  saveStatusEl.className = 'save-status warn';
  window.setTimeout(() => {
    saveStatusEl.className = 'save-status';
  }, 900);
}

for (const id of INTEGER_SETTING_IDS) {
  const input = $(id);
  input.addEventListener('beforeinput', event => {
    if (event.data && /\D/.test(event.data)) {
      event.preventDefault();
      showIntegerHint();
    }
  });
  input.addEventListener('input', () => {
    const cleaned = cleanIntegerText(input.value);
    if (input.value !== cleaned) {
      input.value = cleaned;
      showIntegerHint();
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') input.blur();
  });
  input.addEventListener('blur', () => {
    saveSettings();
  });
}

$('lockDuration').addEventListener('change', () => {
  saveSettings();
});

$('tradeCountLockEnabled').addEventListener('change', () => {
  saveSettings();
});

$('scheduledLockEnabled').addEventListener('change', () => {
  saveSettings();
});

$('scheduledLockTime').addEventListener('change', () => {
  $('scheduledLockEnabled').checked = true;
  saveSettings();
});

$('scheduledLockMessage').addEventListener('keydown', event => {
  if (event.key === 'Enter') $('scheduledLockMessage').blur();
});

$('scheduledLockMessage').addEventListener('blur', () => {
  if ($('scheduledLockMessage').value.trim()) $('scheduledLockEnabled').checked = true;
  saveSettings();
});

lockSettingsButton.addEventListener('click', async () => {
  if (isBlockedPage || isSettingsLocked()) return;
  const until = settingsUnlockAtBeijing4am();
  if (!Number.isFinite(until) || until <= currentTimestamp()) {
    await chrome.storage.local.set({ [settingsLockStorageKey()]: null, settingsLockedUntil: null });
    settingsLockedUntil = null;
    applySettingsLockState();
    saveStatusEl.textContent = '当前已过本交易日锁定结束时间，设置未锁定';
    saveStatusEl.className = 'save-status warn';
    return;
  }
  await saveSettings({ silent: true });
  await chrome.storage.local.set({
    [settingsLockStorageKey()]: until,
    settingsLockedUntil: null
  });
  settingsLockedUntil = until;
  applySettingsLockState();
  saveStatusEl.textContent = `设置已锁定至北京时间 ${formatBeijingDateTime(until)}`;
  saveStatusEl.className = 'save-status warn';
  await loadAccountContext();
});

executeLockButton.addEventListener('click', async () => {
  if (isBlockedPage) return;
  const lockText = $('lockDuration').selectedOptions[0]?.textContent || '交易日结束 - NY 16:00';
  const ok = window.confirm(`确定立刻锁定账户？\n\n锁定选项：${lockText}`);
  if (!ok) return;

  setBusy(true);
  executeLockButton.textContent = '锁定中...';
  try {
    await saveSettings({ silent: true });
    const result = await sendMessage('tradovate-auto-lock:execute-real-lockout');
    if (!result || !result.ok) throw new Error(result && result.error ? result.error : '锁定失败');
    saveStatusEl.textContent = '已发送锁定账户流程';
    await load();
  } catch (err) {
    saveStatusEl.textContent = err && err.message ? err.message : String(err);
  } finally {
    executeLockButton.textContent = '立刻锁定账户';
    setBusy(false);
  }
});

startButton.addEventListener('click', () => {
  if (isBlockedPage) return;
  showStepControls(false);
  runCommand('tradovate-auto-lock:start', '正在定位第 1 步...');
});

nextButton.addEventListener('click', () => {
  if (isBlockedPage) return;
  runCommand('tradovate-auto-lock:next', '正在执行当前高亮步骤...');
});

clearButton.addEventListener('click', () => {
  if (isBlockedPage) return;
  runCommand('tradovate-auto-lock:clear', '正在退出测试...');
  showStepControls(false);
});

copySummaryButton.addEventListener('click', event => copyDiagnosticBundle(event, 'summary'));
copySummaryExpandedButton.addEventListener('click', event => copyDiagnosticBundle(event, 'summary'));
copySummaryFromOverlayButton.addEventListener('click', event => copyDiagnosticBundle(event, 'summary'));
copyDetailedButton.addEventListener('click', event => copyDiagnosticBundle(event, 'detailed'));
copyRawButton.addEventListener('click', event => {
  const ok = window.confirm('Raw 诊断包可能很长，也可能包含较多本地状态。只有 Codex 明确要求时再复制。确定复制 Raw？');
  if (ok) copyDiagnosticBundle(event, 'raw');
});
diagnosticDetailsEl.addEventListener('toggle', () => {
  if (!diagnosticDetailsEl.open || lastDiagnosticMarkdown) return;
  refreshDiagnosticPreview({ copy: false, level: 'summary' }).catch(err => {
    diagnosticPreviewEl.textContent = `诊断包生成失败：${err && err.message ? err.message : String(err)}`;
  });
});

resetOffsetButton.addEventListener('click', () => {
  if (isBlockedPage) return;
  runCommand('tradovate-auto-lock:reset-current-offset', '正在临时恢复默认偏移...');
});

nudgeEl.addEventListener('click', event => {
  if (isBlockedPage) return;
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'resetOffset') return;

  const dx = Number(button.dataset.dx);
  const dy = Number(button.dataset.dy);
  if (Number.isFinite(dx) && Number.isFinite(dy)) {
    adjust(dx, dy);
  }
});

applyPopupViewportHeight();
window.addEventListener('resize', applyPopupViewportHeight);
if (chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes) return;
    const changedKeys = Object.keys(changes);
    const settingsChanged = changedKeys.some(key =>
      key === settingsLockStorageKey() || key === monitorSettingsStorageKey()
    );
    if (settingsChanged) {
      scheduleLoad(50);
      return;
    }
    const runtimeChanged = changedKeys.some(key =>
      key === WS_CAPTURE_STORAGE_KEY || key === runtimeStateStorageKey()
    );
    if (runtimeChanged) {
      scheduleRuntimeRefresh(50);
    }
  });
}
load();
