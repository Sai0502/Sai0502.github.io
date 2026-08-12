import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const bridgePath = path.join(extensionDir, 'ws-bridge.js');

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
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

await page.goto('about:blank');
await page.evaluate(() => {
  window.__stored = {};
  window.chrome = {
    storage: {
      local: {
        set(items, cb) {
          Object.assign(window.__stored, items);
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});

await page.addScriptTag({ path: bridgePath });
await page.evaluate(() => {
  window.postMessage({
    source: 'tradovate-auto-lock:ws-capture',
    ts: Date.now(),
    kind: 'frame',
    direction: 'in',
    dataType: 'string',
    size: 320,
    keywords: ['position'],
    entitySummaries: [{ entityType: 'positions', count: 1 }],
    tradeFacts: [
      {
        kind: 'position',
        entityType: 'positions',
        accountId: 56666167,
        contractId: 4399631,
        timestamp: new Date().toISOString(),
        bought: 5,
        sold: 6,
        netPos: -1
      }
    ]
  }, '*');
});
await page.waitForTimeout(600);

const capture = await page.evaluate(() => window.__stored.tradovateWsCapture);
await browser.close();

assert(capture && capture.tradeStats, 'capture stats missing', { capture });
assert(capture.tradeStats.tradeCountToday === 0, 'position bought/sold should not be used as current trade count', {
  tradeStats: capture.tradeStats
});
assert(capture.tradeStats.fillCountToday === 0, 'position bought/sold should not be used as current fill count', {
  tradeStats: capture.tradeStats
});
assert(capture.tradeStats.positionTradeCountEstimate === 6, 'position bought/sold should remain available as diagnostics', {
  tradeStats: capture.tradeStats
});
assert(capture.tradeStats.positionFillCountEstimate === 11, 'position bought/sold fill estimate should remain available as diagnostics', {
  tradeStats: capture.tradeStats
});
assert(capture.tradeStats.tradeCountSource === 'position_increase_fills', 'trade count source should use actual position-increase entry fills', {
  tradeStats: capture.tradeStats
});

console.log(JSON.stringify({ ok: true, tradeStats: capture.tradeStats }, null, 2));
