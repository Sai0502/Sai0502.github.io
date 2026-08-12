import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright');

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
const page = await browser.newPage({ viewport: { width: 430, height: 860 } });

await page.addInitScript(() => {
  window.__sentMessages = [];
  window.__clipboard = '';
  window.__stored = {
    enabled: false,
    triggerPrice: '',
    breakevenPrice: '',
    side: 'long',
    executionMode: 'assist',
    triggered: false,
    lastCurrentPrice: 4560,
    lastSnapshot: {
      currentPrice: 4560,
      currentPriceSource: 'Last price 4560.00',
      sideHint: 'long',
      textHints: {
        hasTradovate: true,
        hasPaperTrading: false,
        hasPosition: true,
        hasStop: true,
        hasProfit: true
      }
    },
    logs: [],
    debugEvents: []
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText(text) {
        window.__clipboard = String(text);
        return Promise.resolve();
      }
    }
  });
  window.chrome = {
    tabs: {
      query(_query, cb) {
        const tabs = [{ id: 1, url: 'https://cn.tradingview.com/chart/mock' }];
        cb?.(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage(_tabId, message) {
        window.__sentMessages.push(message);
        if (message.type === 'tvbe:snapshot') {
          return Promise.resolve({ ok: true, snapshot: window.__stored.lastSnapshot, priceCandidates: [] });
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
      local: {
        get(defaults, cb) {
          const out = {};
          for (const [key, value] of Object.entries(defaults || {})) {
            out[key] = window.__stored[key] ?? value;
          }
          cb?.(out);
          return Promise.resolve(out);
        },
        set(values, cb) {
          Object.assign(window.__stored, values);
          cb?.();
          return Promise.resolve(values);
        }
      }
    }
  };
});

await page.goto(`file://${popupPath}`);
await page.waitForTimeout(500);

const initial = await page.evaluate(() => ({
  warningHidden: document.getElementById('pageWarning').classList.contains('hidden'),
  currentPrice: document.getElementById('currentPrice').textContent,
  stateText: document.getElementById('stateText').textContent,
  hasDebugCopy: Boolean(document.getElementById('copyDebug')),
  debugText: document.getElementById('debugOutput').textContent
}));
assert(initial.warningHidden, 'TradingView warning should be hidden on cn.tradingview.com URL', { initial });
assert(initial.currentPrice === '4560', 'current price should render', { initial });
assert(initial.hasDebugCopy && /urlMatched/.test(initial.debugText), 'debug output should render with copy button', { initial });

await page.fill('#triggerPrice', 'abc4568.50x');
await page.locator('#triggerPrice').blur();
await page.fill('#breakevenPrice', '4552');
await page.locator('#breakevenPrice').blur();
await page.selectOption('#executionMode', 'auto');
await page.waitForTimeout(200);

const saved = await page.evaluate(() => ({
  triggerPrice: window.__stored.triggerPrice,
  breakevenPrice: window.__stored.breakevenPrice,
  executionMode: window.__stored.executionMode,
  debugEvents: window.__stored.debugEvents
}));
assert(saved.triggerPrice === '4568.50' && saved.breakevenPrice === '4552', 'popup should sanitize and save prices', { saved });
assert(saved.executionMode === 'auto', 'execution mode should save', { saved });
assert(saved.debugEvents.some(item => item.event === 'saveSettings'), 'debug events should record saved settings', { saved });

await page.fill('#breakevenPrice', '');
await page.locator('#breakevenPrice').blur();
await page.click('#start');
await page.waitForTimeout(250);
const blockedInvalid = await page.evaluate(() => ({
  enabled: window.__stored.enabled,
  status: document.getElementById('saveStatus').textContent,
  debugEvents: window.__stored.debugEvents
}));
assert(blockedInvalid.enabled === false, 'start should be blocked when breakeven price is empty', { blockedInvalid });
assert(/大于 0/.test(blockedInvalid.status), 'empty breakeven should show validation message', { blockedInvalid });

await page.evaluate(() => {
  window.__stored.lastSnapshot = {
    ...window.__stored.lastSnapshot,
    entryPrice: 4551.75,
    entryPriceSource: 'Position Avg Price 4,551.75'
  };
});
await page.fill('#breakevenPrice', '');
await page.locator('#breakevenPrice').blur();
await page.click('#start');
await page.waitForTimeout(250);
const autoFilledStart = await page.evaluate(() => ({
  enabled: window.__stored.enabled,
  breakevenPrice: window.__stored.breakevenPrice,
  messages: window.__sentMessages,
  logs: window.__stored.logs,
  debugEvents: window.__stored.debugEvents
}));
assert(autoFilledStart.enabled === true, 'start should enable monitor after auto-filling entry price', { autoFilledStart });
assert(autoFilledStart.breakevenPrice === '4551.75', 'entry price should auto-fill breakeven price when confidently detected', { autoFilledStart });
assert(autoFilledStart.logs.some(item => /自动识别开仓价/.test(item.message)), 'auto-fill should write a visible log', { autoFilledStart });

await page.click('#stop');
await page.waitForTimeout(150);
await page.fill('#breakevenPrice', '4552');
await page.locator('#breakevenPrice').blur();
await page.waitForTimeout(120);

await page.click('#start');
await page.waitForTimeout(250);
const started = await page.evaluate(() => ({
  enabled: window.__stored.enabled,
  triggered: window.__stored.triggered,
  messages: window.__sentMessages,
  logs: window.__stored.logs,
  stateText: document.getElementById('stateText').textContent
}));
assert(started.enabled === true && started.triggered === false, 'start should enable monitor', { started });
assert(started.messages.some(message => message.type === 'tvbe:start-loop'), 'start should ask content script to start loop', { started });

await page.click('#stop');
await page.waitForTimeout(200);
await page.click('#copyDebug');
await page.waitForTimeout(150);
const stopped = await page.evaluate(() => ({
  enabled: window.__stored.enabled,
  logs: window.__stored.logs,
  clipboard: window.__clipboard
}));
assert(stopped.enabled === false, 'stop should disable monitor', { stopped });
assert(stopped.logs.some(item => /停止监控/.test(item.message)), 'stop should log', { stopped });
assert(/debugEvents/.test(stopped.clipboard), 'copy debug should write debug payload to clipboard', { stopped });

await browser.close();

console.log(JSON.stringify({
  initial,
  saved,
  blockedInvalid,
  autoFilledStart,
  started,
  stopped
}, null, 2));
