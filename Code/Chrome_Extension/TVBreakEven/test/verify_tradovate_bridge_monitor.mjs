import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const mockPath = path.join(__dirname, 'mock_tradingview.html');
const contractsPath = path.join(extensionDir, 'data/contracts.js');
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
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

await page.addInitScript(() => {
  window.__messages = [];
  window.__alerts = [];
  window.__modifyRequests = [];
  window.alert = message => window.__alerts.push(String(message));
  window.__store = {
    enabled: true,
    triggerPrice: '4568',
    breakevenPrice: '4551.75',
    side: 'long',
    executionMode: 'auto',
    triggered: false,
    logs: [],
    debugEvents: []
  };
  window.__bridgeState = {
    accounts: [{ id: 'ACC-1', name: 'Test Account' }],
    chartSymbol: 'MGC1!',
    auth: { loggedIn: true, baseUrl: 'https://tv-demo.tradovateapi.com' },
    state: {
      'ACC-1': {
        lastUpdate: Date.now(),
        positions: [{
          id: 'POS-1',
          instrument: 'MGCM6',
          qty: 1,
          side: 'buy',
          avgPrice: 4551.75,
          unrealizedPl: 165
        }],
        orders: [{
          id: 'TP-1',
          instrument: 'MGCM6',
          qty: 1,
          side: 'sell',
          type: 'limit',
          limitPrice: 4588,
          status: 'working',
          durationType: 'GTC',
          bracketType: 'takeProfit'
        }, {
          id: 'STOP-1',
          instrument: 'MGCM6',
          qty: 1,
          side: 'sell',
          type: 'stop',
          stopPrice: 4548,
          status: 'working',
          duration: { type: 'Day' }
        }]
      }
    },
    ts: Date.now()
  };
  window.addEventListener('message', event => {
    if (!event.data || event.data.source !== 'tvbe-content') return;
    if (event.data.type === 'get-tradovate-state') {
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'tradovate-state',
        requestId: event.data.requestId,
        payload: window.__bridgeState
      }, '*');
    }
    if (event.data.type === 'modify-stop-order') {
      const durationType = event.data.rawOrder?.durationType ||
        event.data.rawOrder?.timeInForce ||
        event.data.rawOrder?.duration?.type ||
        'GTC';
      window.__modifyRequests.push({
        accountId: event.data.accountId,
        orderId: event.data.orderId,
        stopPrice: event.data.stopPrice,
        rawOrder: event.data.rawOrder
      });
      const stop = window.__bridgeState.state['ACC-1'].orders.find(order => order.id === event.data.orderId);
      if (stop) stop.stopPrice = Number(event.data.stopPrice);
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'modify-stop-order-result',
        requestId: event.data.requestId,
        payload: { ok: true, response: { s: 'ok' }, body: `durationType=${durationType}&stopPrice=${event.data.stopPrice}` }
      }, '*');
    }
  });
  window.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          window.__listener = fn;
        }
      },
      sendMessage(message) {
        window.__messages.push(message);
        return Promise.resolve({ ok: true });
      }
    },
    storage: {
      local: {
        get(defaults, cb) {
          const out = {};
          for (const [key, value] of Object.entries(defaults || {})) {
            out[key] = window.__store[key] ?? value;
          }
          cb?.(out);
          return Promise.resolve(out);
        },
        set(values, cb) {
          Object.assign(window.__store, values);
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});

await page.goto(`file://${mockPath}`);
await page.evaluate(() => window.__setMockPrice(4568.25));
await page.addScriptTag({ path: contractsPath });
await page.addScriptTag({ path: contentPath });
await page.waitForTimeout(1400);

const result = await page.evaluate(() => ({
  triggered: window.__store.triggered,
  enabled: window.__store.enabled,
  lastCurrentPrice: window.__store.lastCurrentPrice,
  lastCurrentPriceSource: window.__store.lastCurrentPriceSource,
  lastExecutionResult: window.__store.lastExecutionResult,
  lastOrderSnapshot: window.__store.lastOrderSnapshot,
  modifyRequests: window.__modifyRequests,
  logs: window.__store.logs,
  debugEvents: window.__store.debugEvents,
  alerts: window.__alerts,
  messages: window.__messages
}));

assert(result.triggered === false && result.enabled === false, 'auto monitor should trigger and return to unstarted state', { result });
assert(result.lastOrderSnapshot?.entryPrice === 4551.75, 'auto monitor should still read Tradovate order info', { result });
assert(result.lastCurrentPrice === 4568.25, 'auto monitor should use TradingView title price, not Tradovate PnL-derived price', { result });
assert(result.modifyRequests.length === 1, 'auto monitor should ask bridge to modify exactly one stop order', { result });
assert(result.modifyRequests[0].accountId === 'ACC-1', 'modify request should use bridge account id', { result });
assert(result.modifyRequests[0].orderId === 'STOP-1', 'modify request should use stop order id', { result });
assert(result.modifyRequests[0].rawOrder?.type === 'stop', 'modify request should not target take-profit limit order', { result });
assert(Number(result.modifyRequests[0].stopPrice) === 4551.75, 'modify request should use breakeven price', { result });
assert(/durationType=Day/.test(result.lastExecutionResult?.response?.body || ''), 'modify request should serialize Tradovate duration object as Day', { result });
assert(result.lastExecutionResult?.ok === true, 'execution result should be ok when bridge confirms modify', { result });
assert(result.lastExecutionResult?.method === 'tradovate-api-put-order', 'execution should use Tradovate API method', { result });
assert(result.logs.some(item => /推保执行已发送/.test(item.message)), 'logs should include successful execution send', { result });

await browser.close();

console.log(JSON.stringify(result, null, 2));
