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
const page = await browser.newPage({ viewport: { width: 1600, height: 760 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__autoLockListeners = [];
  window.__stored = {
    tradovateAutoLockStepOffsets: {},
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

async function send(type, payload = {}) {
  return page.evaluate(({ type, payload }) => new Promise(resolve => {
    window.__autoLockListeners[0]({ type, ...payload }, {}, resolve);
  }), { type, payload });
}

const result = await send('tradovate-auto-lock:test');
const state = await page.evaluate(result => {
  const lockButton = document.querySelector('.lock-account');
  const highlight = document.getElementById('tradovate-auto-lock-highlight');
  const buttonRect = lockButton.getBoundingClientRect();
  const highlightRect = highlight.getBoundingClientRect();
  const buttonCenter = {
    x: buttonRect.left + buttonRect.width / 2,
    y: buttonRect.top + buttonRect.height / 2
  };
  const highlightCenter = {
    x: highlightRect.left + highlightRect.width / 2,
    y: highlightRect.top + highlightRect.height / 2
  };
  return {
    result,
    selectedText: document.querySelector('[data-account="LFE02568079020011"] .select-button')?.textContent?.trim(),
    buttonCenter,
    highlightCenter,
    dx: Math.abs(buttonCenter.x - highlightCenter.x),
    dy: Math.abs(buttonCenter.y - highlightCenter.y)
  };
}, result);

await browser.close();

assert(result.ok, 'step test failed before locating step 4', { result, state });
assert(result.stepIndex === 3 && result.stepName === '锁定账户', 'step test did not stop on step 4', { result, state });
assert(/15\s*分钟/.test(state.selectedText || ''), 'duration option was not selected before step 4', { result, state });
assert(state.dx <= 8 && state.dy <= 8, 'step 4 highlight is not centered on the lock account button', { result, state });

console.log(JSON.stringify({ result, state }, null, 2));
