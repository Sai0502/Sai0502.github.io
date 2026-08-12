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
  const facts = [
    { kind: 'account', id: 101, name: 'LFE02568079020013', timestamp: ts(-1000) },
    { kind: 'account', id: 102, name: 'LFE02568079020012', timestamp: ts(-1000) },
    { kind: 'order', id: 'oa1', accountId: 101, contractId: 'MESU6', timestamp: ts(-601), action: 'Sell', orderQty: 1 },
    { kind: 'order', id: 'oa2', accountId: 101, contractId: 'MESU6', timestamp: ts(-561), action: 'Buy', orderQty: 1 },
    { kind: 'order', id: 'oa3', accountId: 101, contractId: 'MESU6', timestamp: ts(-521), action: 'Buy', orderQty: 1 },
    { kind: 'order', id: 'oa4', accountId: 101, contractId: 'MESU6', timestamp: ts(-481), action: 'Sell', orderQty: 1 },
    { kind: 'order', id: 'oa5', accountId: 101, contractId: 'MESU6', timestamp: ts(-441), action: 'Sell', orderQty: 1 },
    { kind: 'order', id: 'oa6', accountId: 101, contractId: 'MESU6', timestamp: ts(-401), action: 'Buy', orderQty: 1 },
    { kind: 'fill', id: 'a1', orderId: 'oa1', contractId: 'MESU6', timestamp: ts(-600), action: 'Sell', qty: 1 },
    { kind: 'fill', id: 'a2', orderId: 'oa2', contractId: 'MESU6', timestamp: ts(-560), action: 'Buy', qty: 1 },
    { kind: 'fill', id: 'a3', orderId: 'oa3', contractId: 'MESU6', timestamp: ts(-520), action: 'Buy', qty: 1 },
    { kind: 'fill', id: 'a4', orderId: 'oa4', contractId: 'MESU6', timestamp: ts(-480), action: 'Sell', qty: 1 },
    { kind: 'fill', id: 'a5', orderId: 'oa5', contractId: 'MESU6', timestamp: ts(-440), action: 'Sell', qty: 1 },
    { kind: 'fill', id: 'a6', orderId: 'oa6', contractId: 'MESU6', timestamp: ts(-400), action: 'Buy', qty: 1 },
    { kind: 'position', id: 'pa', accountId: 101, contractId: 'MESU6', timestamp: ts(-350), netPos: 0, bought: 6, sold: 6 },
    { kind: 'order', id: 'ob1', accountId: 102, contractId: 'MESU6', timestamp: ts(-301), action: 'Buy', orderQty: 1 },
    { kind: 'order', id: 'ob2', accountId: 102, contractId: 'MESU6', timestamp: ts(-251), action: 'Sell', orderQty: 1 },
    { kind: 'fill', id: 'b1', orderId: 'ob1', contractId: 'MESU6', timestamp: ts(-300), action: 'Buy', qty: 1 },
    { kind: 'fill', id: 'b2', orderId: 'ob2', contractId: 'MESU6', timestamp: ts(-250), action: 'Sell', qty: 1 },
    { kind: 'position', id: 'pb', accountId: 102, contractId: 'MESU6', timestamp: ts(-220), netPos: 0, bought: 1, sold: 1 }
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
const a = byAccount.LFE02568079020013;
const b = byAccount.LFE02568079020012;
assert(a && b, 'expected account-name keyed trade stats', { result });
assert(a.tradeCountToday === 3, 'account A should have 3 flat-to-position entries, not position bought/sold=6', { a });
assert(a.fillCountToday === 6, 'account A fill count should stay at raw fills only', { a });
assert(a.positionTradeCountEstimate === 6, 'account A should keep position estimate only as diagnostics', { a });
assert(b.tradeCountToday === 1, 'account B should be isolated from account A', { b });
assert(result.tradeStats.tradeCountToday === 4, 'global diagnostic can be mixed, but content should not use it for locking', {
  global: result.tradeStats
});

console.log(JSON.stringify({
  ok: true,
  accountA: {
    tradeCountToday: a.tradeCountToday,
    fillCountToday: a.fillCountToday,
    positionTradeCountEstimate: a.positionTradeCountEstimate
  },
  accountB: {
    tradeCountToday: b.tradeCountToday,
    fillCountToday: b.fillCountToday
  }
}, null, 2));
