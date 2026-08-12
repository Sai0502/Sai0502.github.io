import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const mockPath = path.join(__dirname, 'mock_new_manual_lock_flow.html');
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

async function initializePage(page) {
  await page.goto(`file://${mockPath}`);
  await page.evaluate(() => {
  window.__autoLockListeners = [];
  window.__stored = {
    tradovateMonitorSettings: {
      autoLockEnabled: true,
      autoMonitorEnabled: true,
      dailyLossLimit: 250,
      dailyProfitTarget: 300,
      lockDuration: '15m',
      scanIntervalSeconds: 10
    },
    'tradovateMonitorSettings:LFE02568079020011': {
      autoLockEnabled: true,
      autoMonitorEnabled: true,
      dailyLossLimit: 250,
      dailyProfitTarget: 300,
      lockDuration: '15m',
      scanIntervalSeconds: 10
    }
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
            cb?.(out);
            return Promise.resolve(out);
          }
          cb?.({});
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
}

const page = await browser.newPage({ viewport: { width: 1600, height: 760 } });
await initializePage(page);

async function send(type, payload = {}) {
  return page.evaluate(({ type, payload }) => new Promise(resolve => {
    window.__autoLockListeners[0]({ type, ...payload }, {}, resolve);
  }), { type, payload });
}

const result = await send('tradovate-auto-lock:execute-real-lockout');
const state = await page.evaluate(result => ({
  result,
  closed: document.body.dataset.closed === 'true',
  selectedText: document.querySelector('[data-account="LFE02568079020011"] .select-button')?.textContent?.trim(),
  selectOpen: document.querySelector('[data-account="LFE02568079020011"]')?.classList.contains('open'),
  visibleOptions: Array.from(document.querySelectorAll('.option'))
    .filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map(el => el.textContent.trim()),
  accountModalOpen: document.body.classList.contains('account-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  resultOpen: document.body.classList.contains('result-open'),
  overlayVisible: Boolean(document.getElementById('tradovate-auto-lockout-overlay')),
  storedKeys: Object.keys(window.__stored).sort(),
  autoState: window.__stored['tradovateAutoLockState:LFE02568079020011']
}), result);

const guardPage = await browser.newPage({ viewport: { width: 1600, height: 760 } });
await guardPage.goto(`file://${mockPath}`);
await guardPage.evaluate(() => {
  const targetSelect = document.querySelector('[data-account="LFE02568079020011"]');
  targetSelect.innerHTML = '<span>—</span>';
  const targetStatus = targetSelect.previousElementSibling;
  if (targetStatus) targetStatus.textContent = '交易已锁定至今日结束';
  window.__secondAccountClicks = 0;
  document.querySelector('[data-account="LFE02568079020012"] .select-button')?.addEventListener('click', () => {
    window.__secondAccountClicks += 1;
  });
});
await guardPage.evaluate(() => {
  window.__autoLockListeners = [];
  window.__stored = {
    'tradovateMonitorSettings:LFE02568079020011': {
      autoLockEnabled: true,
      autoMonitorEnabled: true,
      dailyLossLimit: 250,
      dailyProfitTarget: 300,
      lockDuration: '15m',
      scanIntervalSeconds: 10
    }
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
            cb?.(out);
            return Promise.resolve(out);
          }
          cb?.({});
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
await guardPage.addScriptTag({ path: contentPath });
const guardResult = await guardPage.evaluate(() => new Promise(resolve => {
  window.__autoLockListeners[0]({ type: 'tradovate-auto-lock:execute-real-lockout' }, {}, resolve);
}));
const guardState = await guardPage.evaluate(() => ({
  secondAccountClicks: window.__secondAccountClicks,
  secondAccountText: document.querySelector('[data-account="LFE02568079020012"] .select-button')?.textContent?.trim(),
  confirmOpen: document.body.classList.contains('confirm-open'),
  resultOpen: document.body.classList.contains('result-open')
}));

await browser.close();

assert(result.ok, 'execute-real-lockout failed', { result, state });
assert(state.closed, 'result modal was not closed', { result, state });
assert(/15\s*分钟/.test(state.selectedText || ''), '15 minute option was not selected', { result, state });
assert(!state.accountModalOpen && !state.confirmOpen && !state.resultOpen, 'modal state did not settle', { result, state });
assert(state.overlayVisible, 'local lockout overlay was not shown', { result, state });
assert(state.autoState && state.autoState.status === 'locked', 'auto state not persisted as locked', { result, state });
assert(state.autoState.lockDuration === '15m', 'lock duration mismatch', { result, state });
assert(!guardResult.ok && /找不到账号对应的锁定时间下拉框/.test(guardResult.error || ''), 'missing target-account control should abort safely', {
  guardResult,
  guardState
});
assert(guardState.secondAccountClicks === 0 && guardState.secondAccountText === '选择', 'guard must not click another account row', {
  guardResult,
  guardState
});
assert(!guardState.confirmOpen && !guardState.resultOpen, 'guarded flow must not reach confirmation', { guardResult, guardState });

console.log(JSON.stringify({ result, state, guardResult, guardState }, null, 2));
