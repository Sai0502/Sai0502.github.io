import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const mockPath = path.join(__dirname, 'mock_full_flow.html');
const contentPath = path.join(extensionDir, 'content.js');

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
const page = await browser.newPage({ viewport: { width: 1328, height: 900 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__autoLockListeners = [];
  const monitorKey = 'tradovateMonitorSettings:LFE02567750200006';
  const autoStateKey = 'tradovateAutoLockState:LFE02567750200006';
  window.__stored = {
    [monitorKey]: {
      autoMonitorEnabled: true,
      autoLockEnabled: true,
      dailyLossLimit: 200,
      dailyProfitTarget: 300,
      scanIntervalSeconds: 60,
      lockDuration: 'end_of_day'
    },
    [autoStateKey]: {}
  };
  window.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          window.__autoLockListeners.push(fn);
        }
      }
    },
    storage: {
      local: {
        get(keys, cb) {
          if (typeof keys === 'object' && !Array.isArray(keys)) {
            const out = {};
            for (const [key, value] of Object.entries(keys)) out[key] = window.__stored[key] ?? value;
            if (cb) cb(out);
            return Promise.resolve(out);
          }
          if (cb) {
            cb({});
            return;
          }
          return Promise.resolve({});
        },
        set(items, cb) {
          Object.assign(window.__stored, items);
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});
await page.addScriptTag({ path: contentPath });

async function send(type, payload = {}) {
  return page.evaluate(({ type, payload }) => new Promise(resolve => {
    window.__autoLockListeners[0]({ type, ...payload }, {}, resolve);
  }), { type, payload });
}

const baselineScan = await send('tradovate-auto-lock:scan-now');
assert(baselineScan.ok && Math.abs(Number(baselineScan.pnl || 0)) < 0.01, 'baseline scan failed', { baselineScan });

await page.evaluate(() => {
  document.querySelector('[data-mock-equity]').textContent = '24750.00 USD';
  document.querySelector('[data-mock-detail-equity]').textContent = '24,750.00';
  document.querySelector('[data-mock-total-pnl]').textContent = '(250.00)';
});

const lockScan = await send('tradovate-auto-lock:scan-now');
const stateAfterFirstLock = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  storage: window.__stored
}));

await page.evaluate(() => {
  document.body.classList.remove('modal-open', 'confirm-open');
});

const unchangedScan = await send('tradovate-auto-lock:scan-now');
const stateAfterUnchanged = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  storage: window.__stored
}));

await page.evaluate(() => {
  document.querySelector('[data-mock-equity]').textContent = '24850.00 USD';
  document.querySelector('[data-mock-detail-equity]').textContent = '24,850.00';
  document.querySelector('[data-mock-total-pnl]').textContent = '150.00';
});
const recoveredInsideThresholdScan = await send('tradovate-auto-lock:scan-now');
const stateAfterRecovered = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  storage: window.__stored
}));

await page.evaluate(() => {
  document.querySelector('[data-mock-equity]').textContent = '24650.00 USD';
  document.querySelector('[data-mock-detail-equity]').textContent = '24,650.00';
  document.querySelector('[data-mock-total-pnl]').textContent = '(350.00)';
  document.body.classList.remove('modal-open', 'confirm-open');
});
const worseLossScan = await send('tradovate-auto-lock:scan-now');
const stateAfterWorseLoss = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  storage: window.__stored
}));

await page.evaluate(() => {
  document.body.classList.remove('modal-open', 'confirm-open');
  const button = document.querySelector('.manual-lockout-button');
  button.textContent = '锁定 18 小时, 23 分钟';
  button.className = 'manual-lockout-button manual-lockout-button--locked manual-lockout-button--width-hours';
  document.querySelector('[data-mock-equity]').textContent = '24600.00 USD';
  document.querySelector('[data-mock-detail-equity]').textContent = '24,600.00';
  document.querySelector('[data-mock-total-pnl]').textContent = '(400.00)';
});
const lockedPageScan = await send('tradovate-auto-lock:scan-now');
const stateAfterLockedPageScan = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  autoState: window.__stored['tradovateAutoLockState:LFE02567750200006']
}));

await browser.close();

assert(lockScan.ok && lockScan.locked, 'threshold scan did not auto lock', { lockScan, stateAfterFirstLock });
assert(Math.abs(Number(lockScan.pnl) + 250) < 0.01 && /total pnl/i.test(lockScan.source), 'lock scan should use visible total pnl with parentheses as loss', { lockScan });
assert(stateAfterFirstLock.modalOpen && stateAfterFirstLock.confirmOpen, 'lock flow did not reach confirmation in mock', { lockScan, stateAfterFirstLock });
assert(stateAfterFirstLock.storage['tradovateAutoLockState:LFE02567750200006']?.status === 'locked', 'lock state not persisted', { lockScan, stateAfterFirstLock });

assert(unchangedScan.ok && !unchangedScan.locked, 'unchanged PnL should not lock again', { unchangedScan, stateAfterUnchanged });
assert(unchangedScan.skipped === 'pnl unchanged after lock', 'unchanged PnL skip reason mismatch', { unchangedScan });
assert(!stateAfterUnchanged.modalOpen && !stateAfterUnchanged.confirmOpen, 'unchanged PnL should not open lock modal', { stateAfterUnchanged });

assert(recoveredInsideThresholdScan.ok && !recoveredInsideThresholdScan.locked && !recoveredInsideThresholdScan.kind, 'PnL recovered inside threshold should not lock', {
  recoveredInsideThresholdScan,
  stateAfterRecovered
});
assert(stateAfterRecovered.storage['tradovateAutoLockState:LFE02567750200006']?.status === 'within_threshold', 'recovered PnL should reset lock state to within_threshold', {
  stateAfterRecovered
});

assert(worseLossScan.ok && worseLossScan.locked, 'worse loss outside threshold should lock again', { worseLossScan, stateAfterWorseLoss });
assert(stateAfterWorseLoss.modalOpen && stateAfterWorseLoss.confirmOpen, 'worse loss lock flow did not reach confirmation', { worseLossScan, stateAfterWorseLoss });
assert(Math.abs(Number(stateAfterWorseLoss.storage['tradovateAutoLockState:LFE02567750200006']?.pnl) + 350) < 0.01, 'worse loss pnl not persisted', {
  stateAfterWorseLoss
});
assert(lockedPageScan.ok && !lockedPageScan.locked, 'already locked page should not trigger another lock flow', {
  lockedPageScan,
  stateAfterLockedPageScan
});
assert(lockedPageScan.skipped === 'account already locked', 'already locked page skip reason mismatch', {
  lockedPageScan
});
assert(!stateAfterLockedPageScan.modalOpen && !stateAfterLockedPageScan.confirmOpen, 'already locked page should not reopen lock modal', {
  stateAfterLockedPageScan
});
assert(stateAfterLockedPageScan.autoState?.status === 'locked', 'already locked page should keep auto state locked', {
  stateAfterLockedPageScan
});
assert(!stateAfterLockedPageScan.autoState?.error, 'already locked page should not overwrite auto state with error', {
  stateAfterLockedPageScan
});

console.log(JSON.stringify({
  baselineScan,
  lockScan,
  unchangedScan,
  recoveredInsideThresholdScan,
  worseLossScan,
  lockedPageScan,
  stateAfterFirstLock,
  stateAfterUnchanged,
  stateAfterRecovered,
  stateAfterWorseLoss,
  stateAfterLockedPageScan
}, null, 2));
