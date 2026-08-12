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
const page = await browser.newPage({ viewport: { width: 1328, height: 1120 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__autoLockListeners = [];
  window.__stored = { lockDuration: '15m' };
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

async function resetMockFlow() {
  await page.evaluate(() => {
    document.body.classList.remove('modal-open', 'confirm-open');
    document.querySelector('.manual-lockout-modal__dropdown-container')?.classList.remove('dropdown-open');
    const placeholder = document.querySelector('.manual-lockout-modal__dropdown-placeholder');
    if (placeholder) placeholder.textContent = '选择时间';
  });
}

async function runToStep3() {
  const start = await send('tradovate-auto-lock:start');
  assert(start.ok && start.stepIndex === 0, 'start did not locate step 1', { start });
  const step2 = await send('tradovate-auto-lock:next');
  assert(step2.ok && step2.stepIndex === 1, 'step 1 did not advance to step 2', { step2 });
  const step3 = await send('tradovate-auto-lock:next');
  assert(step3.ok && step3.stepIndex === 2, 'step 2 did not advance to step 3', { step3 });
  return step3;
}

async function highlightedHitText() {
  return page.evaluate(() => {
    const dot = document.getElementById('tradovate-auto-lock-dot');
    if (!dot) return '';
    const rect = dot.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const option = Array.from(document.querySelectorAll('.manual-lockout-modal__dropdown-option'))
      .find(el => {
        const optionRect = el.getBoundingClientRect();
        return x >= optionRect.left && x <= optionRect.right && y >= optionRect.top && y <= optionRect.bottom;
      });
    if (option) return String(option.innerText || option.textContent || '').replace(/\s+/g, ' ').trim();
    const el = document.elementFromPoint(x, y);
    return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  });
}

const firstStep3 = await runToStep3();
const firstHit = await highlightedHitText();
assert(/15\s*分钟/.test(firstHit), 'step 3 should initially highlight 15 minutes when lockDuration is 15m', {
  firstStep3,
  firstHit
});

const adjusted = await send('tradovate-auto-lock:adjust', { dx: 0, dy: 104 });
assert(adjusted.ok, 'step 3 adjust failed', { adjusted });
const adjustedHit = await highlightedHitText();
assert(/30\s*分钟/.test(adjustedHit), 'after y offset, highlight should sit on 30 minutes', {
  adjusted,
  adjustedHit
});
const savedOffsetsAfterAdjust = await page.evaluate(() => window.__stored.tradovateAutoLockStepOffsets);
assert(savedOffsetsAfterAdjust?.['2']?.y === 104, 'step 3 offset should be saved immediately after adjust', {
  savedOffsetsAfterAdjust
});

const firstStep4 = await send('tradovate-auto-lock:next');
const firstSelected = await page.evaluate(() => document.querySelector('.manual-lockout-modal__dropdown-placeholder')?.textContent || '');
assert(firstStep4.ok && firstStep4.stepIndex === 3, 'offset step 3 did not advance to step 4', { firstStep4, firstSelected });
assert(/30\s*分钟/.test(firstSelected), 'offset click should select 30 minutes even though setting is 15m', {
  firstStep4,
  firstSelected
});

const savedOffsets = await page.evaluate(() => window.__stored.tradovateAutoLockStepOffsets);
assert(savedOffsets?.['2']?.y === 104, 'step 3 offset should be saved for next run', { savedOffsets });

await resetMockFlow();
const secondStep3 = await runToStep3();
const secondHit = await highlightedHitText();
assert(/30\s*分钟/.test(secondHit), 'saved step 3 offset should highlight 30 minutes on next run', {
  secondStep3,
  secondHit,
  savedOffsets
});

const secondStep4 = await send('tradovate-auto-lock:next');
const secondSelected = await page.evaluate(() => document.querySelector('.manual-lockout-modal__dropdown-placeholder')?.textContent || '');
assert(secondStep4.ok && secondStep4.stepIndex === 3, 'saved offset step 3 did not advance to step 4', { secondStep4, secondSelected });
assert(/30\s*分钟/.test(secondSelected), 'saved offset should select 30 minutes on next run', {
  secondStep4,
  secondSelected
});

await resetMockFlow();
const realLock = await send('tradovate-auto-lock:execute-real-lockout');
const realSelected = await page.evaluate(() => document.querySelector('.manual-lockout-modal__dropdown-placeholder')?.textContent || '');
assert(realLock.ok && realLock.done, 'real lockout flow did not complete with saved offset', { realLock, realSelected });
assert(/30\s*分钟/.test(realSelected), 'real lockout should also apply saved step 3 offset', {
  realLock,
  realSelected
});

await resetMockFlow();
const resetPreviewStep3 = await runToStep3();
const resetPreviewHitBefore = await highlightedHitText();
assert(/30\s*分钟/.test(resetPreviewHitBefore), 'saved offset should still preview 30 minutes before reset', {
  resetPreviewStep3,
  resetPreviewHitBefore
});

const resetPreview = await send('tradovate-auto-lock:reset-current-offset');
assert(resetPreview.ok, 'reset current offset preview failed', { resetPreview });
const resetPreviewHitAfter = await highlightedHitText();
assert(/15\s*分钟/.test(resetPreviewHitAfter), 'reset should temporarily move highlight back to 15 minutes', {
  resetPreview,
  resetPreviewHitAfter
});
const savedOffsetsAfterResetPreview = await page.evaluate(() => window.__stored.tradovateAutoLockStepOffsets);
assert(savedOffsetsAfterResetPreview?.['2']?.y === 0, 'reset current offset should save y offset back to 0 immediately', {
  savedOffsetsAfterResetPreview
});

await resetMockFlow();
const afterUnsavedResetStep3 = await runToStep3();
const afterUnsavedResetHit = await highlightedHitText();
assert(/15\s*分钟/.test(afterUnsavedResetHit), 'reset should persist default offset without requiring next', {
  afterUnsavedResetStep3,
  afterUnsavedResetHit
});

const resetAndSave = await send('tradovate-auto-lock:reset-current-offset');
assert(resetAndSave.ok, 'second reset current offset preview failed', { resetAndSave });
const resetAndSaveStep4 = await send('tradovate-auto-lock:next');
const resetAndSaveSelected = await page.evaluate(() => document.querySelector('.manual-lockout-modal__dropdown-placeholder')?.textContent || '');
assert(resetAndSaveStep4.ok && resetAndSaveStep4.stepIndex === 3, 'reset offset next did not advance to step 4', {
  resetAndSaveStep4,
  resetAndSaveSelected
});
assert(/15\s*分钟/.test(resetAndSaveSelected), 'reset offset should select 15 minutes after immediate save', {
  resetAndSaveStep4,
  resetAndSaveSelected
});
const savedOffsetsAfterResetNext = await page.evaluate(() => window.__stored.tradovateAutoLockStepOffsets);
assert(savedOffsetsAfterResetNext?.['2']?.y === 0, 'reset plus next should save y offset back to 0', {
  savedOffsetsAfterResetNext
});

await browser.close();

console.log(JSON.stringify({
  firstStep3,
  firstHit,
  adjusted,
  adjustedHit,
  savedOffsetsAfterAdjust,
  firstStep4,
  firstSelected,
  savedOffsets,
  secondStep3,
  secondHit,
  secondStep4,
  secondSelected,
  realLock,
  realSelected,
  resetPreviewStep3,
  resetPreviewHitBefore,
  resetPreview,
  resetPreviewHitAfter,
  savedOffsetsAfterResetPreview,
  afterUnsavedResetStep3,
  afterUnsavedResetHit,
  resetAndSave,
  resetAndSaveStep4,
  resetAndSaveSelected,
  savedOffsetsAfterResetNext
}, null, 2));
