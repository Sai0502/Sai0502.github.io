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
  const runtimeKey = 'tradovateRuntimeState:default';
  window.__stored = {
    [runtimeKey]: {
      lastPnl: null,
      lastPnlSource: 'tradovate total pnl no match',
      nextScanAt: Date.now() + 30000,
      lastCalendarCandidates: [{ pnl: null, text: 'source tradovate total pnl no match' }]
    }
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
          return Promise.resolve({ ok: true, accountIdGuess: 'default' });
        }
        return Promise.resolve({ ok: true });
      }
    },
    scripting: {
      executeScript() {
        return Promise.resolve();
      }
    },
    storage: {
      onChanged: { addListener() {} },
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
          return Promise.resolve(items);
        }
      }
    }
  };
});

await page.goto(`file://${popupPath}`);
await page.waitForTimeout(500);

const state = await page.evaluate(() => ({
  bodyLoading: document.body.classList.contains('data-loading'),
  overlayHidden: document.getElementById('dataLoadingOverlay').classList.contains('hidden'),
  overlayText: document.getElementById('dataLoadingOverlay').textContent.trim(),
  executeDisabled: document.getElementById('executeLock').disabled,
  lockSettingsDisabled: document.getElementById('lockSettings').disabled,
  copySummaryDisabled: document.getElementById('copySummaryFromOverlay').disabled,
  settingsDisabled: ['dailyLossLimit', 'dailyProfitTarget', 'scanIntervalSeconds', 'lockDuration']
    .map(id => [id, document.getElementById(id).disabled]),
  debugCandidatesOpen: document.querySelector('details')?.open || false
}));

await browser.close();

assert(state.bodyLoading, 'popup should enter data-loading state when total pnl is unavailable', { state });
assert(!state.overlayHidden && state.overlayText.includes('数据获取中……'), 'data loading overlay should be visible with the expected text', { state });
assert(state.executeDisabled && state.lockSettingsDisabled, 'main action buttons should be disabled while total pnl is unavailable', { state });
assert(!state.copySummaryDisabled, 'summary copy button should stay available while total pnl is unavailable', { state });
assert(state.settingsDisabled.every(([, disabled]) => disabled), 'settings should be disabled while total pnl is unavailable', { state });
assert(!state.debugCandidatesOpen, 'debug candidates should be folded by default', { state });

console.log(JSON.stringify({ state }, null, 2));
