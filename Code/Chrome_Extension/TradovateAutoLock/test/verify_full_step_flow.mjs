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
  window.__stored = {};
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

const start = await send('tradovate-auto-lock:start');
assert(start.ok && start.stepIndex === 0, 'start did not locate step 1', { start });

const step2 = await send('tradovate-auto-lock:next');
assert(step2.ok && step2.stepIndex === 1, 'step 1 did not advance to step 2', { step2 });

const step3 = await send('tradovate-auto-lock:next');
assert(step3.ok && step3.stepIndex === 2, 'step 2 did not advance to step 3', { step3 });

const step4 = await send('tradovate-auto-lock:next');
const stateAfterStep3 = await page.evaluate(() => ({
  modalOpen: document.body.classList.contains('modal-open'),
  confirmOpen: document.body.classList.contains('confirm-open'),
  dropdownText: document.querySelector('.manual-lockout-modal__dropdown-placeholder')?.textContent,
  highlightText: document.getElementById('tradovate-auto-lock-status')?.textContent,
  highlightRect: (() => {
    const rect = document.getElementById('tradovate-auto-lock-highlight')?.getBoundingClientRect();
    return rect ? {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    } : null;
  })()
}));

assert(step4.ok && step4.stepIndex === 3, 'step 3 did not advance to step 4', { step4, stateAfterStep3 });
assert(stateAfterStep3.modalOpen, 'modal closed after step 3 click', { step4, stateAfterStep3 });
assert(/交易日结束/.test(stateAfterStep3.dropdownText || ''), 'end-of-day option was not selected', { step4, stateAfterStep3 });

const screenshot = await page.screenshot({ fullPage: false });
await browser.close();

console.log(JSON.stringify({
  start,
  step2,
  step3,
  step4,
  stateAfterStep3,
  screenshotBytes: screenshot.length
}, null, 2));
