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

function beijingTimestamp(year, month, day, hour, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute, 0);
}

async function runCase(browser, nowBeijing, expectedBeijing, shouldLock) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const now = beijingTimestamp(...nowBeijing);
  const expected = expectedBeijing ? beijingTimestamp(...expectedBeijing) : null;

  await page.addInitScript(({ now }) => {
    window.__tradovateAutoLockNow = now;
    window.__stored = {
      dailyLossLimit: 200,
      dailyProfitTarget: 300,
      scanIntervalSeconds: 60,
      lockDuration: '15m',
      lastPnl: 0,
      nextScanAt: now + 60000,
      lastCalendarCandidates: []
    };
    window.chrome = {
      tabs: {
        query(_query, cb) {
          const tabs = [{ id: 1, url: 'https://trader.tradovate.com/' }];
          cb?.(tabs);
          return Promise.resolve(tabs);
        },
        sendMessage() {
          return Promise.resolve({ ok: true });
        }
      },
      scripting: {
        executeScript() {
          return Promise.resolve();
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
            return Promise.resolve(items);
          }
        }
      }
    };
  }, { now });

  await page.goto(`file://${popupPath}`);
  await page.waitForTimeout(500);
  await page.click('#lockSettings');
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => ({
    storedUntil: window.__stored.settingsLockedUntil || null,
    lockedClass: document.getElementById('lockableSettings').classList.contains('settings-locked'),
    disabled: document.getElementById('dailyLossLimit').disabled,
    status: document.getElementById('saveStatus').textContent
  }));
  await page.close();

  if (shouldLock) {
    assert(result.storedUntil === expected, 'settings lock timestamp mismatch', {
      nowBeijing,
      expectedBeijing,
      expected,
      result
    });
    assert(result.lockedClass && result.disabled, 'settings should be disabled while locked', {
      nowBeijing,
      result
    });
  } else {
    assert(!result.storedUntil && !result.lockedClass && !result.disabled, 'settings should not lock between Beijing 04:00 and 06:00', {
      nowBeijing,
      result
    });
  }

  return { nowBeijing, expectedBeijing, shouldLock, result };
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});

const results = [];
results.push(await runCase(browser, [2026, 6, 28, 1, 30], [2026, 6, 28, 4, 0], true));
results.push(await runCase(browser, [2026, 6, 28, 8, 0], [2026, 6, 29, 4, 0], true));
results.push(await runCase(browser, [2026, 6, 28, 5, 0], null, false));

await browser.close();

console.log(JSON.stringify(results, null, 2));
