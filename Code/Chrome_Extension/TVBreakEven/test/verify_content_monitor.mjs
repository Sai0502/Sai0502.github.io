import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const mockPath = path.join(__dirname, 'mock_tradingview.html');
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
  window.__removeLineRequests = 0;
  window.__modifyRequests = [];
  window.alert = message => window.__alerts.push(String(message));
  window.__store = {
    enabled: true,
    triggerPrice: '4568',
    breakevenPrice: '4552',
    side: 'long',
    executionMode: 'assist',
    triggered: false,
    logs: [],
    debugEvents: []
  };
  window.__bridgeState = null;
  window.addEventListener('message', event => {
    if (!event.data || event.data.source !== 'tvbe-content') return;
    if (event.data.type === 'get-tradovate-state' && window.__bridgeState) {
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'tradovate-state',
        requestId: event.data.requestId,
        payload: window.__bridgeState
      }, '*');
    }
    if (event.data.type === 'draw-horizontal-line') {
      window.__lastDrawLine = {
        kind: event.data.kind,
        price: event.data.price,
        text: event.data.text,
        color: event.data.color
      };
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'draw-horizontal-line-result',
        requestId: event.data.requestId,
        payload: { ok: true, id: `line-${event.data.kind}`, price: event.data.price, text: event.data.text }
      }, '*');
    }
    if (event.data.type === 'remove-horizontal-lines') {
      window.__removeLineRequests += 1;
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'remove-horizontal-lines-result',
        requestId: event.data.requestId,
        payload: { ok: true, removed: { trigger: true, breakeven: true } }
      }, '*');
    }
    if (event.data.type === 'modify-stop-order') {
      window.__modifyRequests.push({
        accountId: event.data.accountId,
        orderId: event.data.orderId,
        stopPrice: event.data.stopPrice
      });
      if (window.__bridgeState?.state?.[event.data.accountId]) {
        const stop = window.__bridgeState.state[event.data.accountId].orders.find(order => order.id === event.data.orderId);
        if (stop) stop.stopPrice = event.data.stopPrice;
      }
      window.postMessage({
        source: 'tvbe-bridge',
        type: 'modify-stop-order-result',
        requestId: event.data.requestId,
        payload: { ok: true, response: { s: 'ok' } }
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
await page.addScriptTag({ path: contentPath });
await page.waitForTimeout(500);

const snapshot = await page.evaluate(() => new Promise(resolve => {
  window.__listener({ type: 'tvbe:snapshot' }, {}, resolve);
}));
assert(snapshot.ok && snapshot.snapshot.currentPrice === 4559.5, 'snapshot should prefer document title current price over OHLC/body candidates', { snapshot });
assert(snapshot.priceCandidates.some(item => item.price === 4560 && /4,560/.test(item.text)), 'price parser should keep thousands-grouped prices intact', { snapshot });
assert(snapshot.priceCandidates.some(item => item.price === 3978.5), 'price parser should parse real TradingView trade panel thousands price as 3978.5', { snapshot });
assert(!snapshot.priceCandidates.some(item => item.price === 978.5), 'price parser should not split 3,978.50 into 978.50', { snapshot });
const debugAfterSnapshot = await page.evaluate(() => window.__store.debugEvents);
assert(debugAfterSnapshot.some(item => item.event === 'snapshot'), 'snapshot should write debug event', { debugAfterSnapshot });

await page.evaluate(() => {
  window.__store.enabled = false;
});
const lineCreated = await page.evaluate(() => new Promise(resolve => {
  window.__listener({ type: 'tvbe:create-line' }, {}, resolve);
}));
const lineState = await page.evaluate(lineCreatedResult => ({
  ok: lineCreatedResult.ok,
  hasLine: Boolean(document.getElementById('tvbe-trigger-line')),
  hasConfirm: Boolean(document.querySelector('#tvbe-trigger-line .tvbe-confirm')),
  triggerPrice: window.__store.triggerPrice,
  logs: window.__store.logs,
  debugEvents: window.__store.debugEvents
}), lineCreated);
assert(lineState.ok && lineState.hasLine && !lineState.hasConfirm, 'trigger line should stay on chart without confirm button', { lineState });
assert(Number(lineState.triggerPrice) > 0, 'trigger line should immediately save trigger price', { lineState });
assert(lineState.debugEvents.some(item => item.event === 'triggerLine:create' && item.details.mapperSource === 'price-axis'), 'trigger line should use visible price-axis labels when available', { lineState });
assert(Number(lineState.triggerPrice) > 4500 && Number(lineState.triggerPrice) < 4600, 'trigger line price should come from chart axis range', { lineState });

const breakevenLineCreated = await page.evaluate(() => new Promise(resolve => {
  window.__listener({ type: 'tvbe:create-breakeven-line' }, {}, resolve);
}));
const breakevenLineState = await page.evaluate(lineCreatedResult => ({
  ok: lineCreatedResult.ok,
  hasLine: Boolean(document.getElementById('tvbe-breakeven-line')),
  breakevenPrice: window.__store.breakevenPrice,
  debugEvents: window.__store.debugEvents
}), breakevenLineCreated);
assert(breakevenLineState.ok && breakevenLineState.hasLine, 'breakeven line should be created', { breakevenLineState });
assert(Number(breakevenLineState.breakevenPrice) > 4500 && Number(breakevenLineState.breakevenPrice) < 4600, 'breakeven line should save breakeven price', { breakevenLineState });

const panelCreated = await page.evaluate(() => new Promise(resolve => {
  window.__listener({ type: 'tvbe:show-panel' }, {}, resolve);
}));
const panelState = await page.evaluate(result => ({
  ok: result.ok,
  hasPanel: Boolean(document.getElementById('tvbe-side-panel')),
  title: document.querySelector('#tvbe-side-panel .tvbe-panel-title')?.textContent || '',
  hasSetupButton: Boolean(document.querySelector('[data-tvbe-action="setup-lines"]')),
  hasTestSetupButton: Boolean(document.querySelector('[data-tvbe-action="test-setup"]')),
  hasReadOrderButton: Boolean(document.querySelector('[data-tvbe-action="read-order"]')),
  hasDirectionSelect: Boolean(document.querySelector('[data-tvbe-input="side"]')),
  hasDebugWindow: Boolean(document.querySelector('[data-tvbe-debug]')),
  hasTakeProfitField: Boolean(document.querySelector('[data-tvbe-tp]')),
  hasStartButton: Boolean(document.querySelector('[data-tvbe-action="start"]')),
  hasStopButton: Boolean(document.querySelector('[data-tvbe-action="stop"]')),
  setupButtonText: document.querySelector('[data-tvbe-action="setup-lines"]')?.textContent || '',
  executionMode: document.querySelector('[data-tvbe-input="executionMode"]')?.value || '',
  debugCopyInHeader: Boolean(document.querySelector('.tvbe-section-head [data-tvbe-action="copy-debug"]'))
}), panelCreated);
assert(panelState.ok && panelState.hasPanel && panelState.hasSetupButton && panelState.hasDebugWindow, 'side panel should render compact controls', { panelState });
assert(!panelState.hasTestSetupButton, 'side panel should remove test setup button', { panelState });
assert(/TVBreakEven v\d{14}/.test(panelState.title), 'side panel should show timestamp version', { panelState });
assert(!panelState.hasReadOrderButton && !panelState.hasDirectionSelect, 'side panel should remove read-order and direction controls', { panelState });
assert(!panelState.hasStartButton && !panelState.hasStopButton, 'side panel should auto-start from setup and remove manual monitor buttons', { panelState });
assert(/启动监控/.test(panelState.setupButtonText), 'main button should start as red start-monitor button', { panelState });
assert(panelState.executionMode === 'auto', 'execution mode should default to auto stop movement', { panelState });
assert(!panelState.hasTakeProfitField && panelState.debugCopyInHeader, 'side panel should remove take profit and move debug copy button to debug header', { panelState });
const connectionPriorityState = await page.evaluate(async () => {
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
          avgPrice: 4551.75
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
  await new Promise(resolve => setTimeout(resolve, 1400));
  return {
    connectionText: document.querySelector('[data-tvbe-connection]')?.textContent || '',
    hintText: document.querySelector('[data-tvbe-order-hint]')?.textContent || '',
    triggerValue: document.querySelector('[data-tvbe-input="triggerPrice"]')?.value || '',
    breakevenValue: document.querySelector('[data-tvbe-input="breakevenPrice"]')?.value || '',
    triggerDisabled: document.querySelector('[data-tvbe-input="triggerPrice"]')?.disabled,
    breakevenDisabled: document.querySelector('[data-tvbe-input="breakevenPrice"]')?.disabled
  };
});
assert(/Tradovate/.test(connectionPriorityState.connectionText) && !/Paper/.test(connectionPriorityState.connectionText), 'Tradovate bridge should take priority over Paper Trading page text', { connectionPriorityState });
assert(connectionPriorityState.triggerValue === '' && connectionPriorityState.breakevenValue === '' && connectionPriorityState.triggerDisabled && connectionPriorityState.breakevenDisabled, 'unstarted monitor should keep trigger/breakeven blank and disabled', { connectionPriorityState });
const testSetupState = await page.evaluate(async () => {
  window.__store.enabled = false;
  window.__store.triggered = true;
  window.__store.startedAt = Date.now() - 1000;
  window.__store.triggeredAt = Date.now();
  window.__setMockPrice(4550);
  document.querySelector('[data-tvbe-action="setup-lines"]').click();
  await new Promise(resolve => setTimeout(resolve, 1600));
  const orderSeed = {
    triggerPrice: window.__store.triggerPrice,
    breakevenPrice: window.__store.breakevenPrice,
    enabled: window.__store.enabled,
    triggered: window.__store.triggered,
    linesVisible: window.__store.linesVisible,
    setupButtonText: document.querySelector('[data-tvbe-action="setup-lines"]').textContent,
    stopOrderId: window.__store.lastOrderSnapshot?.stopOrderId,
    stopPrice: window.__store.lastOrderSnapshot?.stopPrice,
    rawStopType: window.__store.lastOrderSnapshot?.rawStopOrder?.type
  };
  document.querySelector('[data-tvbe-action="setup-lines"]').click();
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    orderSeed,
    triggerPrice: window.__store.triggerPrice,
    breakevenPrice: window.__store.breakevenPrice,
    logs: window.__store.logs,
    lastDrawLine: window.__lastDrawLine,
    removeLineRequests: window.__removeLineRequests
  };
});
assert(testSetupState.orderSeed.triggerPrice === '4569.88' && testSetupState.orderSeed.breakevenPrice === '4549.88', 'setup should seed trigger from entry/take-profit midpoint and breakeven from entry/stop midpoint', { testSetupState });
assert(testSetupState.orderSeed.stopOrderId === 'STOP-1' && testSetupState.orderSeed.rawStopType === 'stop' && testSetupState.orderSeed.stopPrice === 4548, 'setup should choose the protective stop order instead of the take-profit limit order', { testSetupState });
assert(testSetupState.orderSeed.linesVisible === true && testSetupState.orderSeed.triggered === false && testSetupState.orderSeed.enabled === true, 'setup should reset triggered state, show lines, and auto-start monitor', { testSetupState });
assert(/取消监控/.test(testSetupState.orderSeed.setupButtonText), 'setup button should become cancel monitor while running', { testSetupState });
assert(testSetupState.triggerPrice === '' && testSetupState.breakevenPrice === '', 'cancel monitor should clear setup prices', { testSetupState });
assert(testSetupState.lastDrawLine && !/\d/.test(testSetupState.lastDrawLine.text), 'native line label should not include stale price text', { testSetupState });
const dragState = await page.evaluate(async () => {
  const panel = document.getElementById('tvbe-side-panel');
  const header = panel.querySelector('.tvbe-panel-header');
  const before = panel.getBoundingClientRect();
  header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: before.left + 20, clientY: before.top + 14 }));
  header.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: before.left - 100, clientY: before.top + 60 }));
  header.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: before.left - 100, clientY: before.top + 60 }));
  const after = panel.getBoundingClientRect();
  return { before: { left: before.left, top: before.top }, after: { left: after.left, top: after.top } };
});
assert(dragState.after.left !== dragState.before.left || dragState.after.top !== dragState.before.top, 'side panel should be draggable', { dragState });
await page.evaluate(() => {
  window.__store.enabled = true;
  window.__store.triggered = false;
  window.__store.executionMode = 'assist';
  window.__store.triggerPrice = '4568';
  window.__store.breakevenPrice = '4550';
});

