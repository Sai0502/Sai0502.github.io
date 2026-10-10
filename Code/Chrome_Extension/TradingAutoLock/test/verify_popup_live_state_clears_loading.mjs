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
  const monitorKey = 'tradovateMonitorSettings:default';
  const wsKey = 'tradovateWsCapture';
  window.__stored = {
    [runtimeKey]: {
      lastPnl: null,
      lastPnlSource: 'tradovate total pnl no match',
      nextScanAt: Date.now() + 60000,
      lastCalendarCandidates: []
    },
    [monitorKey]: {
      autoMonitorEnabled: true,
      autoLockEnabled: true,
      dailyLossLimit: 200,
      dailyProfitTarget: 300,
      scanIntervalSeconds: 60,
      lockDuration: 'end_of_day'
    },
    [wsKey]: {
      accountMappings: [
        { id: '57435508', name: 'LFE02568079020013' }
      ],
      tradeStatsByAccount: {
        LFE02568079020013: {
          accountId: '57435508',
          accountName: 'LFE02568079020013',
          accountMatchedBy: 'account_name',
          tradeCountToday: 3,
          flatToPositionEntriesToday: 3,
          fillCountToday: 6,
          tradeDayStartAtBeijing: '2026-07-21 06:00',
          tradeDayEndAtBeijing: '2026-07-22 06:00',
          dateKeyBeijing: '2026-07-21'
        }
      }
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
          return Promise.resolve({ ok: true, accountIdGuess: 'LFE02568079020013' });
        }
        if (message.type === 'tradovate-auto-lock:read-current-page-state') {
          return Promise.resolve({
            ok: true,
            accountId: 'LFE02568079020013',
            runtimeState: {
              lastPnl: -190,
              lastOpenPnl: 0,
              lastEquity: 25046.5,
              lastPnlSource: 'tradovate balance row total pnl',
              nextScanAt: Date.now() + 60000,
              lastTradeStats: {
                accountId: '57435508',
                accountName: 'LFE02568079020013',
                accountMatchedBy: 'account_name',
                tradeCountToday: 3,
                flatToPositionEntriesToday: 3,
                fillCountToday: 6
              }
            },
            tradeStats: {
              accountId: '57435508',
              accountName: 'LFE02568079020013',
              accountMatchedBy: 'account_name',
              tradeCountToday: 3,
              flatToPositionEntriesToday: 3,
              fillCountToday: 6
            }
          });
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
await page.waitForTimeout(900);

const state = await page.evaluate(() => ({
  bodyLoading: document.body.classList.contains('data-loading'),
  overlayHidden: document.getElementById('dataLoadingOverlay').classList.contains('hidden'),
  overlayText: document.getElementById('dataLoadingOverlay').textContent.trim(),
  todayOpen: document.querySelector('.entry-count')?.textContent?.trim() || '',
  scanCountdown: document.getElementById('scanCountdown')?.textContent?.trim() || '',
  activeTitle: document.getElementById('appTitle')?.textContent?.trim() || ''
}));

await browser.close();

assert(!state.bodyLoading, 'popup should clear data-loading state when live page state is available', { state });
assert(state.overlayHidden, 'overlay should be hidden when live page state has pnl', { state });
assert(state.todayOpen === '3', 'today open count should be rendered from live trade stats', { state });
assert(state.scanCountdown.endsWith('s'), 'countdown should still render while not loading', { state });
assert(state.activeTitle.includes('v2026_0721_103000'), 'popup should show new build label', { state });

console.log(JSON.stringify({ state }, null, 2));
