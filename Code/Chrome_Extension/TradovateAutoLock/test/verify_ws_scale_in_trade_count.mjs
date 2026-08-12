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

const page = await browser.newPage();
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

const result = await page.evaluate(async () => {
  const now = Date.now();
  const ts = offset => new Date(now + offset * 1000).toISOString();
  const accountId = 56666167;
  const accountName = 'LFE05067750200006';
  const facts = [
    { kind: 'account', id: accountId, name: accountName, timestamp: ts(-1000) },
    { kind: 'fill', id: 'f1', accountId, contractId: 'MGCQ6', timestamp: ts(-400), action: 'Buy', qty: 5 },
    { kind: 'fill', id: 'f2', accountId, contractId: 'MGCQ6', timestamp: ts(-300), action: 'Buy', qty: 15 },
    { kind: 'fill', id: 'f3', accountId, contractId: 'MGCQ6', timestamp: ts(-200), action: 'Sell', qty: 15 },
    { kind: 'fill', id: 'f4', accountId, contractId: 'MGCQ6', timestamp: ts(-100), action: 'Sell', qty: 5 },
    { kind: 'position', id: 'p1', accountId, contractId: 'MGCQ6', timestamp: ts(-90), netPos: 0, bought: 20, sold: 20 }
  ];
  window.postMessage({
    source: 'tradovate-auto-lock:ws-capture',
    kind: 'frame',
    direction: 'in',
    dataType: 'string',
    json: true,
    keywords: ['fill', 'position'],
    tradeFacts: facts,
    ts: Date.now()
  }, '*');
  await new Promise(resolve => setTimeout(resolve, 600));
  return window.__stored.tradovateWsCapture;
});

await browser.close();

const byAccount = result.tradeStatsByAccount || {};
const stats = byAccount.LFE05067750200006;

assert(stats, 'expected account-scoped stats for scale-in account', { result });
assert(stats.fillCountToday === 4, 'scale-in example should have 4 fills', { stats });
assert(stats.entryFillsToday === 2, 'first entry and same-direction scale-in should count as 2 entry fills', { stats });
assert(stats.flatToPositionEntriesToday === 1, 'flat-to-position should remain 1 for diagnostics', { stats });
assert(stats.tradeCountToday === 2, 'tradeCountToday should count position-increase entries, including scale-ins', { stats });
assert(stats.netPositionAbsEstimate === 0, 'scale-in example should finish flat', { stats });
assert(stats.tradeCountSource === 'position_increase_fills', 'trade count source should describe the new definition', { stats });

console.log(JSON.stringify({ ok: true, stats }, null, 2));