await page.evaluate(() => window.__setMockPrice(4567));
await page.waitForTimeout(1300);
let preTrigger = await page.evaluate(() => ({
  triggered: window.__store.triggered,
  enabled: window.__store.enabled,
  logs: window.__store.logs,
  alerts: window.__alerts
}));
assert(preTrigger.triggered === false && preTrigger.enabled === true, 'monitor should not trigger before price reaches trigger', { preTrigger });

await page.evaluate(() => window.__setMockPrice(4568.25));
await page.waitForTimeout(1400);
const triggered = await page.evaluate(() => ({
  triggered: window.__store.triggered,
  enabled: window.__store.enabled,
  linesVisible: window.__store.linesVisible,
  triggerPrice: window.__store.triggerPrice,
  breakevenPrice: window.__store.breakevenPrice,
  stateText: document.querySelector('[data-tvbe-state]')?.textContent || '',
  setupButtonText: document.querySelector('[data-tvbe-action="setup-lines"]')?.textContent || '',
  removeLineRequests: window.__removeLineRequests,
  result: window.__store.lastExecutionResult,
  logs: window.__store.logs,
  debugEvents: window.__store.debugEvents,
  alerts: window.__alerts,
  messages: window.__messages,
  modifyRequests: window.__modifyRequests
}));
assert(triggered.triggered === false && triggered.enabled === false && /未启动/.test(triggered.stateText) && /启动监控/.test(triggered.setupButtonText), 'monitor should return to unstarted state after trigger', { triggered });
assert(triggered.triggerPrice === '' && triggered.breakevenPrice === '', 'trigger should clear setup prices after completion', { triggered });
assert(triggered.linesVisible === false && triggered.removeLineRequests >= 1, 'trigger should remove setup lines', { triggered });
assert(triggered.alerts.length === 0 && triggered.modifyRequests.some(item => item.orderId === 'STOP-1' && item.stopPrice === 4550), 'default auto mode should try to move the Tradovate stop instead of alerting', { triggered });
assert(triggered.logs.some(item => /触发推保/.test(item.message)), 'logs should include trigger message', { triggered });
assert(triggered.debugEvents.some(item => item.event === 'trigger:reached'), 'trigger should write debug event', { triggered });

