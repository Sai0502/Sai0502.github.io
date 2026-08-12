(function () {
const SCRIPT_VERSION = '2026-07-21-live-state-step4-button-v31';
const SCRIPT_BUILD_LABEL = 'Tradovate PL Auto Lock v2026_0721_103000';
if (window.__tradovateAutoLockLoaded === SCRIPT_VERSION) return;
window.__tradovateAutoLockLoaded = SCRIPT_VERSION;

const HIGHLIGHT_ID = 'tradovate-auto-lock-highlight';
const STATUS_ID = 'tradovate-auto-lock-status';
const DOT_ID = 'tradovate-auto-lock-dot';
const LOCKOUT_OVERLAY_ID = 'tradovate-auto-lockout-overlay';
const LOCKOUT_TIMER_ID = 'tradovate-auto-lockout-timer';
const LOCKOUT_CLOSE_ID = 'tradovate-auto-lockout-close';
const LOCK_SETTING_PROMPT_ID = 'tradovate-lock-setting-prompt';
const SCHEDULED_LOCK_PROMPT_ID = 'tradovate-scheduled-lock-prompt';

let currentStep = 0;
let lastClickedRect = null;
let currentTarget = null;
let currentBaseRect = null;
let currentOffset = { x: 0, y: 0 };
let currentLabel = '';
let savedOffsets = {};
let lastClickDiagnostic = null;
let extensionContextValid = true;
let lockoutOverlayTimer = null;
let lockSettingPromptDismissed = false;
let lockoutOverlayDismissedForPage = false;
let lockSettingPromptRetryTimer = null;
let lockSettingPromptRetryCount = 0;
let lockSettingPromptObserverStarted = false;
let monitorLoopTimerId = null;
let monitorLoopRunning = false;
let scheduledLockPromptTimer = null;
let pagePromptSuppressedUntil = 0;
const runtimeDiagnosticEvents = [];

const OFFSET_STORAGE_KEY = 'tradovateAutoLockStepOffsets';
const WS_CAPTURE_STORAGE_KEY = 'tradovateWsCapture';
const DEFAULT_SCAN_INTERVAL_SECONDS = 60;
const MIN_SCAN_INTERVAL_SECONDS = 1;
const AUTO_LOCK_STATE_KEY = 'tradovateAutoLockState';
const LOCKOUT_OVERLAY_STATE_KEY = 'tradovateLockoutOverlayState';
const DEBUG_LOG_KEY = 'debugLog';
const LOCK_PROMPT_RETRY_INTERVAL_MS = 1500;
const LOCK_PROMPT_MAX_RETRIES = 40;

function pushRuntimeDiagnostic(type, details = {}) {
  try {
    runtimeDiagnosticEvents.push({
      at: Date.now(),
      time: new Date().toISOString(),
      type,
      details
    });
    while (runtimeDiagnosticEvents.length > 120) runtimeDiagnosticEvents.shift();
  } catch (_) {
  }
}

function serializeErrorForDiagnostics(err) {
  if (!err) return {};
  return {
    name: err.name || '',
    message: err.message || String(err),
    stack: truncateText(err.stack || '', 4000)
  };
}

window.addEventListener('error', event => {
  pushRuntimeDiagnostic('window.error', {
    message: event.message || '',
    source: event.filename || '',
    lineno: event.lineno || 0,
    colno: event.colno || 0,
    error: serializeErrorForDiagnostics(event.error)
  });
}, true);

window.addEventListener('unhandledrejection', event => {
  pushRuntimeDiagnostic('window.unhandledrejection', {
    reason: serializeErrorForDiagnostics(event.reason),
    reasonText: event.reason && event.reason.message ? event.reason.message : String(event.reason || '')
  });
}, true);

function accountScopedStorageKey(baseKey, accountId = extractTradovateAccountId()) {
  return `${baseKey}:${accountId || 'default'}`;
}

function settingsLockStorageKey(accountId = extractTradovateAccountId()) {
  return accountScopedStorageKey('tradovateSettingsLockedUntil', accountId);
}

function monitorSettingsStorageKey(accountId = extractTradovateAccountId()) {
  return accountScopedStorageKey('tradovateMonitorSettings', accountId);
}

function runtimeStateStorageKey(accountId = extractTradovateAccountId()) {
  return accountScopedStorageKey('tradovateRuntimeState', accountId);
}

function autoLockStateStorageKey(accountId = extractTradovateAccountId()) {
  return accountScopedStorageKey(AUTO_LOCK_STATE_KEY, accountId);
}

function lockoutOverlayStorageKey(accountId = extractTradovateAccountId()) {
  return accountScopedStorageKey(LOCKOUT_OVERLAY_STATE_KEY, accountId);
}

const STEPS = [
  {
    name: '手动锁定',
    label: '第 1 步：准备点击顶部“手动锁定”',
    clicked: '已点击“手动锁定”，正在查找“选择时间”',
    pattern: /手动锁定|Manual\s*Lock/i,
    targetSelector: 'button.manual-lockout-button, .manual-lockout-button',
    options: { topOnly: true, preferCenterTop: true, preferButton: true },
    timeoutMs: 4000,
    waitAfterClickMs: 1200,
    shouldClick: true
  },
  {
    name: '选择锁定时间',
    label: '第 2 步：准备点击当前账号行的“锁定时间”下拉框',
    clicked: '已点击“选择时间”，正在查找锁定周期选项',
    pattern: /选择时间|选择锁定时间|选择|Select\s*Time|Select/i,
    options: { preferButton: true },
    timeoutMs: 5000,
    waitAfterClickMs: 500,
    specialAction: 'selectAccountLockDurationDropdown',
    shouldClick: true
  },
  {
    name: '锁定时间选项',
    label: '第 3 步：准备点击锁定时间选项',
    clicked: '已选择锁定时间，正在查找最终“锁定交易”按钮',
    pattern: /交易日结束|中部标准|下午\s*4\s*点|4\s*pm|15\s*分钟|15\s*min|30\s*分钟|30\s*min|1\s*小时|1\s*hour|60\s*min/i,
    options: {
      excludeLastClicked: true,
      ignoreAriaExpanded: true,
      preferMenuItem: true,
      preferSmallest: true
    },
    timeoutMs: 5000,
    waitAfterClickMs: 900,
    specialAction: 'selectLockDuration',
    shouldClick: true
  },
  {
    name: '锁定账户',
    label: '第 4 步：已定位到“锁定账户”按钮，测试版不会点击',
    pattern: /锁定账户|锁定交易|Lock\s*Account|Lock\s*Trading/i,
    options: { preferButton: true },
    timeoutMs: 5000,
    waitAfterClickMs: 0,
    specialAction: 'newOrLegacyLockAction',
    shouldClick: false
  }
];

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isExtensionContextInvalidated(err) {
  return /Extension context invalidated|context invalidated|Extension context/i.test(err && err.message ? err.message : String(err));
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, data => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(data);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(items, () => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function appendDebugLog(event, details = {}) {
  try {
    const data = await storageGet({ [DEBUG_LOG_KEY]: [] });
    const list = Array.isArray(data[DEBUG_LOG_KEY]) ? data[DEBUG_LOG_KEY] : [];
    list.push({
      ts: new Date().toISOString(),
      build: SCRIPT_BUILD_LABEL,
      event,
      details
    });
    while (list.length > 120) list.shift();
    await storageSet({ [DEBUG_LOG_KEY]: list });
  } catch (_) {
  }
}

function debugLog(event, details = {}) {
  pushRuntimeDiagnostic('debugLog', { event, details });
  appendDebugLog(event, details);
}

function lockDurationFromText(text, fallback = 'end_of_day') {
  const value = String(text || '');
  if (/15\s*分钟|15\s*min/i.test(value)) return '15m';
  if (/30\s*分钟|30\s*min/i.test(value)) return '30m';
  if (/1\s*小时|1\s*hour|60\s*min/i.test(value)) return '1h';
  if (/交易日结束|中部标准|下午\s*4\s*点|4\s*pm|end\s*of\s*day/i.test(value)) return 'end_of_day';
  return fallback;
}

function lockDurationMs(lockDuration) {
  if (lockDuration === '15m') return 15 * 60 * 1000;
  if (lockDuration === '30m') return 30 * 60 * 1000;
  if (lockDuration === '1h') return 60 * 60 * 1000;
  return null;
}

function timePartsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function zonedWallTimeToUtcMs({ year, month, day, hour, minute = 0, second = 0 }, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const actual = timePartsInZone(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    guess += desiredAsUtc - actualAsUtc;
  }
  return guess;
}

function marketSessionEndMs(now = Date.now()) {
  const timeZone = 'America/New_York';
  const parts = timePartsInZone(new Date(now), timeZone);
  let end = zonedWallTimeToUtcMs({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 16
  }, timeZone);
  if (end <= now) {
    end = zonedWallTimeToUtcMs({
      year: parts.year,
      month: parts.month,
      day: parts.day + 1,
      hour: 16
    }, timeZone);
  }
  return end;
}

function lockExpiresAt(lockDuration, lockedAt = Date.now()) {
  const fixedMs = lockDurationMs(lockDuration);
  if (fixedMs) return lockedAt + fixedMs;
  return marketSessionEndMs(lockedAt);
}

function formatLockoutRemaining(expiresAt) {
  const totalSeconds = Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function removeLockoutOverlay() {
  if (lockoutOverlayTimer) {
    window.clearInterval(lockoutOverlayTimer);
    lockoutOverlayTimer = null;
  }
  document.getElementById(LOCKOUT_OVERLAY_ID)?.remove();
}

async function hideLockoutOverlayByUser() {
  debugLog('lockout_overlay.dismissed_by_user');
  lockoutOverlayDismissedForPage = true;
  removeLockoutOverlay();
}

function removeLockSettingPrompt() {
  document.getElementById(LOCK_SETTING_PROMPT_ID)?.remove();
}

function hideLockSettingPromptFor(reason) {
  if (document.getElementById(LOCK_SETTING_PROMPT_ID)) {
    debugLog('lock_setting_prompt.hidden', { reason });
    removeLockSettingPrompt();
  }
}

function suppressPagePrompts(reason, durationMs = 60 * 1000) {
  pagePromptSuppressedUntil = Date.now() + durationMs;
  lockSettingPromptDismissed = true;
  removeLockSettingPrompt();
  removeScheduledLockPrompt();
  debugLog('page_prompts.suppressed', {
    reason,
    until: pagePromptSuppressedUntil
  });
}

function currentBeijingParts(timestamp = Date.now()) {
  return timePartsInZone(new Date(timestamp), 'Asia/Shanghai');
}

function settingsUnlockAtBeijing4am(timestamp = Date.now()) {
  const { year, month, day, hour } = currentBeijingParts(timestamp);
  const addDays = hour >= 4 ? 1 : 0;
  return zonedWallTimeToUtcMs({
    year,
    month,
    day: day + addDays,
    hour: 4,
    minute: 0,
    second: 0
  }, 'Asia/Shanghai');
}

async function lockSettingsFromPrompt() {
  debugLog('lock_setting_prompt.lock_clicked');
  const now = Date.now();
  const until = settingsUnlockAtBeijing4am(now);
  const accountId = extractTradovateAccountId();
  const key = settingsLockStorageKey(accountId);
  await storageSet({
    [key]: until,
    settingsLockedUntil: null
  });
  debugLog('lock_setting_prompt.lock_succeeded', {
    accountId,
    settingsLockKey: key,
    now,
    nowBeijing: new Date(now).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    settingsLockedUntil: until,
    settingsLockedUntilBeijing: new Date(until).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
  });
  return { ok: true, settingsLockedUntil: until };
}

async function requestOpenExtensionPopup(reason) {
  debugLog('open_popup.requested', { reason });
  const result = await chrome.runtime.sendMessage({
    type: 'tradovate-auto-lock:open-popup',
    reason
  });
  if (!result || !result.ok) {
    const message = result && result.error ? result.error : '无法打开插件窗口，请手动点击 Chrome 插件图标';
    debugLog('open_popup.failed', { reason, error: message });
    window.alert(message);
    return { ok: false, error: message };
  }
  debugLog('open_popup.succeeded', { reason });
  return result;
}

function renderLockSettingPrompt() {
  if (lockSettingPromptDismissed) return;
  if (document.getElementById(LOCKOUT_OVERLAY_ID)) return;
  debugLog('lock_setting_prompt.render');

  let overlay = document.getElementById(LOCK_SETTING_PROMPT_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = LOCK_SETTING_PROMPT_ID;
    overlay.innerHTML = `
      <div class="tradovate-lock-setting-card" role="dialog" aria-live="assertive">
        <div class="tradovate-lock-setting-title">还没锁定设置</div>
        <div class="tradovate-lock-setting-line"></div>
        <div class="tradovate-lock-setting-actions">
          <button class="tradovate-lock-setting-button tradovate-lock-setting-button--primary" data-lock-setting-action="lock" type="button">锁定</button>
          <button class="tradovate-lock-setting-button tradovate-lock-setting-button--secondary" data-lock-setting-action="dismiss" type="button">不锁</button>
        </div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      display: grid;
      place-items: center;
      padding: 5vh 4vw;
      background: rgba(0, 0, 0, 0.62);
      color: #eef3f8;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    const style = document.createElement('style');
    style.textContent = `
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-card {
        box-sizing: border-box;
        width: min(92vw, 760px);
        border: 1px solid rgba(125, 151, 184, 0.55);
        border-radius: 18px;
        background: #101821;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        padding: 48px 42px;
        display: grid;
        gap: 24px;
        text-align: center;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-title {
        color: #ffb14a;
        font-size: clamp(34px, 4vw, 58px);
        line-height: 1.08;
        font-weight: 900;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-line {
        height: 1px;
        background: rgba(126, 151, 183, 0.65);
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-actions {
        display: flex;
        justify-content: center;
        gap: 18px;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-button {
        min-width: 160px;
        height: 56px;
        border-radius: 12px;
        border: 1px solid rgba(150, 167, 188, 0.45);
        font-size: 24px;
        font-weight: 800;
        cursor: pointer;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-button--primary {
        background: linear-gradient(180deg, #ffb347 0%, #ff8f1f 100%);
        color: #1b1308;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-button--secondary {
        background: rgba(255, 255, 255, 0.06);
        color: #d6dde8;
      }
      #${LOCK_SETTING_PROMPT_ID} .tradovate-lock-setting-button[disabled] {
        opacity: 0.6;
        cursor: wait;
      }
    `;
    overlay.appendChild(style);
    document.documentElement.appendChild(overlay);
    overlay.addEventListener('click', async (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-lock-setting-action]') : null;
      if (!button) return;
      const action = button.getAttribute('data-lock-setting-action');
      if (action === 'dismiss') {
        lockSettingPromptDismissed = true;
        debugLog('lock_setting_prompt.dismiss_clicked');
        removeLockSettingPrompt();
        return;
      }
      if (action === 'lock') {
        const buttons = Array.from(overlay.querySelectorAll('button'));
        buttons.forEach(btn => { btn.disabled = true; });
        try {
          lockSettingPromptDismissed = true;
          removeLockSettingPrompt();
          await requestOpenExtensionPopup('lock_setting_prompt');
        } catch (err) {
          buttons.forEach(btn => { btn.disabled = false; });
          debugLog('lock_setting_prompt.open_popup_failed', {
            error: err && err.message ? err.message : String(err)
          });
          console.warn('[TradovateAutoLock] open popup from lock-setting prompt failed:', err);
        }
      }
    });
  }
}

function removeScheduledLockPrompt() {
  document.getElementById(SCHEDULED_LOCK_PROMPT_ID)?.remove();
}

function scheduledLockPromptStorageKey(accountId, dateKey, timeText) {
  return `tradovateScheduledLockPrompt:${accountId || 'default'}:${dateKey}:${timeText || '10:30'}`;
}

function currentBeijingDateKey(timestamp = Date.now()) {
  const { year, month, day } = currentBeijingParts(timestamp);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseClockTime(value) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function scheduledLockPromptTimeMs(timeText, now = Date.now()) {
  const clock = parseClockTime(timeText);
  if (!clock) return null;
  const { year, month, day } = currentBeijingParts(now);
  return zonedWallTimeToUtcMs({
    year,
    month,
    day,
    hour: clock.hour,
    minute: clock.minute,
    second: 0
  }, 'Asia/Shanghai');
}

async function markScheduledLockPrompt(accountId, dateKey, timeText, status) {
  await storageSet({
    [scheduledLockPromptStorageKey(accountId, dateKey, timeText)]: {
      status,
      at: Date.now(),
      time: new Date().toISOString()
    }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function renderScheduledLockPrompt(cfg, accountId, dateKey) {
  if (document.getElementById(SCHEDULED_LOCK_PROMPT_ID)) return;
  const message = cfg.scheduledLockMessage || '10:30，流动性最好的时段结束';
  removeLockSettingPrompt();
  debugLog('scheduled_lock_prompt.render', {
    accountId,
    dateKey,
    scheduledLockTime: cfg.scheduledLockTime,
    message
  });

  const overlay = document.createElement('div');
  overlay.id = SCHEDULED_LOCK_PROMPT_ID;
  overlay.innerHTML = `
    <div class="tradovate-scheduled-lock-card" role="dialog" aria-live="assertive">
      <div class="tradovate-scheduled-lock-title">${escapeHtml(message)}</div>
      <div class="tradovate-scheduled-lock-line"></div>
      <div class="tradovate-scheduled-lock-actions">
        <button class="tradovate-scheduled-lock-button tradovate-scheduled-lock-button--primary" data-scheduled-lock-action="open" type="button">去锁定账号</button>
        <button class="tradovate-scheduled-lock-button tradovate-scheduled-lock-button--secondary" data-scheduled-lock-action="dismiss" type="button">不锁定</button>
      </div>
    </div>
  `;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: grid;
    place-items: center;
    padding: 5vh 4vw;
    background: rgba(0, 0, 0, 0.62);
    color: #eef3f8;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;
  const style = document.createElement('style');
  style.textContent = `
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-card {
      box-sizing: border-box;
      width: min(92vw, 760px);
      border: 1px solid rgba(125, 151, 184, 0.55);
      border-radius: 18px;
      background: #101821;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
      padding: 48px 42px;
      display: grid;
      gap: 24px;
      text-align: center;
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-title {
      color: #ffb14a;
      font-size: clamp(30px, 3.5vw, 48px);
      line-height: 1.18;
      font-weight: 900;
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-line {
      height: 1px;
      background: rgba(126, 151, 183, 0.65);
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-actions {
      display: flex;
      justify-content: center;
      gap: 18px;
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-button {
      min-width: 180px;
      height: 58px;
      border-radius: 12px;
      border: 1px solid rgba(150, 167, 188, 0.45);
      font-size: 24px;
      font-weight: 800;
      cursor: pointer;
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-button--primary {
      background: linear-gradient(180deg, #ffb347 0%, #ff8f1f 100%);
      color: #1b1308;
    }
    #${SCHEDULED_LOCK_PROMPT_ID} .tradovate-scheduled-lock-button--secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #d6dde8;
    }
  `;
  overlay.appendChild(style);
  document.documentElement.appendChild(overlay);

  overlay.addEventListener('click', async event => {
    const button = event.target && event.target.closest ? event.target.closest('[data-scheduled-lock-action]') : null;
    if (!button) return;
    const action = button.getAttribute('data-scheduled-lock-action');
    if (action === 'dismiss') {
      await markScheduledLockPrompt(accountId, dateKey, cfg.scheduledLockTime, 'dismissed');
      debugLog('scheduled_lock_prompt.dismiss_clicked', { accountId, dateKey });
      removeScheduledLockPrompt();
      return;
    }
    if (action === 'open') {
      button.disabled = true;
      try {
        lockSettingPromptDismissed = true;
        removeLockSettingPrompt();
        await markScheduledLockPrompt(accountId, dateKey, cfg.scheduledLockTime, 'opened_popup');
        removeScheduledLockPrompt();
        await requestOpenExtensionPopup('scheduled_lock_prompt');
      } catch (err) {
        button.disabled = false;
        debugLog('scheduled_lock_prompt.open_popup_failed', {
          error: err && err.message ? err.message : String(err)
        });
        console.warn('[TradovateAutoLock] open popup from scheduled prompt failed:', err);
      }
    }
  });
}

async function maybeShowScheduledLockPrompt(reason = 'timer') {
  if (Date.now() < pagePromptSuppressedUntil) return;
  if (document.getElementById(LOCKOUT_OVERLAY_ID) || document.getElementById(SCHEDULED_LOCK_PROMPT_ID)) return;
  if (hasActiveLockoutForPrompt()) return;

  const accountId = extractTradovateAccountId();
  if (!accountId || accountId === 'default') {
    debugLog('scheduled_lock_prompt.skip', { reason, cause: 'account_unresolved' });
    return;
  }
  const cfg = await readMonitorSettings(accountId);
  if (!cfg.scheduledLockEnabled) return;

  const scheduledAt = scheduledLockPromptTimeMs(cfg.scheduledLockTime);
  if (!Number.isFinite(scheduledAt)) {
    debugLog('scheduled_lock_prompt.skip', { reason, cause: 'invalid_time', scheduledLockTime: cfg.scheduledLockTime });
    return;
  }
  const now = Date.now();
  const promptWindowMs = 15 * 60 * 1000;
  if (now < scheduledAt || now > scheduledAt + promptWindowMs) return;

  const dateKey = currentBeijingDateKey(now);
  const key = scheduledLockPromptStorageKey(accountId, dateKey, cfg.scheduledLockTime);
  const data = await storageGet({ [key]: null });
  if (data[key] && data[key].status) {
    debugLog('scheduled_lock_prompt.skip', { reason, cause: 'already_handled', accountId, dateKey, status: data[key].status });
    return;
  }
  renderScheduledLockPrompt(cfg, accountId, dateKey);
}

function scheduleScheduledLockPromptChecks() {
  if (scheduledLockPromptTimer) window.clearInterval(scheduledLockPromptTimer);
  scheduledLockPromptTimer = window.setInterval(() => {
    maybeShowScheduledLockPrompt('timer').catch(err => {
      if (!isExtensionContextInvalidated(err)) console.warn('[TradovateAutoLock] scheduled lock prompt failed:', err);
    });
  }, 30 * 1000);
}

function parseRemainingDurationMs(text) {
  const value = String(text || '');
  const days = Number((value.match(/(\d+)\s*(?:天|days?)/i) || [])[1] || 0);
  const hours = Number((value.match(/(\d+)\s*(?:小时|hours?)/i) || [])[1] || 0);
  const minutes = Number((value.match(/(\d+)\s*(?:分钟|minutes?)/i) || [])[1] || 0);
  const totalMs = (((days * 24) + hours) * 60 + minutes) * 60 * 1000;
  return totalMs > 0 ? totalMs : 0;
}

function currentManualLockButtonState() {
  const button = document.querySelector('button.manual-lockout-button, .manual-lockout-button');
  const text = textOf(button);
  const className = typeof button?.className === 'string'
    ? button.className
    : String(button?.getAttribute?.('class') || '');
  const isLocked = Boolean(
    button &&
    (
      /manual-lockout-button--locked/.test(className) ||
      /^锁定\s*\d/i.test(text) ||
      /^locked\s*\d/i.test(text)
    )
  );
  return {
    text,
    className,
    isLocked,
    remainingMs: isLocked ? parseRemainingDurationMs(text) : 0
  };
}

function pageIndicatesLocked() {
  const bodyText = textOf(document.body);
  const buttonState = currentManualLockButtonState();
  if (buttonState.text && !buttonState.isLocked) return false;
  if (buttonState.isLocked) return true;
  return (
    /解锁交易|Unlock\s*Trading|交易已锁定|locked until|锁定结束时间|Lock ends/i.test(bodyText) ||
    false
  );
}

function hasActiveLockoutForPrompt() {
  const buttonState = currentManualLockButtonState();
  return Boolean(
    document.getElementById(LOCKOUT_OVERLAY_ID) ||
    (buttonState.isLocked && Number(buttonState.remainingMs) > 0)
  );
}

function matchTradovateAccountId(text) {
  const match = String(text || '').match(/\b[A-Z]{2,}\d{8,}\b/);
  return match ? match[0] : '';
}

function manualLockButtonsInfo() {
  return Array.from(document.querySelectorAll('button.manual-lockout-button, .manual-lockout-button'))
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        visible: isVisible(el),
        text: textOf(el).slice(0, 80),
        className: typeof el.className === 'string'
          ? el.className
          : String(el.getAttribute?.('class') || ''),
        rect: {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    });
}

function truncateText(value, maxLength = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function shortOuterHtml(el, maxLength = 2200) {
  if (!el || !el.outerHTML) return '';
  return truncateText(el.outerHTML, maxLength);
}

function elementInfo(el, index = 0) {
  const rect = el.getBoundingClientRect();
  return {
    index,
    tagName: el.tagName ? el.tagName.toLowerCase() : '',
    className: typeof el.className === 'string' ? el.className : String(el.getAttribute?.('class') || ''),
    text: truncateText(textOf(el), 1000),
    rect: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    outerHTML: shortOuterHtml(el)
  };
}

function collectPnlDomDiagnostics() {
  const balanceContainers = Array.from(document.querySelectorAll('.separator, .balance-row, [class*="balance"]'))
    .filter(el => /总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)|股权|Equity/i.test(textOf(el)))
    .slice(0, 12)
    .map(elementInfo);
  const totalPnlElements = allVisibleElements()
    .filter(el => /总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i.test(textOf(el)))
    .slice(0, 20)
    .map(elementInfo);
  const bodyText = textOf(document.body);
  const totalIndex = bodyText.search(/总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i);
  const totalPnlTextWindow = totalIndex >= 0
    ? truncateText(bodyText.slice(Math.max(0, totalIndex - 300), totalIndex + 900), 1400)
    : '';

  return {
    balanceContainers,
    totalPnlElements,
    totalPnlTextWindow
  };
}

async function queryPermissionState(name) {
  if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
    return { name, supported: false, state: 'unsupported' };
  }
  try {
    const result = await navigator.permissions.query({ name });
    return { name, supported: true, state: result.state || '' };
  } catch (err) {
    return {
      name,
      supported: true,
      state: 'query_failed',
      error: err && err.message ? err.message : String(err)
    };
  }
}

async function collectPermissionDiagnostics() {
  const names = ['notifications', 'clipboard-read', 'clipboard-write', 'geolocation', 'camera', 'microphone'];
  const queried = [];
  for (const name of names) {
    queried.push(await queryPermissionState(name));
  }
  return {
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'Notification API unavailable',
    queried
  };
}

function storageAvailability(kind) {
  try {
    const store = window[kind];
    const key = `__tradovate_diag_${Date.now()}`;
    store.setItem(key, '1');
    store.removeItem(key);
    return { available: true };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

function collectFeatureDiagnostics() {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : null;
  return {
    chromeRuntime: Boolean(chromeApi && chromeApi.runtime),
    chromeStorage: Boolean(chromeApi && chromeApi.storage && chromeApi.storage.local),
    chromeRuntimeId: chromeApi && chromeApi.runtime ? chromeApi.runtime.id || '' : '',
    extensionContextValid,
    fetch: typeof fetch === 'function',
    websocket: typeof WebSocket === 'function',
    notification: typeof Notification !== 'undefined',
    permissionsApi: Boolean(navigator.permissions && navigator.permissions.query),
    clipboardApi: Boolean(navigator.clipboard),
    localStorage: storageAvailability('localStorage'),
    sessionStorage: storageAvailability('sessionStorage'),
    indexedDB: typeof indexedDB !== 'undefined',
    serviceWorker: Boolean(navigator.serviceWorker),
    mutationObserver: typeof MutationObserver !== 'undefined',
    resizeObserver: typeof ResizeObserver !== 'undefined',
    intersectionObserver: typeof IntersectionObserver !== 'undefined',
    performanceApi: typeof performance !== 'undefined',
    cryptoRandomUUID: Boolean(cryptoApi && cryptoApi.randomUUID),
    requestIdleCallback: typeof requestIdleCallback === 'function',
    visualViewport: Boolean(window.visualViewport)
  };
}

function collectBrowserEnvironment() {
  const viewport = window.visualViewport;
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
      webdriver: navigator.webdriver,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      pdfViewerEnabled: navigator.pdfViewerEnabled,
      doNotTrack: navigator.doNotTrack || ''
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
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      visualViewport: viewport
        ? {
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
            scale: viewport.scale,
            offsetLeft: Math.round(viewport.offsetLeft),
            offsetTop: Math.round(viewport.offsetTop)
          }
        : null
    },
    screen: window.screen
      ? {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        }
      : null
  };
}

function safeUrlSummary(url) {
  try {
    const parsed = new URL(url, location.href);
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      searchPresent: Boolean(parsed.search),
      hashPresent: Boolean(parsed.hash)
    };
  } catch (_) {
    return { raw: truncateText(url, 220) };
  }
}

function collectPerformanceDiagnostics() {
  if (typeof performance === 'undefined') {
    return { available: false };
  }
  const navigation = performance.getEntriesByType
    ? performance.getEntriesByType('navigation').slice(-1).map(entry => ({
        type: entry.type,
        startTime: Math.round(entry.startTime),
        duration: Math.round(entry.duration),
        domContentLoadedEventEnd: Math.round(entry.domContentLoadedEventEnd || 0),
        loadEventEnd: Math.round(entry.loadEventEnd || 0),
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0
      }))
    : [];
  const resources = performance.getEntriesByType
    ? performance.getEntriesByType('resource').slice(-80).map(entry => ({
        name: safeUrlSummary(entry.name),
        initiatorType: entry.initiatorType || '',
        startTime: Math.round(entry.startTime),
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
        responseStatus: entry.responseStatus || null
      }))
    : [];
  return {
    available: true,
    timeOrigin: performance.timeOrigin || null,
    memory: performance.memory
      ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        }
      : null,
    navigation,
    resourceCount: performance.getEntriesByType ? performance.getEntriesByType('resource').length : null,
    recentResources: resources
  };
}

function collectPageStructureDiagnostics() {
  const scripts = Array.from(document.scripts || [])
    .map(script => script.src || '')
    .filter(Boolean)
    .slice(0, 80)
    .map(safeUrlSummary);
  return {
    documentElementClass: document.documentElement ? document.documentElement.className || '' : '',
    bodyClass: document.body ? document.body.className || '' : '',
    bodyChildCount: document.body ? document.body.children.length : 0,
    scriptSrcs: scripts,
    activeElement: document.activeElement ? elementInfo(document.activeElement, 0) : null
  };
}

async function buildDebugSnapshot() {
  const accountId = extractTradovateAccountId();
  const settingsKey = settingsLockStorageKey(accountId);
  const monitorSettingsKey = monitorSettingsStorageKey(accountId);
  const runtimeKey = runtimeStateStorageKey(accountId);
  const overlayKey = lockoutOverlayStorageKey(accountId);
  const autoKey = autoLockStateStorageKey(accountId);
  const autoState = await getAutoLockState();
  const overlayData = await storageGet({ [overlayKey]: {}, settingsLockedUntil: null });
  const overlayState = overlayData[overlayKey] || {};
  const settingsData = await storageGet({ [settingsKey]: null, [monitorSettingsKey]: null, [runtimeKey]: null, settingsLockedUntil: null });
  const settingsLockedUntil = Number(settingsData[settingsKey]) || null;
  const buttonInfo = manualLockButtonsInfo();
  const manualLockButton = buttonInfo.find(item => item.visible);
  const now = Date.now();
  const lockButtonState = currentManualLockButtonState();
  return {
    build: SCRIPT_BUILD_LABEL,
    scriptVersion: SCRIPT_VERSION,
    pageUrl: location.href,
    pageTitle: document.title || '',
    readyState: document.readyState,
    pageIndicatesLocked: pageIndicatesLocked(),
    lockButtonState,
    hasLockoutOverlay: Boolean(document.getElementById(LOCKOUT_OVERLAY_ID)),
    hasLockSettingPrompt: Boolean(document.getElementById(LOCK_SETTING_PROMPT_ID)),
    manualLockButtonFound: Boolean(manualLockButton),
    manualLockButtons: buttonInfo,
    lockSettingPromptDismissed,
    lockSettingPromptRetryCount,
    now,
    nowBeijing: new Date(now).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    settingsLockStorageKey: settingsKey,
    monitorSettingsStorageKey: monitorSettingsKey,
    runtimeStateStorageKey: runtimeKey,
    settingsLockedUntil,
    settingsLockedUntilBeijing: settingsLockedUntil
      ? new Date(settingsLockedUntil).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      : '',
    settingsLockActive: Boolean(settingsLockedUntil && settingsLockedUntil > now),
    lockoutOverlayDismissedForPage,
    monitorLoopRunning,
    monitorLoopTimerActive: Boolean(monitorLoopTimerId),
    overlayStorageKey: overlayKey,
    autoStateStorageKey: autoKey,
    legacyGlobalSettingsLockedUntil: Number(settingsData.settingsLockedUntil) || null,
    accountIdGuess: accountId,
    overlayState,
    autoState,
    monitorSettings: settingsData[monitorSettingsKey] || null,
    runtimeState: settingsData[runtimeKey] || null
  };
}

async function readCurrentPageState() {
  const result = await extractTradovatePnl();
  const accountId = result.accountId || extractTradovateAccountId();
  const tradeStats = await readWebSocketTradeStats(accountId);
  const tradePositionGuard = tradeCountPositionGuard(tradeStats, result);
  const now = Date.now();
  const runtimeKey = runtimeStateStorageKey(accountId);
  const existing = (await storageGet({ [runtimeKey]: {} }))[runtimeKey] || {};
  const runtimeState = {
    ...existing,
    lastPnl: Number.isFinite(Number(result.pnl)) ? result.pnl : null,
    lastOpenPnl: hasFiniteNumberValue(result.openPnl) ? Number(result.openPnl) : null,
    lastEquity: Number.isFinite(Number(result.equity)) ? result.equity : null,
    lastPnlSource: result.source || '',
    lastVisiblePositionStatus: result.visiblePositionStatus || null,
    lastTradePositionGuard: tradePositionGuard,
    lastTradeStatsAccountId: accountId,
    lastSeenAt: now,
    lastPageUrl: location.href,
    lastPageTitle: document.title || '',
    lastTradeStats: tradeStats,
    lastCalendarCandidates: [{
      day: '',
      pnl: result.pnl,
      text: `${result.text || ''}; openPnl ${hasFiniteNumberValue(result.openPnl) ? result.openPnl : 'n/a'}; source ${result.source || ''}; account ${accountId || ''}; date ${result.dateKey || ''}`
    }]
  };
  await storageSet({ [runtimeKey]: runtimeState });
  debugLog('popup_live_read.updated_runtime_state', {
    accountId,
    pnl: runtimeState.lastPnl,
    pnlSource: runtimeState.lastPnlSource,
    tradeCountToday: tradeStats ? tradeStats.tradeCountToday : null
  });
  return {
    ok: true,
    accountId,
    runtimeKey,
    runtimeState,
    tradeStats,
    pnlExtraction: result,
    tradePositionGuard
  };
}

async function buildDiagnosticBundle() {
  const accountId = extractTradovateAccountId();
  const settingsKey = settingsLockStorageKey(accountId);
  const monitorSettingsKey = monitorSettingsStorageKey(accountId);
  const runtimeKey = runtimeStateStorageKey(accountId);
  const overlayKey = lockoutOverlayStorageKey(accountId);
  const autoKey = autoLockStateStorageKey(accountId);
  const storageData = await storageGet({
    [settingsKey]: null,
    [monitorSettingsKey]: null,
    [runtimeKey]: null,
    [overlayKey]: null,
    [autoKey]: null,
    [WS_CAPTURE_STORAGE_KEY]: null,
    [DEBUG_LOG_KEY]: []
  });
  let pnlExtraction = null;
  try {
    pnlExtraction = await extractTradovatePnl();
  } catch (err) {
    pnlExtraction = { ok: false, error: err && err.message ? err.message : String(err) };
  }

  return {
    copiedAt: new Date().toISOString(),
    copiedAtBeijing: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    purpose: 'Layered Diagnostic Bundle for Codex debugging. Summary is preferred; Detailed and Raw are available only when deeper inspection is needed.',
    limitations: [
      'Chrome extensions cannot read DevTools console history directly after the fact.',
      'Network details are based on PerformanceResourceTiming summaries, not full request/response bodies.',
      'Page JavaScript globals from the main world may be inaccessible from the isolated content script.'
    ],
    page: {
      url: location.href,
      title: document.title || '',
      readyState: document.readyState,
      visibilityState: document.visibilityState || '',
      focused: document.hasFocus()
    },
    build: {
      scriptBuild: SCRIPT_BUILD_LABEL,
      scriptVersion: SCRIPT_VERSION
    },
    accountId,
    browserEnvironment: collectBrowserEnvironment(),
    permissions: await collectPermissionDiagnostics(),
    featureDetection: collectFeatureDiagnostics(),
    performance: collectPerformanceDiagnostics(),
    websocketCapture: storageData[WS_CAPTURE_STORAGE_KEY] || null,
    pageStructure: collectPageStructureDiagnostics(),
    pnlExtraction,
    domDiagnostics: collectPnlDomDiagnostics(),
    runtimeDiagnosticEvents: runtimeDiagnosticEvents.slice(-120),
    debugSnapshot: await buildDebugSnapshot(),
    storage: {
      settingsLockedUntil: storageData[settingsKey] || null,
      monitorSettings: storageData[monitorSettingsKey] || null,
      runtimeState: storageData[runtimeKey] || null,
      overlayState: storageData[overlayKey] || null,
      autoState: storageData[autoKey] || null,
      debugLogTail: Array.isArray(storageData[DEBUG_LOG_KEY])
        ? storageData[DEBUG_LOG_KEY].slice(-80)
        : []
    }
  };
}

function clearLockSettingPromptRetryTimer() {
  if (lockSettingPromptRetryTimer) {
    window.clearInterval(lockSettingPromptRetryTimer);
    lockSettingPromptRetryTimer = null;
  }
}

async function maybeShowLockSettingPrompt(reason = 'direct') {
  const buttonInfo = manualLockButtonsInfo();
  debugLog('lock_setting_prompt.check_start', {
    reason,
    readyState: document.readyState,
    pageIndicatesLocked: pageIndicatesLocked(),
    hasOverlay: Boolean(document.getElementById(LOCKOUT_OVERLAY_ID)),
    buttonCount: buttonInfo.length,
    visibleButtonCount: buttonInfo.filter(item => item.visible).length,
    buttons: buttonInfo
  });
  if (lockSettingPromptDismissed) return;
  if (document.getElementById(LOCKOUT_OVERLAY_ID)) {
    hideLockSettingPromptFor('lockout_overlay_visible');
    debugLog('lock_setting_prompt.skip', { reason: 'lockout_overlay_visible' });
    return;
  }
  if (document.getElementById(SCHEDULED_LOCK_PROMPT_ID)) {
    hideLockSettingPromptFor('scheduled_lock_prompt_visible');
    debugLog('lock_setting_prompt.skip', { reason: 'scheduled_lock_prompt_visible' });
    return;
  }
  const autoState = await getAutoLockState();
  const accountId = extractTradovateAccountId();
  if (accountId === 'default') {
    hideLockSettingPromptFor('account_unresolved');
    debugLog('lock_setting_prompt.skip', { reason: 'account_unresolved' });
    return;
  }
  const settingsKey = settingsLockStorageKey(accountId);
  const settingsData = await storageGet({ [settingsKey]: null });
  const settingsLockedUntil = Number(settingsData[settingsKey]) || null;
  if (autoState && autoState.status === 'locked' && Number(autoState.lockExpiresAt) > Date.now()) {
    await restoreLockoutOverlay().catch(() => {});
    hideLockSettingPromptFor('account_locked');
    debugLog('lock_setting_prompt.skip', {
      reason: 'account_locked',
      source: 'auto_state',
      lockExpiresAt: autoState.lockExpiresAt || null
    });
    return;
  }
  if (pageIndicatesLocked()) {
    await restoreLockoutOverlay().catch(() => {});
    hideLockSettingPromptFor('account_locked');
    debugLog('lock_setting_prompt.skip', {
      reason: 'account_locked',
      source: 'page_state'
    });
    return;
  }
  if (settingsLockedUntil && settingsLockedUntil > Date.now()) {
    hideLockSettingPromptFor('settings_already_locked');
    debugLog('lock_setting_prompt.skip', {
      reason: 'settings_already_locked',
      accountId,
      settingsLockKey: settingsKey,
      settingsLockedUntil,
      settingsLockedUntilBeijing: new Date(settingsLockedUntil).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
    });
    return;
  }
  const manualLockButton = buttonInfo.find(item => item.visible);
  if (manualLockButton) {
    renderLockSettingPrompt();
    debugLog('lock_setting_prompt.shown');
  } else {
    debugLog('lock_setting_prompt.skip', {
      reason: 'manual_lock_button_not_found',
      buttonCount: buttonInfo.length,
      visibleButtonCount: buttonInfo.filter(item => item.visible).length
    });
  }
}

function scheduleLockSettingPromptChecks() {
  clearLockSettingPromptRetryTimer();
  lockSettingPromptRetryCount = 0;
  lockSettingPromptRetryTimer = window.setInterval(() => {
    lockSettingPromptRetryCount += 1;
    if (
      lockSettingPromptRetryCount > LOCK_PROMPT_MAX_RETRIES ||
      document.getElementById(LOCKOUT_OVERLAY_ID) ||
      lockSettingPromptDismissed
    ) {
      clearLockSettingPromptRetryTimer();
      return;
    }
    maybeShowLockSettingPrompt('retry').catch(err => {
      if (!isExtensionContextInvalidated(err)) {
        console.warn('[TradovateAutoLock] retry show lock-setting prompt failed:', err);
      }
    });
  }, LOCK_PROMPT_RETRY_INTERVAL_MS);

  if (!lockSettingPromptObserverStarted) {
    lockSettingPromptObserverStarted = true;
    const observer = new MutationObserver(() => {
      if (
        document.getElementById(LOCKOUT_OVERLAY_ID) ||
        lockSettingPromptDismissed
      ) {
        return;
      }
      maybeShowLockSettingPrompt('mutation').catch(err => {
        if (!isExtensionContextInvalidated(err)) {
          console.warn('[TradovateAutoLock] mutation show lock-setting prompt failed:', err);
        }
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('focus', () => {
      maybeShowLockSettingPrompt('focus').catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        maybeShowLockSettingPrompt('visibility').catch(() => {});
      }
    });
  }
}

function renderLockoutOverlay(state) {
  if (!state || Number(state.expiresAt) <= Date.now()) {
    removeLockoutOverlay();
    return;
  }
  const overlayKey = lockoutOverlayStorageKey(state.accountId || extractTradovateAccountId());

  let overlay = document.getElementById(LOCKOUT_OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = LOCKOUT_OVERLAY_ID;
    overlay.innerHTML = `
      <div class="tradovate-lockout-card" role="dialog" aria-live="assertive">
        <button id="${LOCKOUT_CLOSE_ID}" class="tradovate-lockout-close" type="button" aria-label="关闭">×</button>
        <div class="tradovate-lockout-title">熔断才是保命之道</div>
        <div class="tradovate-lockout-line"></div>
        <div id="${LOCKOUT_TIMER_ID}" class="tradovate-lockout-timer"></div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: grid;
      place-items: center;
      padding: 5vh 4vw;
      background: rgba(0, 0, 0, 0.72);
      color: #eef3f8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    `;
    const style = document.createElement('style');
    style.textContent = `
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-card {
        box-sizing: border-box;
        position: relative;
        width: min(92vw, 1180px);
        min-height: min(58vh, 520px);
        display: grid;
        align-content: center;
        gap: clamp(28px, 4vh, 52px);
        padding: clamp(42px, 7vw, 88px);
        border: 1px solid rgba(125, 151, 184, 0.55);
        border-radius: 18px;
        background: #101821;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        text-align: center;
      }
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-title {
        color: #ff4d57;
        font-size: clamp(42px, 5vw, 82px);
        line-height: 1.08;
        font-weight: 900;
        letter-spacing: 0;
      }
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-line {
        height: 1px;
        background: rgba(126, 151, 183, 0.65);
      }
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-timer {
        color: #d6dde8;
        font-size: clamp(46px, 6vw, 96px);
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0;
      }
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-close {
        position: absolute;
        top: 18px;
        right: 20px;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(150, 167, 188, 0.45);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: #b8c2d0;
        cursor: pointer;
        font-size: 26px;
        line-height: 1;
      }
      #${LOCKOUT_OVERLAY_ID} .tradovate-lockout-close:hover {
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.72);
      }
    `;
    overlay.appendChild(style);
    document.documentElement.appendChild(overlay);
    document.getElementById(LOCKOUT_CLOSE_ID)?.addEventListener('click', hideLockoutOverlayByUser);
  }

  const update = async () => {
    const timer = document.getElementById(LOCKOUT_TIMER_ID);
    if (timer) timer.textContent = formatLockoutRemaining(state.expiresAt);
    if (Number(state.expiresAt) <= Date.now()) {
      removeLockoutOverlay();
      await storageSet({
        [overlayKey]: {
          ...state,
          active: false,
          expiredAt: Date.now()
        }
      });
    }
  };
  update();
  if (lockoutOverlayTimer) window.clearInterval(lockoutOverlayTimer);
  lockoutOverlayTimer = window.setInterval(update, 1000);
}

async function persistAndShowLockoutOverlay(lockDuration, lockedAt = Date.now(), accountId = extractTradovateAccountId()) {
  const overlayKey = lockoutOverlayStorageKey(accountId);
  const state = {
    accountId,
    active: true,
    dismissed: false,
    lockDuration,
    lockedAt,
    expiresAt: lockExpiresAt(lockDuration, lockedAt)
  };
  await storageSet({ [overlayKey]: state });
  renderLockoutOverlay(state);
  return state;
}

async function restoreLockoutOverlay() {
  debugLog('lockout_overlay.restore_start');
  if (lockoutOverlayDismissedForPage) {
    removeLockoutOverlay();
    debugLog('lockout_overlay.not_restored', {
      reason: 'dismissed_for_page'
    });
    return;
  }
  const accountId = extractTradovateAccountId();
  if (accountId === 'default') {
    removeLockoutOverlay();
    debugLog('lockout_overlay.not_restored', {
      reason: 'account_unresolved'
    });
    return;
  }
  const overlayKey = lockoutOverlayStorageKey(accountId);
  const data = await storageGet({
    [overlayKey]: {}
  });
  const state = data[overlayKey] || {};
  const autoState = await getAutoLockState(accountId);
  const lockButtonState = currentManualLockButtonState();
  if (!state.active || Number(state.expiresAt) <= Date.now()) {
    if (
      autoState &&
      autoState.status === 'locked' &&
      Number(autoState.lockExpiresAt) > Date.now()
    ) {
      const recoveredState = {
        accountId,
        active: true,
        dismissed: false,
        lockDuration: autoState.lockDuration || 'end_of_day',
        lockedAt: Number(autoState.lockedAt) || Date.now(),
        expiresAt: Number(autoState.lockExpiresAt)
      };
      await storageSet({ [overlayKey]: recoveredState });
      debugLog('lockout_overlay.restored_from_auto_state', recoveredState);
      renderLockoutOverlay(recoveredState);
      return;
    }
    if (lockButtonState.isLocked && Number(lockButtonState.remainingMs) > 0) {
      const recoveredState = {
        accountId,
        active: true,
        dismissed: false,
        lockDuration: 'page_detected',
        lockedAt: Date.now(),
        expiresAt: Date.now() + Number(lockButtonState.remainingMs)
      };
      await storageSet({ [overlayKey]: recoveredState });
      debugLog('lockout_overlay.restored_from_page_lock', {
        ...recoveredState,
        buttonText: lockButtonState.text
      });
      renderLockoutOverlay(recoveredState);
      return;
    }
    if (state.active && Number(state.expiresAt) <= Date.now()) {
      debugLog('lockout_overlay.expired', { expiresAt: state.expiresAt || null });
      await storageSet({
        [overlayKey]: {
          ...state,
          active: false,
          expiredAt: Date.now()
        }
      });
    }
    removeLockoutOverlay();
    debugLog('lockout_overlay.not_restored', {
      reason: 'inactive_or_expired',
      accountId,
      stateActive: Boolean(state.active),
      expiresAt: state.expiresAt || null,
      autoStateStatus: autoState.status || '',
      lockButtonText: lockButtonState.text || ''
    });
    return;
  }
  if (state.lockDuration === 'page_detected' && !lockButtonState.isLocked) {
    await storageSet({
      [overlayKey]: {
        ...state,
        active: false,
        invalidatedAt: Date.now(),
        invalidatedReason: 'page_no_longer_locked'
      }
    });
    removeLockoutOverlay();
    debugLog('lockout_overlay.not_restored', {
      reason: 'page_detected_state_invalidated',
      accountId,
      lockButtonText: lockButtonState.text || ''
    });
    return;
  }
  debugLog('lockout_overlay.restored_from_overlay_state', {
    expiresAt: state.expiresAt || null,
    lockDuration: state.lockDuration || ''
  });
  renderLockoutOverlay(state);
}

async function loadOffsets() {
  const data = await storageGet({ [OFFSET_STORAGE_KEY]: {} });
  savedOffsets = data[OFFSET_STORAGE_KEY] || {};
}

async function saveOffsetForStep(stepIndex, offset = currentOffset) {
  if (!Number.isFinite(stepIndex)) return;
  savedOffsets[String(stepIndex)] = {
    x: Number(offset.x) || 0,
    y: Number(offset.y) || 0
  };
  await storageSet({ [OFFSET_STORAGE_KEY]: savedOffsets });
}

async function resetCurrentOffset() {
  if (!Number.isFinite(currentStep)) {
    return { ok: false, error: '当前没有可恢复的步骤' };
  }
  currentOffset = { x: 0, y: 0 };
  await saveOffsetForStep(currentStep, currentOffset);
  redrawHighlight();
  return {
    ok: true,
    done: false,
    stepIndex: currentStep,
    stepName: STEPS[currentStep]?.name || '',
    message: `已恢复并保存第 ${currentStep + 1} 步默认定位`
  };
}

async function resetOffsets() {
  savedOffsets = {};
  currentOffset = { x: 0, y: 0 };
  await storageSet({ [OFFSET_STORAGE_KEY]: {} });
  redrawHighlight();
  return { ok: true, done: false, message: '已清空保存的定位偏移' };
}

function stepOffset(stepIndex) {
  const item = savedOffsets[String(stepIndex)] || {};
  return {
    x: Number(item.x) || 0,
    y: Number(item.y) || 0
  };
}

function textOf(el) {
  return String(el ? (el.innerText || el.textContent || '') : '').replace(/\s+/g, ' ').trim();
}

function parseMoney(text) {
  if (!text) return null;
  const compact = String(text).replace('−', '-').replace(/,/g, '').trim();
  const parenNegative = /\(\s*\$?\s*[-+]?\d/.test(compact);
  const match = compact.match(/[-+]?\$?\s*\d+(?:\.\d+)?|\$?\s*[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace('$', '').replace(/\s+/g, ''));
  if (!Number.isFinite(value)) return null;
  return parenNegative ? -Math.abs(value) : value;
}

function hasFiniteNumberValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function moneyValueRegex() {
  return /[-+−]?\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$?\s*[-+−]\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\(\s*\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*\)/g;
}

function ownText(el) {
  if (!el) return '';
  return Array.from(el.childNodes || [])
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join(' ')
    .trim();
}

function ownOrShortText(el) {
  const text = String(ownText(el) || textOf(el)).replace(/\s+/g, ' ').trim();
  return text.length <= 80 ? text : '';
}

function tradingDateKeyBeijing() {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractTradovateAccountId() {
  const fromBody = matchTradovateAccountId(textOf(document.body));
  if (fromBody) return fromBody;

  const fromHtml = matchTradovateAccountId(document.documentElement?.innerHTML || '');
  if (fromHtml) return fromHtml;

  try {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      const value = key ? `${key} ${window.sessionStorage.getItem(key) || ''}` : '';
      const found = matchTradovateAccountId(value);
      if (found) return found;
    }
  } catch (_) {
  }

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      const value = key ? `${key} ${window.localStorage.getItem(key) || ''}` : '';
      const found = matchTradovateAccountId(value);
      if (found) return found;
    }
  } catch (_) {
  }

  return 'default';
}

function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function isAutoLockOverlay(el) {
  return Boolean(
    el &&
    (
      el.id === HIGHLIGHT_ID ||
      el.id === STATUS_ID ||
      el.id === DOT_ID ||
      el.closest?.(`#${HIGHLIGHT_ID}, #${STATUS_ID}, #${DOT_ID}`)
    )
  );
}

function allVisibleElements(root = document.body) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (!isAutoLockOverlay(node) && isVisible(node)) out.push(node);
    node = walker.nextNode();
  }
  return out;
}

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function virtualElementFromRect(rect, clickEl = null) {
  return {
    __virtualHighlightTarget: true,
    clickEl,
    getBoundingClientRect() {
      return rect;
    }
  };
}

function shiftedVirtualElement(el, offset) {
  const rect = el.getBoundingClientRect();
  const target = virtualElementFromRect(
    new DOMRect(rect.left + offset.x, rect.top + offset.y, rect.width, rect.height),
    el
  );
  target.__manualOffsetTarget = true;
  return target;
}

function findLockModalRoot() {
  const titlePattern = /锁定所有模拟账户的交易权限|Lock.*Trading/i;
  const selectPattern = /选择锁定时间|选择时间|交易日结束|15\s*分钟|30\s*分钟|1\s*小时|Select|15\s*min|30\s*min|1\s*hour|60\s*min/i;
  const actionPattern = /锁定交易|Lock\s*Trading/i;
  const cancelPattern = /撤销|取消|Cancel/i;
  const candidates = [];

  for (const el of allVisibleElements()) {
    const own = ownShortText(el);
    const text = textOf(el);
    if (!titlePattern.test(own || text)) continue;

    let cur = el;
    for (let depth = 0; cur && cur !== document.body && depth < 10; depth += 1) {
      if (!isVisible(cur)) {
        cur = cur.parentElement;
        continue;
      }

      const containerText = textOf(cur);
      if (
        titlePattern.test(containerText) &&
        selectPattern.test(containerText) &&
        actionPattern.test(containerText) &&
        cancelPattern.test(containerText)
      ) {
        const rect = cur.getBoundingClientRect();
        const modalSized =
          rect.width >= 420 &&
          rect.width <= Math.min(window.innerWidth - 20, 1100) &&
          rect.height >= 260 &&
          rect.height <= Math.max(window.innerHeight + 200, 1100);
        if (modalSized) {
          candidates.push({
            el: cur,
            area: rect.width * rect.height,
            depth
          });
        }
      }

      cur = cur.parentElement;
    }
  }

  candidates.sort((a, b) => a.area - b.area || a.depth - b.depth);
  return candidates.length ? candidates[0].el : null;
}

function clickableAncestor(el, options = {}) {
  let cur = el;
  for (let depth = 0; cur && cur !== document.body && depth < 8; depth += 1) {
    const tag = cur.tagName ? cur.tagName.toLowerCase() : '';
    const role = cur.getAttribute ? cur.getAttribute('role') : '';
    const style = window.getComputedStyle(cur);
    if (
      tag === 'button' ||
      tag === 'a' ||
      role === 'button' ||
      (!options.ignoreAriaExpanded && cur.hasAttribute('aria-expanded')) ||
      style.cursor === 'pointer'
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return el;
}

function actionButtonAncestor(el, pattern) {
  const candidates = [];
  let cur = el;
  for (let depth = 0; cur && cur !== document.body && depth < 10; depth += 1) {
    if (!isVisible(cur)) {
      cur = cur.parentElement;
      continue;
    }

    const text = textOf(cur);
    if (!pattern.test(text)) {
      cur = cur.parentElement;
      continue;
    }

    const rect = cur.getBoundingClientRect();
    const tag = cur.tagName ? cur.tagName.toLowerCase() : '';
    const role = cur.getAttribute ? String(cur.getAttribute('role') || '') : '';
    const style = window.getComputedStyle(cur);
    const looksButtonSized =
      rect.width >= 90 &&
      rect.width <= 420 &&
      rect.height >= 34 &&
      rect.height <= 96;

    if (looksButtonSized) {
      let score = rect.width * rect.height;
      if (tag === 'button' || role === 'button') score += 12000;
      if (style.cursor === 'pointer') score += 6000;
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') score += 2000;
      candidates.push({ el: cur, score });
    }

    cur = cur.parentElement;
  }

  if (!candidates.length) return clickableAncestor(el);
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].el;
}

function rgbTriplets(value) {
  return Array.from(String(value || '').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/gi))
    .map(match => ({
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3])
    }));
}

function hasWarmButtonPaint(style) {
  const colors = [
    ...rgbTriplets(style.backgroundColor),
    ...rgbTriplets(style.backgroundImage)
  ];
  return colors.some(({ r, g, b }) => r >= 170 && g >= 70 && g <= 190 && b <= 90);
}

function findCancelButtonRect(root = null) {
  const cancel = findByText(/撤销|取消|Cancel/i, { preferButton: true, root });
  if (!cancel) return null;
  return clickableAncestor(cancel).getBoundingClientRect();
}

function lockTradeVirtualTargetFromCancel(root = null) {
  const cancelRect = findCancelButtonRect(root);
  if (!cancelRect) return null;

  const gap = 16;
  const width = Math.max(170, Math.min(260, cancelRect.width * 1.5));
  const rect = new DOMRect(
    cancelRect.left - gap - width,
    cancelRect.top,
    width,
    cancelRect.height
  );

  const centerEl = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
  return virtualElementFromRect(rect, centerEl);
}

function findWarmLockButtonPaint(root) {
  const rootRect = root.getBoundingClientRect();
  const cancelRect = findCancelButtonRect(root);
  const candidates = allVisibleElements(root)
    .map(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const sizedLikeFinalButton =
        rect.width >= 150 &&
        rect.width <= 330 &&
        rect.height >= 42 &&
        rect.height <= 90;
      if (!sizedLikeFinalButton || !hasWarmButtonPaint(style)) return null;

      let score = 1000;
      if (cancelRect) {
        const sameRow = Math.abs((rect.top + rect.height / 2) - (cancelRect.top + cancelRect.height / 2));
        const leftOfCancel = cancelRect.left - rect.right;
        score -= sameRow * 10;
        score -= Math.abs(leftOfCancel - 16) * 2;
        if (rect.right <= cancelRect.left && leftOfCancel >= 4 && leftOfCancel <= 80) score += 1200;
      }

      const lowerHalfStart = rootRect.top + rootRect.height * 0.55;
      if (rect.top >= lowerHalfStart) score += 700;
      score -= Math.abs((rect.left + rect.width / 2) - (rootRect.left + rootRect.width * 0.60)) / 3;
      return { el, rect, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;

  const { rect, el } = candidates[0];
  const centerEl = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
  return virtualElementFromRect(new DOMRect(rect.left, rect.top, rect.width, rect.height), centerEl || el);
}

function lockTradeButtonTarget(found, pattern) {
  const modalRoot = findLockModalRoot();
  if (!modalRoot) {
    throw new Error('找不到锁定交易弹窗本体，已停止，避免误定位背景交易按钮');
  }
  const warmPaint = findWarmLockButtonPaint(modalRoot);
  if (warmPaint) return warmPaint;

  const geometric = lockTradeVirtualTargetFromCancel(modalRoot);
  if (geometric) return geometric;

  const foundRect = found.getBoundingClientRect();
  const foundCenterX = foundRect.left + foundRect.width / 2;

  const candidates = allVisibleElements(modalRoot)
    .map(el => {
      const text = textOf(el);
      if (!pattern.test(text)) return null;

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      const role = el.getAttribute ? String(el.getAttribute('role') || '') : '';
      const buttonSized =
        rect.width >= 120 &&
        rect.width <= 360 &&
        rect.height >= 34 &&
        rect.height <= 90;
      if (!buttonSized) return null;

      let score = 0;
      const compactText = text.replace(/\s+/g, '');
      if (/^锁定交易$|^LockTrading$/i.test(compactText)) score += 1000;
      if (hasWarmButtonPaint(style)) score += 900;
      if (tag === 'button' || role === 'button') score += 500;
      if (style.cursor === 'pointer') score += 300;
      score -= Math.abs((rect.left + rect.width / 2) - foundCenterX) / 2;
      score -= Math.abs(rect.top - foundRect.top) / 6;
      return { el, score, rect };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (candidates.length) return candidates[0].el;

  return actionButtonAncestor(found, pattern);
}

function targetForStep(found, step) {
  if (step.options && step.options.preferActionButton) {
    return lockTradeButtonTarget(found, step.pattern);
  }
  return clickableAncestor(found, step.options);
}

async function findStepTarget(step, timeoutMs = 4000) {
  if (step.targetSelector) {
    const el = await waitForSelector(step.targetSelector, timeoutMs);
    if (el) return el;
  }
  const found = await waitForText(step.pattern, step.options, timeoutMs);
  if (!found) return null;
  return targetForStep(found, step);
}

function centerOf(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    rect
  };
}

function elementSignature(el) {
  if (!el) return 'none';
  const className = typeof el.className === 'string'
    ? el.className
    : String(el.getAttribute?.('class') || '');
  const text = textOf(el).slice(0, 80);
  return `${el.tagName ? el.tagName.toLowerCase() : 'node'}${className ? `.${className.replace(/\s+/g, '.')}` : ''}${text ? ` text="${text}"` : ''}`;
}

function containsOrIs(parent, child) {
  return Boolean(parent && child && (parent === child || parent.contains?.(child)));
}

function clickDiagnosticFor(el) {
  const { x, y, rect } = centerOf(el);
  const hit = document.elementFromPoint(x, y);
  return {
    x: Math.round(x),
    y: Math.round(y),
    target: elementSignature(el.clickEl || el),
    hit: elementSignature(hit),
    hitInsideTarget: containsOrIs(el.clickEl || el, hit) || containsOrIs(hit, el.clickEl || el),
    rect: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };
}

function firePointerSequence(el, includeClick = true) {
  const { x, y } = centerOf(el);
  const hit = document.elementFromPoint(x, y);
  if (!hit && el.__manualOffsetTarget) {
    throw new Error('当前偏移后的点击点不在可见页面内，请把红框移动到可见按钮/选项上再继续。');
  }
  const target = hit || el.clickEl || el;
  for (const type of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter', 'pointermove', 'mousemove']) {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    }));
  }
  if (!includeClick) return;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    }));
  }
}

function firePointerEventSequence(el, includeClick = true) {
  const { x, y } = centerOf(el);
  const hit = document.elementFromPoint(x, y);
  if (!hit && el.__manualOffsetTarget) {
    throw new Error('当前偏移后的点击点不在可见页面内，请把红框移动到可见按钮/选项上再继续。');
  }
  const target = hit || el.clickEl || el;
  const pointerInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: includeClick ? 1 : 0
  };
  const mouseInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: includeClick ? 1 : 0
  };

  for (const type of ['pointerover', 'pointerenter', 'pointermove']) {
    target.dispatchEvent(new PointerEvent(type, pointerInit));
  }
  for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
    target.dispatchEvent(new MouseEvent(type, mouseInit));
  }
  if (!includeClick) return target;

  target.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
  target.dispatchEvent(new MouseEvent('mousedown', mouseInit));
  target.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit, buttons: 0 }));
  target.dispatchEvent(new MouseEvent('mouseup', { ...mouseInit, buttons: 0 }));
  target.dispatchEvent(new MouseEvent('click', { ...mouseInit, buttons: 0 }));
  return target;
}

function clickElement(el, options = {}) {
  const target = clickableAncestor(el, options);
  firePointerSequence(target, true);
  if (typeof target.click === 'function') target.click();
  lastClickedRect = target.getBoundingClientRect();
}

function clickExact(el) {
  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'center', inline: 'center' });
  }
  if (typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
  }
  lastClickDiagnostic = clickDiagnosticFor(el);
  if (!el.__virtualHighlightTarget && typeof el.click === 'function') {
    el.click();
  } else {
    firePointerEventSequence(el, true);
    if (!el.__manualOffsetTarget) {
      firePointerSequence(el, true);
    }
  }
  lastClickedRect = el.getBoundingClientRect();
}

function clickCurrentTarget() {
  if (!currentTarget) throw new Error('当前没有可点击目标');
  const hasManualOffset = currentOffset.x !== 0 || currentOffset.y !== 0;
  clickExact(hasManualOffset ? shiftedVirtualElement(currentTarget, currentOffset) : currentTarget);
}

function clickSavedStepTarget(el, stepIndex, label = '') {
  const offset = stepOffset(stepIndex);
  clickExact(offset.x || offset.y ? shiftedVirtualElement(el, offset) : el);
  debugLog('real_lockout.step_clicked', {
    stepIndex,
    label,
    offset,
    diagnostic: lastClickDiagnostic
  });
}

function ownShortText(el) {
  const direct = Array.from(el.childNodes || [])
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const text = direct || textOf(el);
  return text.length <= 120 ? text : '';
}

function findByText(pattern, options = {}) {
  const root = options.root || (options.withinLockModal ? findLockModalRoot() : null) || document.body;
  const elements = allVisibleElements(root)
    .map(el => {
      const text = ownShortText(el);
      if (!text || !pattern.test(text)) return null;
      const rect = el.getBoundingClientRect();
      if (options.excludeLastClicked && rectsOverlap(rect, lastClickedRect)) return null;
      let score = 0;
      if (options.topOnly) score -= rect.top;
      if (options.preferCenterTop) {
        score -= Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / 10;
        score -= rect.top / 10;
      }
      if (options.preferSmallest) {
        score -= (rect.width * rect.height) / 1000;
      }
      if (options.preferMenuItem) {
        const role = el.getAttribute ? String(el.getAttribute('role') || '') : '';
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        const style = window.getComputedStyle(el);
        if (/option|menuitem|listitem/i.test(role)) score += 80;
        if (tag === 'li') score += 60;
        if (style.cursor === 'pointer') score += 30;
        if (rect.top > (lastClickedRect ? lastClickedRect.bottom - 4 : 0)) score += 20;
      }
      if (options.preferButton) {
        const clickable = clickableAncestor(el, options);
        const tag = clickable.tagName ? clickable.tagName.toLowerCase() : '';
        if (tag === 'button' || clickable.getAttribute('role') === 'button') score += 20;
      }
      return { el, text, rect, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return elements.length ? elements[0].el : null;
}

async function waitForText(pattern, options = {}, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = findByText(pattern, options);
    if (el) return el;
    await sleep(150);
  }
  return null;
}

function clearHighlight() {
  document.getElementById(HIGHLIGHT_ID)?.remove();
  document.getElementById(STATUS_ID)?.remove();
  document.getElementById(DOT_ID)?.remove();
}

function highlightElement(el, label, offset = { x: 0, y: 0 }) {
  clearHighlight();
  currentTarget = el;
  currentBaseRect = el.getBoundingClientRect();
  currentOffset = {
    x: Number(offset.x) || 0,
    y: Number(offset.y) || 0
  };
  currentLabel = label;
  const rect = new DOMRect(
    currentBaseRect.left + currentOffset.x,
    currentBaseRect.top + currentOffset.y,
    currentBaseRect.width,
    currentBaseRect.height
  );
  const box = document.createElement('div');
  box.id = HIGHLIGHT_ID;
  box.style.cssText = `
    position: fixed;
    left: ${Math.max(0, rect.left - 8)}px;
    top: ${Math.max(0, rect.top - 8)}px;
    width: ${rect.width + 16}px;
    height: ${rect.height + 16}px;
    z-index: 2147483647;
    border: 5px solid #ff3131;
    border-radius: 10px;
    background: rgba(255, 49, 49, 0.08);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.24), 0 0 0 4px #ffcc4d, 0 0 34px rgba(255,49,49,0.95);
    pointer-events: none;
  `;
  const dot = document.createElement('div');
  dot.id = DOT_ID;
  dot.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2 - 8}px;
    top: ${rect.top + rect.height / 2 - 8}px;
    width: 16px;
    height: 16px;
    z-index: 2147483647;
    border-radius: 999px;
    background: #ff3131;
    border: 3px solid #fff7cc;
    box-shadow: 0 0 18px rgba(255,49,49,1);
    pointer-events: none;
  `;
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(dot);
  firePointerSequence(virtualElementFromRect(rect, el), false);
}

function redrawHighlight() {
  if (!currentTarget) return;
  const target = currentTarget;
  const label = currentLabel;
  const offset = { ...currentOffset };
  highlightElement(target, label, offset);
}

async function adjustCurrentHighlight(dx, dy) {
  currentOffset.x += dx;
  currentOffset.y += dy;
  await saveOffsetForStep(currentStep, currentOffset);
  redrawHighlight();
  return {
    ok: true,
    done: false,
    stepIndex: currentStep,
    stepName: STEPS[currentStep]?.name || '',
    message: `已调整并保存第 ${currentStep + 1} 步位置：x=${currentOffset.x}, y=${currentOffset.y}`
  };
}

async function locateStep(stepIndex) {
  await loadOffsets();
  const step = STEPS[stepIndex];
  if (!step) return { ok: true, done: true, message: '流程结束' };

  const cfg = ['selectLockDuration'].includes(step.specialAction) ? await readMonitorSettings() : null;
  let target = null;
  if (step.specialAction === 'selectAccountLockDurationDropdown') {
    target = await findAccountDurationSelectTarget(step.timeoutMs);
  } else if (step.specialAction === 'selectLockDuration') {
    target = await findNewLockDurationOptionTarget(cfg.lockDuration, 1200) ||
      await findLockDurationOptionTarget(cfg.lockDuration, step.timeoutMs);
  } else if (step.specialAction === 'newOrLegacyLockAction') {
    target = await findNewOrLegacyLockActionTarget(step.timeoutMs);
  } else {
    target = await findStepTarget(step, step.timeoutMs);
  }
  if (!target) throw new Error(`第 ${stepIndex + 1} 步找不到“${step.name}”`);

  const label = step.specialAction === 'selectLockDuration'
    ? `${step.label}：${lockDurationLabel(cfg.lockDuration)}`
    : step.label;
  highlightElement(target, label, stepOffset(stepIndex));
  return {
    ok: true,
    done: false,
    stepIndex,
    stepName: step.name,
    message: label,
    canClick: step.shouldClick
  };
}

async function startStepTest() {
  suppressPagePrompts('start_step_test');
  currentStep = 0;
  clearHighlight();
  await loadOffsets();
  return locateStep(currentStep);
}

async function nextStep() {
  const step = STEPS[currentStep];
  if (!step) return { ok: true, done: true, message: '流程结束' };

  const clickedStepIndex = currentStep;
  if (!currentTarget) await locateStep(currentStep);

  if (step.specialAction === 'selectLockDuration') {
    const clickedOffset = { ...currentOffset };
    clickCurrentTarget();
    currentStep += 1;
    await sleep(step.waitAfterClickMs);
    const oldModalStillOpen = document.body.classList.contains('modal-open') || Boolean(document.querySelector('.manual-lockout-modal'));
    const oldLockButtonExists = Boolean(document.querySelector(
      'button.manual-lockout-modal__button--warning, .manual-lockout-modal__button--warning'
    ));
    const newLockButtonExists = Boolean(findNewAccountLockActionButtonOnce());
    if ((!oldModalStillOpen || !oldLockButtonExists) && !newLockButtonExists) {
      redrawHighlight();
      throw new Error(`点击当前位置后锁定弹窗消失或锁定账户按钮不可见。点击诊断：${JSON.stringify(lastClickDiagnostic)}`);
    }
    await saveOffsetForStep(clickedStepIndex, clickedOffset);
    const nextResult = await locateStep(currentStep);
    return {
      ...nextResult,
      previousClicked: step.name,
      message: `${step.clicked}；${nextResult.message}；点击坐标 ${lastClickDiagnostic.x},${lastClickDiagnostic.y}`
    };
  }

  const clickedOffset = { ...currentOffset };

  if (!step.shouldClick) {
    clickCurrentTarget();
    await sleep(900);
    const oldConfirmButton = await waitForSelector(
      'button.confirmation-modal__button--confirm, .confirmation-modal__button--confirm',
      1200
    );
    const newConfirmButton = oldConfirmButton || await waitForActionByText(
      () => findVisibleModalRootByText(/锁定所选账户的交易|锁定所选账户|Lock.*selected/i, [
        /无法下达新的交易|无法下达|锁定账户|返回|Lock/i
      ]) || document.body,
      /是[，,]?\s*锁定账户|是的[，,]?\s*锁定账户|Yes.*Lock/i,
      4000,
      { preferActionButton: true, preferLower: true, preferRight: true }
    );
    if (!newConfirmButton) {
      redrawHighlight();
      throw new Error('点击当前位置后，没有进入二次确认弹窗。请继续微调高亮框位置。');
    }
    await saveOffsetForStep(clickedStepIndex, clickedOffset);
    highlightElement(newConfirmButton, '已进入二次确认：测试模式不会点击确认锁定按钮');
    return {
      ok: true,
      done: true,
      stepIndex: currentStep,
      stepName: step.name,
      message: `已进入二次确认，并保存第 ${currentStep + 1} 步偏移：x=${currentOffset.x}, y=${currentOffset.y}`
    };
  }

  await sleep(120);
  clickCurrentTarget();
  currentStep += 1;
  await sleep(step.waitAfterClickMs);

  const nextResult = await locateStep(currentStep);
  await saveOffsetForStep(clickedStepIndex, clickedOffset);
  return {
    ...nextResult,
    previousClicked: step.name,
    message: `${step.clicked}；${nextResult.message}`
  };
}

async function runAutoLockTest() {
  await startStepTest();
  let result = null;
  while (currentStep < STEPS.length - 1) {
    result = await nextStep();
  }
  return result || locateStep(currentStep);
}

async function waitForSelector(selector, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = document.querySelector(selector);
    if (el && isVisible(el)) return el;
    await sleep(150);
  }
  return null;
}

function lockDurationPattern(lockDuration = 'end_of_day') {
  if (lockDuration === '15m') return /15\s*分钟|15\s*min/i;
  if (lockDuration === '30m') return /30\s*分钟|30\s*min/i;
  if (lockDuration === '1h') return /1\s*小时|1\s*hour|60\s*min/i;
  return /交易日结束|中部标准|4\s*点|4\s*pm|end\s*of\s*day/i;
}

function lockDurationLabel(lockDuration = 'end_of_day') {
  if (lockDuration === '15m') return '15分钟';
  if (lockDuration === '30m') return '30分钟';
  if (lockDuration === '1h') return '1小时';
  return '交易日结束 - NY 16:00';
}

function pickLockDurationOption(options, lockDuration = 'end_of_day') {
  const pattern = lockDurationPattern(lockDuration);
  return options.find(el => pattern.test(textOf(el))) || options[0];
}

async function findLockDurationOptionTarget(lockDuration = 'end_of_day', timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const options = visibleElements('button.manual-lockout-modal__dropdown-option, .manual-lockout-modal__dropdown-option');
    if (options.length) return pickLockDurationOption(options, lockDuration);
    await sleep(150);
  }
  return null;
}

function findNewManualLockButton() {
  const byClass = document.querySelector('button.manual-lockout-button, .manual-lockout-button');
  if (byClass && isVisible(byClass)) return byClass;
  const byText = findByText(/手动锁定|Manual\s*Lock/i, {
    topOnly: true,
    preferCenterTop: true,
    preferButton: true
  });
  return byText ? clickableAncestor(byText, { preferButton: true }) : null;
}

function findVisibleModalRootByText(titlePattern, requiredPatterns = []) {
  const candidates = [];
  for (const el of allVisibleElements()) {
    const own = ownShortText(el);
    const text = textOf(el);
    if (!titlePattern.test(own || text)) continue;

    let cur = el;
    for (let depth = 0; cur && cur !== document.body && depth < 12; depth += 1) {
      if (!isVisible(cur)) {
        cur = cur.parentElement;
        continue;
      }
      const containerText = textOf(cur);
      if (titlePattern.test(containerText) && requiredPatterns.every(pattern => pattern.test(containerText))) {
        const rect = cur.getBoundingClientRect();
        if (rect.width >= 360 && rect.height >= 180) {
          candidates.push({
            el: cur,
            area: rect.width * rect.height,
            depth
          });
        }
      }
      cur = cur.parentElement;
    }
  }
  candidates.sort((a, b) => a.area - b.area || a.depth - b.depth);
  return candidates.length ? candidates[0].el : null;
}

function firstVisibleElement(selectors, root = document) {
  for (const selector of selectors) {
    const elements = Array.from((root || document).querySelectorAll(selector));
    const found = elements.find(isVisible);
    if (found) return found;
  }
  return null;
}

function findNewAccountLockModalRoot() {
  return findVisibleModalRootByText(/选择要锁定的账户|Select\s+accounts?\s+to\s+lock/i, [
    /锁定时间|Lock\s*time/i,
    /锁定账户|Lock\s+Account/i
  ]);
}

function findNewAccountLockActionButtonOnce() {
  const explicit = firstVisibleElement([
    'button.lock-account',
    '.lock-account'
  ]);
  if (explicit) return explicit;

  const root = findNewAccountLockModalRoot();
  if (!root) return null;

  const inModal = firstVisibleElement([
    'button.lock-account',
    '.lock-account'
  ], root);
  if (inModal) return inModal;

  return findActionByText(root, /^(锁定账户|Lock\s+Account)$/i, {
    preferActionButton: true,
    preferLower: true,
    preferRight: true
  }) || findActionByText(root, /锁定账户|Lock\s+Account/i, {
    preferActionButton: true,
    preferLower: true,
    preferRight: true
  });
}

async function waitForNewAccountLockActionButton(timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const button = findNewAccountLockActionButtonOnce();
    if (button) return button;
    await sleep(150);
  }
  return null;
}

async function waitForNewAccountLockModal(timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const root = findNewAccountLockModalRoot();
    if (root) return root;
    await sleep(150);
  }
  return null;
}

function rowTextNearY(root, centerY, tolerance = 44) {
  return allVisibleElements(root)
    .filter(el => {
      const rect = el.getBoundingClientRect();
      const elCenterY = rect.top + rect.height / 2;
      return Math.abs(elCenterY - centerY) <= tolerance;
    })
    .map(textOf)
    .filter(Boolean)
    .join(' ');
}

function accountLockRows(root) {
  const seen = new Set();
  const rows = allVisibleElements(root)
    .map(el => {
      const shortText = ownOrShortText(el);
      const accountId = shortText ? matchTradovateAccountId(shortText) : '';
      if (!accountId || seen.has(accountId)) return null;
      seen.add(accountId);
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      return {
        accountId,
        accountEl: el,
        rect,
        centerY
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rect.top - b.rect.top);

  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const next = rows[index + 1];
    const fallbackHalfHeight = Math.max(24, row.rect.height * 1.5);
    const rowTop = previous
      ? (previous.centerY + row.centerY) / 2
      : row.centerY - (next ? (next.centerY - row.centerY) / 2 : fallbackHalfHeight);
    const rowBottom = next
      ? (row.centerY + next.centerY) / 2
      : row.centerY + (previous ? (row.centerY - previous.centerY) / 2 : fallbackHalfHeight);
    const rowText = allVisibleElements(root)
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        return centerY >= rowTop && centerY < rowBottom;
      })
      .map(ownOrShortText)
      .filter(Boolean)
      .join(' ');
    return {
      ...row,
      rowTop,
      rowBottom,
      rowText,
      locked: /已锁定|Locked/i.test(rowText) && !/未锁定|Unlocked/i.test(rowText)
    };
  });
}

function lockDurationSelectCandidates(root) {
  const pattern = /选择|交易日结束|15\s*分钟|30\s*分钟|1\s*小时|自定义|Select|end\s*of\s*day|15\s*min|30\s*min|1\s*hour|custom/i;
  return allVisibleElements(root)
    .map(el => {
      const own = ownOrShortText(el);
      const text = own || textOf(el);
      if (!pattern.test(text)) return null;
      const rect = el.getBoundingClientRect();
      const childButton = Array.from(el.querySelectorAll?.('button, [role="button"], [aria-expanded]') || [])
        .find(child => isVisible(child) && pattern.test(ownOrShortText(child) || textOf(child)));
      const clickable = childButton || clickableAncestor(el, { ignoreAriaExpanded: false });
      const clickableRect = clickable.getBoundingClientRect();
      const role = clickable.getAttribute ? String(clickable.getAttribute('role') || '') : '';
      const tag = clickable.tagName ? clickable.tagName.toLowerCase() : '';
      const looksLikeSelect =
        clickableRect.width >= 120 &&
        clickableRect.height >= 30 &&
        clickableRect.left > root.getBoundingClientRect().left + root.getBoundingClientRect().width * 0.45;
      if (!looksLikeSelect) return null;
      let score = 0;
      if (/选择|Select/i.test(text)) score += 500;
      if (tag === 'button' || role === 'button' || clickable.hasAttribute?.('aria-expanded')) score += 250;
      score += clickableRect.width;
      return { el: clickable, rect: clickableRect, text, score };
    })
    .filter(Boolean);
}

function findLockDurationSelectForAccount(root, preferredAccountId = '') {
  const rows = accountLockRows(root);
  if (!rows.length) return null;
  if (!preferredAccountId || preferredAccountId === 'default') return null;

  const targetRow = rows.find(row => row.accountId === preferredAccountId);
  if (!targetRow) return null;
  const selects = lockDurationSelectCandidates(root);
  const scored = selects
    .filter(item => {
      const centerY = item.rect.top + item.rect.height / 2;
      return centerY >= targetRow.rowTop && centerY < targetRow.rowBottom;
    })
    .map(item => ({
      ...item,
      accountId: targetRow.accountId,
      locked: targetRow.locked,
      score: item.score - Math.abs((item.rect.top + item.rect.height / 2) - targetRow.centerY) * 25
    }))
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0] : null;
}

async function findNewLockDurationOptionTarget(lockDuration = 'end_of_day', timeoutMs = 4000) {
  const started = Date.now();
  const pattern = lockDurationPattern(lockDuration);
  while (Date.now() - started < timeoutMs) {
    const options = allVisibleElements()
      .map(el => {
        const text = ownOrShortText(el) || textOf(el);
        if (!pattern.test(text)) return null;
        const target = clickableAncestor(el, { ignoreAriaExpanded: true });
        const rect = target.getBoundingClientRect();
        const role = target.getAttribute ? String(target.getAttribute('role') || '') : '';
        const tag = target.tagName ? target.tagName.toLowerCase() : '';
        let score = 0;
        if (tag === 'button' || /option|menuitem|listitem/i.test(role)) score += 500;
        if (rect.width >= 120 && rect.height >= 30) score += 200;
        if (lastClickedRect && rect.top >= lastClickedRect.top - 10) score += 100;
        score -= Math.abs(rect.left - (lastClickedRect ? lastClickedRect.left : rect.left)) / 5;
        return { el: target, text, rect, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    if (options.length) return options[0].el;
    await sleep(150);
  }
  return null;
}

async function findAccountDurationSelectTarget(timeoutMs = 5000) {
  const started = Date.now();
  const preferredAccountId = extractTradovateAccountId();
  while (Date.now() - started < timeoutMs) {
    const newRoot = await waitForNewAccountLockModal(300);
    if (newRoot) {
      const selected = findLockDurationSelectForAccount(newRoot, preferredAccountId);
      if (selected) return selected.el;
      if (!preferredAccountId || preferredAccountId === 'default') {
        throw new Error('没有识别到当前页面顶部账号，已停止测试，避免误定位其他账号。请复制诊断包 Summary 发给 Codex 排查。');
      }
    }

    const legacy = document.querySelector('button.manual-lockout-modal__dropdown-select, .manual-lockout-modal__dropdown-select');
    if (legacy && isVisible(legacy)) return legacy;
    await sleep(150);
  }
  return null;
}

async function findNewOrLegacyLockActionTarget(timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const newActionButton = findNewAccountLockActionButtonOnce();
    if (newActionButton) return newActionButton;

    const directButton = findActionByText(document.body, /^(锁定账户|Lock\s+Account)$/i, {
      preferActionButton: true,
      preferLower: true,
      preferRight: true
    });
    if (directButton) return directButton;

    const newRoot = findNewAccountLockModalRoot();
    if (newRoot) {
      const button = findActionByText(newRoot, /^(锁定账户|Lock\s+Account)$/i, {
        preferActionButton: true,
        preferLower: true,
        preferRight: true
      });
      if (button) return button;
    }

    const legacy = document.querySelector('button.manual-lockout-modal__button--warning, .manual-lockout-modal__button--warning');
    if (legacy && isVisible(legacy)) return legacy;
    await sleep(150);
  }
  return null;
}

function findActionByText(root, pattern, options = {}) {
  const oppositeActionPattern = /撤销|取消|Cancel/i;
  const candidates = allVisibleElements(root || document.body)
    .map(el => {
      const own = ownOrShortText(el);
      const text = own || textOf(el);
      const fullText = textOf(el);
      const ownMatches = own ? pattern.test(own) : false;
      if (!pattern.test(text)) return null;
      if (oppositeActionPattern.test(fullText) && !ownMatches) return null;
      const target = options.preferActionButton ? actionButtonAncestor(el, pattern) : clickableAncestor(el, { preferButton: true });
      const targetOwn = ownOrShortText(target);
      const targetText = textOf(target);
      if (oppositeActionPattern.test(targetText) && !(targetOwn && pattern.test(targetOwn))) return null;
      const rect = target.getBoundingClientRect();
      const tag = target.tagName ? target.tagName.toLowerCase() : '';
      const role = target.getAttribute ? String(target.getAttribute('role') || '') : '';
      const style = window.getComputedStyle(target);
      let score = 0;
      if (tag === 'button' || role === 'button') score += 900;
      if (targetOwn && pattern.test(targetOwn)) score += 1000;
      if (/^锁定账户$|^Lock\s*Account$/i.test(String(targetOwn || '').replace(/\s+/g, ' '))) score += 1400;
      if (hasWarmButtonPaint(style)) score += 700;
      if (rect.width >= 90 && rect.height >= 32) score += 200;
      score -= Math.max(0, rect.width - 260) / 2;
      score -= Math.max(0, rect.height - 76) * 3;
      if (options.preferLower) score += rect.top / 10;
      if (options.preferRight) score += rect.left / 10;
      return { el: target, rect, score, text };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].el : null;
}

async function waitForActionByText(rootProvider, pattern, timeoutMs = 5000, options = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const root = typeof rootProvider === 'function' ? rootProvider() : rootProvider;
    const target = findActionByText(root || document.body, pattern, options);
    if (target) return target;
    await sleep(150);
  }
  return null;
}

async function waitForVisibleButtonByClass(selector, label, timeoutMs = 5000) {
  const el = await waitForSelector(selector, timeoutMs);
  if (!el) throw new Error(`找不到${label}`);
  return el;
}

function visibleElements(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(isVisible);
}

function buttonDiagnostics(selector) {
  return visibleElements(selector).map((el, index) => {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const centerEl = document.elementFromPoint(centerX, centerY);
    return {
      index,
      text: textOf(el),
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      centerElement: centerEl
        ? `${centerEl.tagName.toLowerCase()}.${String(centerEl.className || '').replace(/\s+/g, '.')}`
        : 'none'
    };
  });
}

async function persistManualLockState(actualLockDuration, accountIdFromFlow = '') {
  const pnlResult = await extractTradovatePnl().catch(() => ({}));
  const accountId = accountIdFromFlow || pnlResult.accountId || extractTradovateAccountId();
  const dateKey = pnlResult.dateKey || tradingDateKeyBeijing();
  const overlayState = await persistAndShowLockoutOverlay(actualLockDuration, Date.now(), accountId);
  await setAutoLockState({
    status: 'locked',
    lockKey: `${accountId}:${dateKey}:manual`,
    kind: 'manual',
    pnl: Number.isFinite(Number(pnlResult.pnl)) ? Number(pnlResult.pnl) : null,
    accountId,
    dateKey,
    lockedAt: Date.now(),
    lockDuration: actualLockDuration,
    lockExpiresAt: overlayState.expiresAt,
    error: ''
  }, accountId);
  debugLog('auto_state.persisted_after_real_lockout', {
    accountId,
    dateKey,
    lockDuration: actualLockDuration,
    lockExpiresAt: overlayState.expiresAt
  });

  return {
    accountId,
    dateKey,
    overlayState
  };
}

async function executeLegacyLockoutAfterManualOpen(cfg) {
  const dropdown = await waitForVisibleButtonByClass(
    'button.manual-lockout-modal__dropdown-select, .manual-lockout-modal__dropdown-select',
    '“选择时间”下拉框',
    5000
  );
  clickSavedStepTarget(dropdown, 1, 'legacy duration dropdown');
  await sleep(300);

  const options = Array.from(document.querySelectorAll('button.manual-lockout-modal__dropdown-option, .manual-lockout-modal__dropdown-option'))
    .filter(isVisible);
  if (!options.length) throw new Error('找不到锁定时间下拉选项');
  const option = pickLockDurationOption(options, cfg.lockDuration);
  clickSavedStepTarget(option, 2, 'legacy duration option');
  await sleep(400);
  const selectedLockText = textOf(document.querySelector('.manual-lockout-modal__dropdown-placeholder')) || textOf(option);
  const actualLockDuration = lockDurationFromText(selectedLockText, cfg.lockDuration);

  const lockButton = await waitForVisibleButtonByClass(
    'button.manual-lockout-modal__button--warning, .manual-lockout-modal__button--warning',
    '“锁定交易”按钮',
    5000
  );
  clickSavedStepTarget(lockButton, 3, 'legacy lock button');
  await sleep(900);

  let confirmButton = await waitForSelector(
    'button.confirmation-modal__button--confirm, .confirmation-modal__button--confirm',
    5000
  );
  if (!confirmButton) {
    const diagnostics = buttonDiagnostics('button.manual-lockout-modal__button--warning, .manual-lockout-modal__button--warning');
    highlightElement(lockButton, '已点击“锁定交易”，但二次确认弹窗没有出现');
    throw new Error(`找不到二次确认“是的，锁定交易”按钮。锁定按钮诊断：${JSON.stringify(diagnostics)}`);
  }
  clickExact(confirmButton);
  const { overlayState } = await persistManualLockState(actualLockDuration);

  return {
    ok: true,
    done: true,
    message: '已发送 Tradovate 旧版锁定账户点击流程',
    lockDuration: actualLockDuration,
    lockExpiresAt: overlayState.expiresAt
  };
}

async function executeNewAccountLockoutAfterManualOpen(cfg, modalRoot, preferredAccountId) {
  const selected = findLockDurationSelectForAccount(modalRoot, preferredAccountId);
  if (!selected) {
    const rows = accountLockRows(modalRoot).map(row => ({
      accountId: row.accountId,
      locked: row.locked,
      rowText: truncateText(row.rowText, 240)
    }));
    throw new Error(`新版手动锁定弹窗中找不到账号对应的锁定时间下拉框。当前账号：${preferredAccountId || '未识别'}；账号行：${JSON.stringify(rows)}`);
  }

  if (selected.locked) {
    throw new Error(`账号 ${selected.accountId} 已显示为锁定状态，未重复锁定`);
  }

  debugLog('real_lockout.account_row_verified', {
    preferredAccountId,
    selectedAccountId: selected.accountId,
    selectedRowText: truncateText(selected.rowText, 240),
    selectedRect: {
      left: Math.round(selected.rect.left),
      top: Math.round(selected.rect.top),
      width: Math.round(selected.rect.width),
      height: Math.round(selected.rect.height)
    }
  });
  clickSavedStepTarget(selected.el, 1, 'new account duration dropdown');
  await sleep(300);

  const option = await findNewLockDurationOptionTarget(cfg.lockDuration, 5000);
  if (!option) throw new Error(`找不到新版锁定时间选项：${lockDurationLabel(cfg.lockDuration)}`);
  clickSavedStepTarget(option, 2, 'new duration option');
  await sleep(500);

  const refreshedRoot = findNewAccountLockModalRoot() || modalRoot;
  const selectedLockText = rowTextNearY(refreshedRoot, selected.rect.top + selected.rect.height / 2, 54) || textOf(option);
  const actualLockDuration = lockDurationFromText(selectedLockText, cfg.lockDuration);

  const lockAccountButton = await waitForNewAccountLockActionButton(5000);
  if (!lockAccountButton) throw new Error('找不到新版“锁定账户”按钮');
  clickSavedStepTarget(lockAccountButton, 3, 'new lock account button');
  await sleep(600);

  const confirmRoot = await (async () => {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      const root = findVisibleModalRootByText(/锁定所选账户的交易|锁定所选账户|Lock.*selected/i, [
        /无法下达新的交易|无法下达|锁定账户|返回|Lock/i
      ]);
      if (root) return root;
      await sleep(150);
    }
    return null;
  })();
  if (!confirmRoot) throw new Error('找不到新版二次确认弹窗');

  const confirmAccountIds = Array.from(new Set(
    Array.from(textOf(confirmRoot).matchAll(/\b[A-Z]{2,}\d{8,}\b/g), match => match[0])
  ));
  if (!confirmAccountIds.includes(selected.accountId) || confirmAccountIds.some(accountId => accountId !== selected.accountId)) {
    const backButton = findActionByText(confirmRoot, /不[，,]?\s*返回|取消|返回|No.*Back|Cancel/i, {
      preferActionButton: true,
      preferLower: true,
      preferRight: true
    });
    if (backButton) {
      clickExact(backButton);
      await sleep(300);
    }
    throw new Error(`二次确认弹窗账户不匹配，已停止锁定。预期：${selected.accountId}；实际：${confirmAccountIds.join(', ') || '未显示账户'}`);
  }
  debugLog('real_lockout.confirm_account_verified', {
    expectedAccountId: selected.accountId,
    confirmAccountIds
  });

  const confirmButton = findActionByText(
    confirmRoot,
    /是[，,]?\s*锁定账户|是的[，,]?\s*锁定账户|Yes.*Lock/i,
    { preferActionButton: true, preferLower: true, preferRight: true }
  );
  if (!confirmButton) throw new Error('找不到新版二次确认“是，锁定账户”按钮');
  clickExact(confirmButton);
  await sleep(1000);

  const resultRoot = await (async () => {
    const started = Date.now();
    while (Date.now() - started < 6000) {
      const root = findVisibleModalRootByText(/账户已锁定|accounts?\s+locked/i, [
        /关闭|Close/i
      ]);
      if (root) return root;
      await sleep(150);
    }
    return null;
  })();
  if (!resultRoot) throw new Error('点击确认后没有看到新版“账户已锁定”结果弹窗');

  const closeButton = findActionByText(resultRoot, /关闭|Close/i, {
    preferActionButton: true,
    preferLower: true,
    preferRight: true
  });
  if (closeButton) {
    clickExact(closeButton);
    await sleep(400);
  }

  const { overlayState, accountId } = await persistManualLockState(actualLockDuration, selected.accountId || preferredAccountId);

  return {
    ok: true,
    done: true,
    message: '已发送 Tradovate 新版锁定账户点击流程',
    accountId,
    lockDuration: actualLockDuration,
    lockExpiresAt: overlayState.expiresAt
  };
}

async function executeRealLockout() {
  clearHighlight();
  suppressPagePrompts('execute_real_lockout');
  const cfg = await readMonitorSettings();
  await loadOffsets();
  const preferredAccountId = extractTradovateAccountId();
  if (!preferredAccountId || preferredAccountId === 'default') {
    throw new Error('没有识别到当前页面顶部账号，已停止锁定，避免误锁其他账号。请复制诊断包 Summary 发给 Codex 排查。');
  }

  const manualLock = findNewManualLockButton();
  if (!manualLock) throw new Error('找不到顶部“手动锁定”按钮');
  clickSavedStepTarget(manualLock, 0, 'manual lock button');
  await sleep(500);

  const newModalRoot = await waitForNewAccountLockModal(10000);
  if (newModalRoot) {
    return executeNewAccountLockoutAfterManualOpen(cfg, newModalRoot, preferredAccountId);
  }

  const legacyDropdown = document.querySelector('button.manual-lockout-modal__dropdown-select, .manual-lockout-modal__dropdown-select');
  if (legacyDropdown && isVisible(legacyDropdown)) {
    return executeLegacyLockoutAfterManualOpen(cfg);
  }

  debugLog('real_lockout.modal_timeout', {
    preferredAccountId,
    waitedMs: 10000,
    manualLockButtonState: currentManualLockButtonState(),
    pageIndicatesLocked: pageIndicatesLocked()
  });
  throw new Error('点击“手动锁定”后 10 秒内没有出现新版账户选择弹窗，已停止，避免切换到未绑定账户的旧版定位流程。');
}

function extractTradovateEquityByGeometry() {
  const elements = allVisibleElements();
  const labelEls = elements.filter(el => /^(股权|Equity)$/i.test(ownOrShortText(el)));
  const valueEls = elements
    .map(el => {
      const text = ownOrShortText(el);
      if (!text || /target|保证金|margin|日止损|周损失|drawdown|未平仓|open/i.test(text)) return null;
      const matches = text.match(moneyValueRegex());
      if (!matches || matches.length !== 1) return null;
      const equity = parseMoney(matches[0]);
      if (equity === null || equity <= 0) return null;
      return { el, equity, text };
    })
    .filter(Boolean);

  for (const labelEl of labelEls) {
    const labelRect = labelEl.getBoundingClientRect();
    const labelCenterX = labelRect.left + labelRect.width / 2;
    const candidates = valueEls
      .map(item => {
        const rect = item.el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const yDistance = rect.top - labelRect.bottom;
        const xDistance = Math.abs(centerX - labelCenterX);
        return { ...item, xDistance, yDistance };
      })
      .filter(item => item.yDistance >= -8 && item.yDistance <= 160 && item.xDistance <= 160)
      .sort((a, b) => (a.xDistance + Math.max(0, a.yDistance)) - (b.xDistance + Math.max(0, b.yDistance)));

    if (candidates.length) {
      const best = candidates[0];
      return {
        equity: best.equity,
        source: 'tradovate visible equity',
        text: `${textOf(labelEl)} ${best.text}`
      };
    }
  }
  return null;
}

function extractTradovateEquityByText() {
  const body = textOf(document.body);
  const match = body.match(/(?:股权|Equity)\s*([-+−]?\$?\s*\d+(?:,\d{3})*(?:\.\d+)?|\$?\s*[-+−]?\s*\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:USD)?/i);
  if (!match) return null;
  const equity = parseMoney(match[1]);
  if (equity === null || equity <= 0) return null;
  return {
    equity,
    source: 'tradovate text equity',
    text: match[0].slice(0, 180)
  };
}

function extractTradovateTotalPnlByGeometry() {
  const elements = allVisibleElements();
  const labelEls = elements.filter(el => /^(总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss))$/i.test(ownOrShortText(el)));
  const valueEls = elements
    .map(el => {
      const text = ownOrShortText(el);
      if (!text || /target|保证金|margin|日止损|周损失|drawdown|股权|equity|未平仓|open/i.test(text)) return null;
      const matches = text.match(moneyValueRegex());
      if (!matches || matches.length !== 1) return null;
      const pnl = parseMoney(matches[0]);
      if (pnl === null) return null;
      return { el, pnl, text };
    })
    .filter(Boolean);

  for (const labelEl of labelEls) {
    const labelRect = labelEl.getBoundingClientRect();
    const labelCenterX = labelRect.left + labelRect.width / 2;
    const candidates = valueEls
      .map(item => {
        const rect = item.el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const yDistance = rect.top - labelRect.bottom;
        const xDistance = Math.abs(centerX - labelCenterX);
        return { ...item, xDistance, yDistance };
      })
      .filter(item => item.yDistance >= -8 && item.yDistance <= 120 && item.xDistance <= 140)
      .sort((a, b) => (a.xDistance + Math.max(0, a.yDistance)) - (b.xDistance + Math.max(0, b.yDistance)));

    if (candidates.length) {
      const best = candidates[0];
      return {
        pnl: best.pnl,
        source: 'tradovate visible total pnl',
        text: `${textOf(labelEl)} ${best.text}`
      };
    }
  }
  return null;
}

function extractTradovateTotalPnlByBalanceRows() {
  const containers = Array.from(document.querySelectorAll('.separator, [class*="balance"]'));
  for (const container of containers) {
    const rows = Array.from(container.querySelectorAll('.balance-row'));
    for (let index = 0; index < rows.length; index += 1) {
      const labels = Array.from(rows[index].querySelectorAll('.balance-column'))
        .map(el => textOf(el).replace(/\s+/g, ' ').trim());
      const totalIndex = labels.findIndex(label => /^(总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss))$/i.test(label));
      const openIndex = labels.findIndex(label => /^(未平仓损益|Open\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss))$/i.test(label));
      if (totalIndex < 0) continue;

      for (let valueIndex = index + 1; valueIndex < rows.length; valueIndex += 1) {
        const valueColumns = Array.from(rows[valueIndex].querySelectorAll('.balance-column'));
        if (valueColumns.length <= totalIndex) continue;
        const valueText = textOf(valueColumns[totalIndex]);
        const matches = valueText.match(moneyValueRegex()) || [];
        if (!matches.length) continue;
        const pnl = parseMoney(matches[0]);
        if (pnl === null) continue;
        let openPnl = null;
        if (openIndex >= 0 && valueColumns.length > openIndex) {
          const openMatches = textOf(valueColumns[openIndex]).match(moneyValueRegex()) || [];
          openPnl = openMatches.length ? parseMoney(openMatches[0]) : null;
        }
        return {
          pnl,
          openPnl,
          source: 'tradovate balance row total pnl',
          text: `${labels.join(' | ')} => ${valueColumns.map(el => textOf(el)).join(' | ')}`
        };
      }
    }
  }
  return null;
}

function extractTradovateTotalPnlByText() {
  const body = textOf(document.body);
  const match = body.match(/(?:总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss))\s*(\(\s*\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*\)|[-+−]?\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$?\s*[-+−]\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
  if (!match) return null;
  const pnl = parseMoney(match[1]);
  if (pnl === null) return null;
  return {
    pnl,
    source: 'tradovate text total pnl',
    text: match[0].slice(0, 180)
  };
}

function extractTradovateTotalPnlByAccountPanelText() {
  const candidates = allVisibleElements()
    .map(el => textOf(el))
    .filter(text => /总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i.test(text))
    .map(text => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);

  for (const text of candidates) {
    const totalIndex = text.search(/总损益|Total\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i);
    if (totalIndex < 0) continue;
    const afterTotal = text.slice(totalIndex);
    const matches = afterTotal.match(moneyValueRegex()) || [];
    if (!matches.length) continue;

    const hasThreeColumnAccountPanel =
      /股权|Equity/i.test(text) &&
      /未平仓损益|Open\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i.test(text);
    const raw = hasThreeColumnAccountPanel && matches.length >= 3 ? matches[2] : matches[0];
    const pnl = parseMoney(raw);
    if (pnl === null) continue;
    const openPnl = hasThreeColumnAccountPanel && matches.length >= 2 ? parseMoney(matches[1]) : null;
    return {
      pnl,
      openPnl,
      source: 'tradovate account panel total pnl',
      text: text.slice(Math.max(0, totalIndex - 80), totalIndex + 220)
    };
  }
  return null;
}

function extractTradovateOpenPnlByPanelText() {
  const candidates = allVisibleElements()
    .map(el => textOf(el))
    .filter(text => /未平仓损益|Open\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i.test(text))
    .map(text => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);

  for (const text of candidates) {
    const openIndex = text.search(/未平仓损益|Open\s*(?:P\/?L|PnL|Profit\s*\/?\s*Loss)/i);
    if (openIndex < 0) continue;
    const afterOpen = text.slice(openIndex);
    const matches = afterOpen.match(moneyValueRegex()) || [];
    if (!matches.length) continue;
    const openPnl = parseMoney(matches[0]);
    if (openPnl === null) continue;
    return {
      openPnl,
      text: afterOpen.slice(0, 180)
    };
  }
  return null;
}

function parseVisiblePositionStatusText(text, source = 'visible position text') {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  const zhMatch = value.match(/仓位\s*[:：]?\s*\+?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*[-−]\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (zhMatch) {
    const longQty = Number(zhMatch[1]);
    const shortQty = Number(zhMatch[2]);
    if (Number.isFinite(longQty) && Number.isFinite(shortQty)) {
      return {
        ok: true,
        source,
        longQty,
        shortQty,
        netAbs: Math.abs(longQty) + Math.abs(shortQty),
        hasOpenPosition: Math.abs(longQty) + Math.abs(shortQty) > 0,
        text: value.slice(Math.max(0, zhMatch.index - 80), zhMatch.index + zhMatch[0].length + 80)
      };
    }
  }

  const enMatch = value.match(/Position(?:s)?\s*[:：]?\s*([-+]?\s*[0-9]+(?:\.[0-9]+)?)/i);
  if (enMatch) {
    const qty = Number(String(enMatch[1]).replace(/\s+/g, ''));
    if (Number.isFinite(qty)) {
      return {
        ok: true,
        source,
        longQty: qty > 0 ? qty : 0,
        shortQty: qty < 0 ? Math.abs(qty) : 0,
        netAbs: Math.abs(qty),
        hasOpenPosition: Math.abs(qty) > 0,
        text: value.slice(Math.max(0, enMatch.index - 80), enMatch.index + enMatch[0].length + 80)
      };
    }
  }

  return null;
}

function extractVisiblePositionStatus() {
  const candidates = allVisibleElements()
    .map(el => textOf(el).replace(/\s+/g, ' ').trim())
    .filter(text => /仓位|Position/i.test(text))
    .sort((a, b) => a.length - b.length)
    .slice(0, 80);

  for (const text of candidates) {
    const parsed = parseVisiblePositionStatusText(text, 'visible position element');
    if (parsed) return parsed;
  }

  const bodyText = document.body ? (document.body.innerText || textOf(document.body)) : '';
  const parsedBody = parseVisiblePositionStatusText(bodyText, 'visible position body text');
  if (parsedBody) return parsedBody;

  const htmlText = document.body ? document.body.textContent || '' : '';
  const parsedHtml = parseVisiblePositionStatusText(htmlText, 'visible position textContent');
  if (parsedHtml) return parsedHtml;

  return {
    ok: false,
    source: 'visible position text no match',
    hasOpenPosition: null,
    text: candidates[0] || ''
  };
}

function isBaselinePnlSource(source) {
  return /baseline|equity/i.test(String(source || ''));
}

async function extractTradovatePnl() {
  const visiblePositionStatus = extractVisiblePositionStatus();
  const directPnlResult =
    extractTradovateTotalPnlByBalanceRows() ||
    extractTradovateTotalPnlByAccountPanelText() ||
    extractTradovateTotalPnlByGeometry() ||
    extractTradovateTotalPnlByText();
  if (directPnlResult) {
    const equityResult = extractTradovateEquityByGeometry() || extractTradovateEquityByText();
    const openPnlResult = hasFiniteNumberValue(directPnlResult.openPnl)
      ? { openPnl: directPnlResult.openPnl }
      : extractTradovateOpenPnlByPanelText();
    return {
      pnl: directPnlResult.pnl,
      openPnl: openPnlResult ? openPnlResult.openPnl : null,
      equity: equityResult ? equityResult.equity : null,
      baseline: null,
      accountId: extractTradovateAccountId(),
      dateKey: tradingDateKeyBeijing(),
      source: directPnlResult.source,
      text: directPnlResult.text,
      visiblePositionStatus
    };
  }

  const equityResult = extractTradovateEquityByGeometry() || extractTradovateEquityByText();
  if (!equityResult) {
    return {
      pnl: null,
      openPnl: null,
      equity: null,
      baseline: null,
      accountId: extractTradovateAccountId(),
      dateKey: tradingDateKeyBeijing(),
      source: 'tradovate total pnl no match',
      text: '',
      visiblePositionStatus
    };
  }

  return {
    pnl: null,
    openPnl: null,
    equity: equityResult.equity,
    baseline: null,
    accountId: extractTradovateAccountId(),
    dateKey: tradingDateKeyBeijing(),
    source: 'tradovate total pnl no match',
    text: equityResult.text,
    visiblePositionStatus
  };
}

function thresholdKind(pnl, cfg) {
  if (!Number.isFinite(Number(pnl))) return '';
  if (Number(pnl) <= -Math.abs(Number(cfg.dailyLossLimit || 200))) return 'loss';
  if (Number(pnl) >= Math.abs(Number(cfg.dailyProfitTarget || 300))) return 'profit';
  return '';
}

function pnlSame(a, b) {
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return false;
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function accountKey(value) {
  const key = String(value ?? '').trim();
  return key || '';
}

function selectWebSocketTradeStatsForAccount(capture, accountId) {
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

async function readWebSocketTradeStats(accountId = extractTradovateAccountId()) {
  const data = await storageGet({ [WS_CAPTURE_STORAGE_KEY]: null });
  const capture = data[WS_CAPTURE_STORAGE_KEY] && typeof data[WS_CAPTURE_STORAGE_KEY] === 'object'
    ? data[WS_CAPTURE_STORAGE_KEY]
    : null;
  return selectWebSocketTradeStatsForAccount(capture, accountId);
}

function tradeCountPositionGuard(tradeStats, pnlResult = null) {
  const visible = pnlResult && pnlResult.visiblePositionStatus;
  if (visible && visible.ok && typeof visible.hasOpenPosition === 'boolean') {
    return {
      source: visible.source || 'visible position text',
      available: true,
      hasOpenPosition: visible.hasOpenPosition,
      netAbs: Number(visible.netAbs) || 0,
      detail: visible
    };
  }

  return {
    source: 'visible_position_unavailable',
    available: false,
    hasOpenPosition: null,
    netAbs: null,
    detail: visible || null
  };
}

function tradeCountThresholdKind(tradeStats, cfg, pnlResult = null) {
  if (!cfg.tradeCountLockEnabled) return '';
  const limit = Number(cfg.dailyEntryLimit);
  const entries = tradeStats ? Number(tradeStats.tradeCountToday ?? tradeStats.flatToPositionEntriesToday) : NaN;
  if (!Number.isFinite(limit) || limit <= 0) return '';
  if (!Number.isFinite(entries)) return '';
  const guard = tradeCountPositionGuard(tradeStats, pnlResult);
  if (guard.hasOpenPosition !== false) return '';
  return entries >= limit ? 'trade_count' : '';
}

async function readMonitorSettings(accountId = extractTradovateAccountId()) {
  const scopedKey = monitorSettingsStorageKey(accountId);
  const cfg = await chrome.storage.local.get({
    [scopedKey]: null,
    autoMonitorEnabled: true,
    autoLockEnabled: true,
    dailyLossLimit: 200,
    dailyProfitTarget: 300,
    scanIntervalSeconds: DEFAULT_SCAN_INTERVAL_SECONDS,
    lockDuration: 'end_of_day',
    tradeCountLockEnabled: false,
    dailyEntryLimit: 30,
    scheduledLockEnabled: false,
    scheduledLockTime: '10:30',
    scheduledLockMessage: '10:30，流动性最好的时段结束'
  });
  const scoped = cfg[scopedKey] && typeof cfg[scopedKey] === 'object'
    ? cfg[scopedKey]
    : null;
  return {
    autoMonitorEnabled: scoped && typeof scoped.autoMonitorEnabled === 'boolean'
      ? scoped.autoMonitorEnabled
      : cfg.autoMonitorEnabled,
    autoLockEnabled: scoped && typeof scoped.autoLockEnabled === 'boolean'
      ? scoped.autoLockEnabled
      : cfg.autoLockEnabled,
    dailyLossLimit: Number(scoped && scoped.dailyLossLimit) > 0
      ? Number(scoped.dailyLossLimit)
      : Number(cfg.dailyLossLimit || 200),
    dailyProfitTarget: Number(scoped && scoped.dailyProfitTarget) > 0
      ? Number(scoped.dailyProfitTarget)
      : Number(cfg.dailyProfitTarget || 300),
    scanIntervalSeconds: Number(scoped && scoped.scanIntervalSeconds) > 0
      ? Number(scoped.scanIntervalSeconds)
      : Number(cfg.scanIntervalSeconds || DEFAULT_SCAN_INTERVAL_SECONDS),
    lockDuration: scoped && scoped.lockDuration
      ? scoped.lockDuration
      : (cfg.lockDuration || 'end_of_day'),
    tradeCountLockEnabled: scoped && typeof scoped.tradeCountLockEnabled === 'boolean'
      ? scoped.tradeCountLockEnabled
      : Boolean(cfg.tradeCountLockEnabled),
    dailyEntryLimit: Number(scoped && scoped.dailyEntryLimit) > 0
      ? Number(scoped.dailyEntryLimit)
      : Number(cfg.dailyEntryLimit || 30),
    scheduledLockEnabled: scoped && typeof scoped.scheduledLockEnabled === 'boolean'
      ? scoped.scheduledLockEnabled
      : Boolean(cfg.scheduledLockEnabled),
    scheduledLockTime: scoped && scoped.scheduledLockTime
      ? scoped.scheduledLockTime
      : (cfg.scheduledLockTime || '10:30'),
    scheduledLockMessage: scoped && scoped.scheduledLockMessage
      ? scoped.scheduledLockMessage
      : (cfg.scheduledLockMessage || '10:30，流动性最好的时段结束'),
    autoMonitorEnabled: true,
    autoLockEnabled: true
  };
}

async function setAutoLockState(values, accountId = extractTradovateAccountId()) {
  const key = autoLockStateStorageKey(accountId);
  const current = await storageGet({ [key]: {} });
  await storageSet({
    [key]: {
      ...(current[key] || {}),
      ...values
    }
  });
}

async function getAutoLockState(accountId = extractTradovateAccountId()) {
  const key = autoLockStateStorageKey(accountId);
  const data = await storageGet({ [key]: {} });
  return data[key] || {};
}

async function monitorScan({ manual = false } = {}) {
  const result = await extractTradovatePnl();
  const cfg = await readMonitorSettings(result.accountId || extractTradovateAccountId());
  const accountId = result.accountId || extractTradovateAccountId();
  const tradeStats = await readWebSocketTradeStats(accountId);
  const tradePositionGuard = tradeCountPositionGuard(tradeStats, result);
  const now = Date.now();
  const lockButtonState = currentManualLockButtonState();
  const accountCurrentlyLocked = pageIndicatesLocked() || (lockButtonState.isLocked && Number(lockButtonState.remainingMs) > 0);
  const runtimeKey = runtimeStateStorageKey(accountId);
  await storageSet({
    [runtimeKey]: {
      lastPnl: Number.isFinite(Number(result.pnl)) ? result.pnl : null,
      lastOpenPnl: hasFiniteNumberValue(result.openPnl) ? Number(result.openPnl) : null,
      lastEquity: Number.isFinite(Number(result.equity)) ? result.equity : null,
      lastPnlSource: result.source || '',
      lastVisiblePositionStatus: result.visiblePositionStatus || null,
      lastTradePositionGuard: tradePositionGuard,
      lastTradeStatsAccountId: accountId,
      lastSeenAt: now,
      lastPageUrl: location.href,
      lastPageTitle: document.title || '',
      lastTradeStats: tradeStats,
      lastCalendarCandidates: [{
        day: '',
        pnl: result.pnl,
        text: `${result.text || ''}; openPnl ${hasFiniteNumberValue(result.openPnl) ? result.openPnl : 'n/a'}; source ${result.source || ''}; account ${result.accountId || ''}; date ${result.dateKey || ''}`
      }]
    }
  });

  const pnlKind = thresholdKind(result.pnl, cfg);
  const tradeKind = tradeCountThresholdKind(tradeStats, cfg, result);
  const kind = pnlKind || tradeKind;
  const tradeEntryCount = tradeStats ? Number(tradeStats.tradeCountToday ?? tradeStats.flatToPositionEntriesToday) : NaN;
  const tradeCountPositionSource = tradePositionGuard.source || '';
  const tradeCountBlockedByOpenPosition = Boolean(
    cfg.tradeCountLockEnabled &&
    Number.isFinite(tradeEntryCount) &&
    Number.isFinite(Number(cfg.dailyEntryLimit)) &&
    tradeEntryCount >= Number(cfg.dailyEntryLimit) &&
    tradePositionGuard.hasOpenPosition
  );
  if ((!manual && !cfg.autoMonitorEnabled) || !cfg.autoLockEnabled) {
    return { ok: true, locked: false, kind, tradeStats, ...result };
  }

  const state = await getAutoLockState(result.accountId);
  if (accountCurrentlyLocked) {
    const lockDuration = state.lockDuration || cfg.lockDuration || 'end_of_day';
    const fallbackExpiresAt = Number(lockButtonState.remainingMs) > 0
      ? Date.now() + Number(lockButtonState.remainingMs)
      : lockExpiresAt(lockDuration, now);
    const lockedPnl = (!Number.isFinite(Number(result.pnl)) || isBaselinePnlSource(result.source)) && Number.isFinite(Number(state.pnl))
      ? Number(state.pnl)
      : result.pnl;
    await setAutoLockState({
      status: 'locked',
      lockKey: state.lockKey || `${result.accountId || 'default'}:${result.dateKey || tradingDateKeyBeijing()}:${kind || 'page_locked'}`,
      kind: state.kind || kind || 'manual',
      pnl: lockedPnl,
      lockedAt: Number(state.lockedAt) || now,
      lockDuration,
      lockExpiresAt: Number(state.lockExpiresAt) > now ? Number(state.lockExpiresAt) : fallbackExpiresAt,
      tradeStats,
      tradePositionGuard,
      tradeCountPositionSource,
      tradeCountBlockedByOpenPosition,
      tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : state.tradeEntryCount,
      error: ''
    }, result.accountId);
    return {
      ok: true,
      locked: false,
      skipped: 'account already locked',
      kind,
      tradeStats,
      ...result
    };
  }
  if (!kind) {
    if (state.status === 'locked' || state.status === 'locking' || state.lockKey) {
      await setAutoLockState({
        status: 'within_threshold',
        lockKey: '',
        kind: '',
        pnl: result.pnl,
        tradeStats,
        tradePositionGuard,
        tradeCountPositionSource,
        tradeCountBlockedByOpenPosition,
        tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
        clearedAt: now,
        error: ''
      }, result.accountId);
    }
    return { ok: true, locked: false, kind, tradeStats, ...result };
  }

  const lockKey = `${result.accountId || 'default'}:${result.dateKey || tradingDateKeyBeijing()}:${kind}`;
  const metricUnchanged = kind === 'trade_count'
    ? Number(state.tradeEntryCount) === tradeEntryCount
    : pnlSame(state.pnl, result.pnl);
  if (state.lockKey === lockKey && state.status === 'locked' && metricUnchanged) {
    if (kind !== 'trade_count') {
      const skipped = 'pnl unchanged after lock';
      return { ok: true, locked: false, skipped, kind, tradeStats, ...result };
    }
    const recordedLockExpiresAt = Number(state.lockExpiresAt) > 0
      ? Number(state.lockExpiresAt)
      : lockExpiresAt(state.lockDuration || cfg.lockDuration || 'end_of_day', Number(state.lockedAt) || now);
    if (recordedLockExpiresAt > now) {
      debugLog('auto_lock.trade_count_lock_state_respected', {
        reason: 'account-scoped trade_count lock is still active',
        lockKey,
        tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
        stateTradeEntryCount: Number.isFinite(Number(state.tradeEntryCount)) ? Number(state.tradeEntryCount) : null,
        stateLockedAt: state.lockedAt || null,
        stateLockExpiresAt: recordedLockExpiresAt,
        pageLocked: accountCurrentlyLocked
      });
      return {
        ok: true,
        locked: false,
        skipped: 'trade count lock already active',
        kind,
        tradeStats,
        ...result
      };
    }
    debugLog('auto_lock.expired_trade_count_lock_retry', {
      reason: 'stored trade_count lock has expired',
      lockKey,
      tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
      stateTradeEntryCount: Number.isFinite(Number(state.tradeEntryCount)) ? Number(state.tradeEntryCount) : null,
      stateLockedAt: state.lockedAt || null,
      stateLockExpiresAt: recordedLockExpiresAt,
      pageLocked: accountCurrentlyLocked
    });
  }
  if (state.status === 'locking') {
    return { ok: true, locked: false, skipped: 'lock already in progress', kind, tradeStats, ...result };
  }

  await setAutoLockState({
    status: 'locking',
    lockKey,
    kind,
    pnl: result.pnl,
    tradeStats,
    tradePositionGuard,
    tradeCountPositionSource,
    tradeCountBlockedByOpenPosition,
    tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
    startedAt: now
  }, result.accountId);

  try {
    const lockResult = await executeRealLockout();
    await setAutoLockState({
      status: 'locked',
      lockKey,
      kind,
      pnl: result.pnl,
      lockedAt: Date.now(),
      lockDuration: lockResult.lockDuration || cfg.lockDuration,
      lockExpiresAt: lockResult.lockExpiresAt || null,
      tradeStats,
      tradePositionGuard,
      tradeCountPositionSource,
      tradeCountBlockedByOpenPosition,
      tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
      error: ''
    }, result.accountId);
    return { ok: true, locked: true, kind, lockResult, tradeStats, ...result };
  } catch (err) {
    debugLog('auto_lock.real_lockout_failed', {
      accountId: result.accountId || accountId,
      kind,
      error: err.message || String(err),
      pageIndicatesLocked: pageIndicatesLocked(),
      lockButtonState: currentManualLockButtonState()
    });
    await setAutoLockState({
      status: 'error',
      lockKey,
      kind,
      pnl: result.pnl,
      tradeStats,
      tradePositionGuard,
      tradeCountPositionSource,
      tradeCountBlockedByOpenPosition,
      tradeEntryCount: Number.isFinite(tradeEntryCount) ? tradeEntryCount : null,
      error: err.message || String(err),
      failedAt: Date.now()
    }, result.accountId);
    if (manual) throw err;
    return { ok: false, locked: false, kind, error: err.message || String(err), tradeStats, ...result };
  }
}

async function updateNextScanAt(accountId, seconds) {
  const runtimeKey = runtimeStateStorageKey(accountId);
  const existing = (await storageGet({ [runtimeKey]: {} }))[runtimeKey] || {};
  await storageSet({
    [runtimeKey]: {
      ...existing,
      nextScanAt: Date.now() + seconds * 1000
    }
  });
}

function scheduleNextMonitorLoop(seconds) {
  if (monitorLoopTimerId) {
    window.clearTimeout(monitorLoopTimerId);
    monitorLoopTimerId = null;
  }
  monitorLoopTimerId = window.setTimeout(() => {
    monitorLoopTimerId = null;
    monitorLoop();
  }, seconds * 1000);
}

async function monitorLoop() {
  if (monitorLoopRunning) return;
  monitorLoopRunning = true;
  let cfg = null;
  const accountId = extractTradovateAccountId();
  try {
    cfg = await readMonitorSettings(accountId);
    if (cfg.autoMonitorEnabled) await monitorScan();
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      extensionContextValid = false;
      return;
    }
    console.warn('[TradovateAutoLock] monitor scan failed:', err);
  } finally {
    monitorLoopRunning = false;
    if (!extensionContextValid) return;
    const seconds = Math.max(
      MIN_SCAN_INTERVAL_SECONDS,
      Number(cfg && cfg.scanIntervalSeconds ? cfg.scanIntervalSeconds : DEFAULT_SCAN_INTERVAL_SECONDS)
    );
    try {
      await updateNextScanAt(accountId, seconds);
    } catch (err) {
      if (isExtensionContextInvalidated(err)) {
        extensionContextValid = false;
        return;
      }
      console.warn('[TradovateAutoLock] failed to update next scan time:', err);
    }
    scheduleNextMonitorLoop(seconds);
  }
}

async function ensureMonitorLoop() {
  const accountId = extractTradovateAccountId();
  const runtimeKey = runtimeStateStorageKey(accountId);
  const runtimeState = (await storageGet({ [runtimeKey]: {} }))[runtimeKey] || {};
  const nextScanAt = Number(runtimeState.nextScanAt) || 0;
  if (monitorLoopRunning) {
    return { ok: true, status: 'running', nextScanAt };
  }
  if (!monitorLoopTimerId || nextScanAt <= Date.now()) {
    monitorLoop().catch(err => {
      if (!isExtensionContextInvalidated(err)) {
        console.warn('[TradovateAutoLock] ensure monitor loop failed:', err);
      }
    });
    return { ok: true, status: 'restarted', nextScanAt };
  }
  return { ok: true, status: 'scheduled', nextScanAt };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  let task = null;
  if (message.type === 'tradovate-auto-lock:start') task = startStepTest();
  if (message.type === 'tradovate-auto-lock:next') task = nextStep();
  if (message.type === 'tradovate-auto-lock:test') task = runAutoLockTest();
  if (message.type === 'tradovate-auto-lock:debug-locate-final') task = locateStep(3);
  if (message.type === 'tradovate-auto-lock:execute-real-lockout') task = executeRealLockout();
  if (message.type === 'tradovate-auto-lock:scan-now') task = monitorScan({ manual: true });
  if (message.type === 'tradovate-auto-lock:ensure-monitor-loop') task = ensureMonitorLoop();
  if (message.type === 'tradovate-auto-lock:read-current-page-state') task = readCurrentPageState();
  if (message.type === 'tradovate-auto-lock:debug-snapshot') task = buildDebugSnapshot();
  if (message.type === 'tradovate-auto-lock:diagnostic-bundle') task = buildDiagnosticBundle();
  if (message.type === 'tradovate-auto-lock:adjust') {
    const dx = Number(message.dx) || 0;
    const dy = Number(message.dy) || 0;
    task = adjustCurrentHighlight(dx, dy);
  }
  if (message.type === 'tradovate-auto-lock:reset-current-offset') task = resetCurrentOffset();
  if (message.type === 'tradovate-auto-lock:reset-offsets') task = resetOffsets();
  if (message.type === 'tradovate-auto-lock:clear') {
    currentStep = 0;
    currentTarget = null;
    currentBaseRect = null;
    currentOffset = { x: 0, y: 0 };
    currentLabel = '';
    clearHighlight();
    task = Promise.resolve({ ok: true, done: true, message: '已清除高亮' });
  }
  if (!task) return false;

  task
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message || String(err) }));
  return true;
});

restoreLockoutOverlay().catch(err => {
  if (!isExtensionContextInvalidated(err)) console.warn('[TradovateAutoLock] failed to restore lockout overlay:', err);
});
window.setTimeout(() => {
  maybeShowLockSettingPrompt('initial').catch(err => {
    if (!isExtensionContextInvalidated(err)) console.warn('[TradovateAutoLock] failed to show lock-setting prompt:', err);
  });
  scheduleLockSettingPromptChecks();
  maybeShowScheduledLockPrompt('initial').catch(err => {
    if (!isExtensionContextInvalidated(err)) console.warn('[TradovateAutoLock] failed to show scheduled lock prompt:', err);
  });
  scheduleScheduledLockPromptChecks();
}, 1200);
monitorLoop();
})();
