import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const popupPath = path.join(extensionDir, 'popup.html');

function assert(condition, message, payload = {}) {
  if (!condition) {
    console.error(JSON.stringify({ message, ...payload }, null, 2));
    process.exit(1);
  }
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

await page.addInitScript(() => {
  const monitorKey = 'tradovateMonitorSettings:default';
  const runtimeKey = 'tradovateRuntimeState:default';
  const settingsLockKey = 'tradovateSettingsLockedUntil:default';
  const storageListeners = [];
  window.__stored = {
    [monitorKey]: {
      autoMonitorEnabled: true,
      autoLockEnabled: true,
      dailyLossLimit: 200,
      dailyProfitTarget: 300,
      scanIntervalSeconds: 30,
      lockDuration: '15m'
    },
    [runtimeKey]: {
      lastPnl: -12.5,
      lastPnlSource: 'tradovate balance row total pnl',
      nextScanAt: Date.now() + 30000,
      lastCalendarCandidates: [{ pnl: -12.5, text: '总损益 => (12.50); source tradovate balance row total pnl' }]
    },
    [settingsLockKey]: null
  };
  window.chrome = {
    tabs: {
      query(_query, cb) {
        const tabs = [{ id: 1, url: 'https://trader.tradovate.com/' }];
        cb?.(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage(_tabId, message) {
        if (message.type === 'tradovate-auto-lock:debug-snapshot') {
          return Promise.resolve({
            ok: true,
            accountIdGuess: 'default'
          });
        }
        if (message.type === 'tradovate-auto-lock:start') {
          return Promise.resolve({
            ok: true,
            done: false,
            stepIndex: 0,
            stepName: '手动锁定',
            message: 'mock start',
            canClick: true
          });
        }
        return Promise.resolve({ ok: true, done: true, message: 'mock' });
      }
    },
    scripting: {
      executeScript() {
        return Promise.resolve();
      }
    },
    storage: {
      onChanged: {
        addListener(listener) {
          storageListeners.push(listener);
        }
      },
      local: {
        get(keys, cb) {
          if (typeof keys === 'object' && !Array.isArray(keys)) {
            const out = {};
            for (const [key, value] of Object.entries(keys)) out[key] = window.__stored[key] ?? value;
            cb?.(out);
            return Promise.resolve(out);
          }
          cb?.({});
          return Promise.resolve({});
        },
        set(items, cb) {
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = {
              oldValue: window.__stored[key],
              newValue: value
            };
          }
          Object.assign(window.__stored, items);
          for (const listener of storageListeners) listener(changes, 'local');
          cb?.();
          return Promise.resolve(items);
        }
      }
    }
  };
});

await page.goto(`file://${popupPath}`);
await page.waitForTimeout(500);

const initialLayout = await page.evaluate(() => {
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const lockSelect = document.getElementById('lockDuration');
  const lockLabel = lockSelect.closest('.setting-row');
  const execute = document.getElementById('executeLock');
  const lockSettings = document.getElementById('lockSettings');
  return {
    hasSaveButton: Boolean(document.getElementById('save')),
    hasScanButton: Boolean(document.getElementById('scan')),
    hasLockSettingsButton: Boolean(lockSettings),
    title: document.querySelector('h1')?.textContent.trim(),
    lockLabelRect: rect(lockLabel),
    lockSelectRect: rect(lockSelect),
    sameLockRow: Math.abs(lockLabel.getBoundingClientRect().top - lockSelect.getBoundingClientRect().top) < 2,
    executeRect: rect(execute),
    lockSettingsRect: rect(lockSettings),
    sameActionRow: Math.abs(lockSettings.getBoundingClientRect().top - execute.getBoundingClientRect().top) < 2,
    bodyHeight: Math.round(document.body.getBoundingClientRect().height)
  };
});

assert(!initialLayout.hasSaveButton, 'save button should be removed', { initialLayout });
assert(!initialLayout.hasScanButton, 'scan button should be removed', { initialLayout });
assert(initialLayout.hasLockSettingsButton, 'lock settings button should be present', { initialLayout });
assert(initialLayout.sameLockRow, 'lock duration label and select should be on the same row', { initialLayout });
assert(initialLayout.sameActionRow, 'lock settings and execute lock should be on the same row', { initialLayout });
assert(initialLayout.bodyHeight >= 420, 'popup should expand beyond tiny default height', { initialLayout });

await page.fill('#dailyLossLimit', '250');
await page.locator('#dailyLossLimit').blur();
await page.waitForTimeout(100);
const savedLoss = await page.evaluate(() => window.__stored['tradovateMonitorSettings:default'].dailyLossLimit);
assert(savedLoss === 250, 'daily loss should auto-save on blur', { savedLoss });

await page.click('#dailyProfitTarget');
await page.keyboard.press('Meta+A');
await page.keyboard.type('375');
await page.evaluate(async () => {
  const runtimeKey = 'tradovateRuntimeState:default';
  await chrome.storage.local.set({
    [runtimeKey]: {
      ...(window.__stored[runtimeKey] || {}),
      lastPnl: 18.75,
      nextScanAt: Date.now() + 45000
    }
  });
});
await page.waitForTimeout(150);
const liveRefreshDuringEdit = await page.evaluate(() => ({
  inputValue: document.getElementById('dailyProfitTarget').value,
  activeId: document.activeElement?.id || '',
  renderedPnl: document.querySelector('.pnl-card strong')?.textContent || ''
}));
assert(
  liveRefreshDuringEdit.inputValue === '375' && liveRefreshDuringEdit.activeId === 'dailyProfitTarget',
  'runtime refresh should not overwrite the setting currently being edited',
  { liveRefreshDuringEdit }
);
assert(liveRefreshDuringEdit.renderedPnl === '18.75', 'runtime refresh should still update live PnL', { liveRefreshDuringEdit });
await page.locator('#dailyProfitTarget').blur();
await page.waitForTimeout(100);
const savedProfit = await page.evaluate(() => window.__stored['tradovateMonitorSettings:default'].dailyProfitTarget);
assert(savedProfit === 375, 'edited setting should save normally after runtime refresh', { savedProfit });

await page.click('#scanIntervalSeconds');
await page.keyboard.press('Meta+A');
await page.keyboard.type('abc12x');
await page.locator('#scanIntervalSeconds').blur();
await page.waitForTimeout(100);
const sanitizedScan = await page.evaluate(() => ({
  inputValue: document.getElementById('scanIntervalSeconds').value,
  stored: window.__stored['tradovateMonitorSettings:default'].scanIntervalSeconds,
  status: document.getElementById('saveStatus').textContent
}));
assert(sanitizedScan.inputValue === '12' && sanitizedScan.stored === 12, 'scan interval should sanitize to positive integer and save', { sanitizedScan });

await page.selectOption('#lockDuration', '30m');
await page.waitForTimeout(100);
const savedDuration = await page.evaluate(() => window.__stored['tradovateMonitorSettings:default'].lockDuration);
assert(savedDuration === '30m', 'lock duration should auto-save on change', { savedDuration });

await page.click('#lockSettings');
await page.waitForTimeout(150);
const lockedState = await page.evaluate(() => {
  const lockedUntil = Number(window.__stored['tradovateSettingsLockedUntil:default']);
  return {
    lockedUntil,
    hoursFromNow: (lockedUntil - Date.now()) / 3600000,
    lockedClass: document.getElementById('lockableSettings').classList.contains('settings-locked'),
    lockButtonDisabled: document.getElementById('lockSettings').disabled,
    lockButtonText: document.getElementById('lockSettings').textContent.trim(),
    disabled: ['dailyLossLimit', 'dailyProfitTarget', 'scanIntervalSeconds', 'lockDuration']
      .map(id => [id, document.getElementById(id).disabled]),
    status: document.getElementById('saveStatus').textContent
  };
});
assert(lockedState.lockedUntil > Date.now(), 'settings lock should store a future unlock timestamp', { lockedState });
assert(lockedState.hoursFromNow > 0 && lockedState.hoursFromNow <= 32, 'settings lock should end at the next Beijing 04:00 window', { lockedState });
assert(lockedState.lockedClass, 'locked settings should show overlay class', { lockedState });
assert(lockedState.lockButtonDisabled && lockedState.lockButtonText === '已锁定', 'lock settings button should become disabled after locking', { lockedState });
assert(lockedState.disabled.every(([, disabled]) => disabled), 'all four lockable settings should be disabled', { lockedState });
assert(/设置已锁定至北京时间/.test(lockedState.status), 'locked status message should show Beijing unlock time', { lockedState });

await page.evaluate(() => {
  const input = document.getElementById('dailyLossLimit');
  input.disabled = false;
  input.value = '999';
  input.dispatchEvent(new Event('blur'));
});
await page.waitForTimeout(150);
const blockedSave = await page.evaluate(() => ({
  storedLoss: window.__stored['tradovateMonitorSettings:default'].dailyLossLimit,
  inputValue: document.getElementById('dailyLossLimit').value,
  status: document.getElementById('saveStatus').textContent
}));
assert(blockedSave.storedLoss === 250, 'locked settings should block later saves', { blockedSave });

const countdownRefresh = await page.evaluate(async () => {
  const runtimeKey = 'tradovateRuntimeState:default';
  const before = document.getElementById('scanCountdown').textContent;
  const nextScanAt = Date.now() + 90000;
  await chrome.storage.local.set({
    [runtimeKey]: {
      ...(window.__stored[runtimeKey] || {}),
      nextScanAt
    }
  });
  return {
    before,
    nextScanAt
  };
});
await page.waitForFunction(() => {
  const text = document.getElementById('scanCountdown')?.textContent || '';
  const seconds = Number(text.replace(/\D/g, ''));
  return Number.isFinite(seconds) && seconds >= 80;
}, { timeout: 3000 });
const refreshedCountdown = await page.evaluate(() => document.getElementById('scanCountdown').textContent);
assert(/\d+s/.test(refreshedCountdown), 'countdown should still render seconds after runtime update', { refreshedCountdown, countdownRefresh });

await page.click('#start');
await page.waitForTimeout(200);
const startState = await page.evaluate(() => {
  const htmlStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const main = document.getElementById('panelContent');
  const mainStyle = getComputedStyle(main);
  return {
    startHidden: document.getElementById('start').classList.contains('hidden'),
    htmlOverflowY: htmlStyle.overflowY,
    bodyOverflowY: bodyStyle.overflowY,
    mainOverflowY: mainStyle.overflowY,
    htmlScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    bodyScrolls: document.body.scrollHeight > document.body.clientHeight + 1,
    mainScrolls: main.scrollHeight > main.clientHeight + 1
  };
});
const startHidden = startState.startHidden;
assert(startHidden, 'start button should hide after test starts', { startHidden });
assert(
  startState.htmlOverflowY === 'visible' &&
    startState.bodyOverflowY === 'visible' &&
    startState.mainOverflowY === 'visible',
  'popup internals should not create nested scroll containers',
  { startState }
);

await browser.close();

console.log(JSON.stringify({
  initialLayout,
  savedLoss,
  liveRefreshDuringEdit,
  savedProfit,
  sanitizedScan,
  savedDuration,
  lockedState,
  blockedSave,
  startState
}, null, 2));