const resetAfterTriggered = await page.evaluate(async () => {
  window.__setMockPrice(4550);
  document.querySelector('[data-tvbe-action="setup-lines"]').click();
  await new Promise(resolve => setTimeout(resolve, 1600));
  return {
    triggered: window.__store.triggered,
    enabled: window.__store.enabled,
    linesVisible: window.__store.linesVisible,
    stateText: document.querySelector('[data-tvbe-state]')?.textContent || ''
  };
});
assert(resetAfterTriggered.triggered === false && resetAfterTriggered.enabled === true && resetAfterTriggered.linesVisible === true && /监控中/.test(resetAfterTriggered.stateText), 'setting lines after trigger should reset and auto-start for a second monitor', { resetAfterTriggered });

await page.evaluate(() => window.__setMockPrice(4572));
await page.waitForTimeout(1300);
const afterRepeat = await page.evaluate(() => ({
  triggered: window.__store.triggered,
  enabled: window.__store.enabled,
  alerts: window.__alerts,
  logs: window.__store.logs,
  modifyRequests: window.__modifyRequests
}));
assert(afterRepeat.triggered === false && afterRepeat.enabled === false && afterRepeat.alerts.length === 0 && afterRepeat.modifyRequests.length >= 2, 'second setup after trigger should allow a second auto monitor cycle', { afterRepeat });

await browser.close();

console.log(JSON.stringify({
  snapshot,
  preTrigger,
  triggered,
  afterRepeat
}, null, 2));
