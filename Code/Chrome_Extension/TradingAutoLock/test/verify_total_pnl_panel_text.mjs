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
const page = await browser.newPage({ viewport: { width: 1328, height: 900 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__autoLockListeners = [];
  const monitorKey = 'tradovateMonitorSettings:LFE02567750200006';
  window.__stored = {
    [monitorKey]: {
      autoMonitorEnabled: true,
      autoLockEnabled: true,
      dailyLossLimit: 250,
      dailyProfitTarget: 550,
      scanIntervalSeconds: 60,
      lockDuration: 'end_of_day'
    }
  };
  window.chrome = {
    runtime: { onMessage: { addListener(fn) { window.__autoLockListeners.push(fn); } } },
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
          return Promise.resolve();
        }
      }
    }
  };
});
await page.addScriptTag({ path: contentPath });

await page.evaluate(() => {
  document.querySelector('[data-mock-equity]').textContent = '24489.40 USD';
  const panel = document.querySelector('.account-detail-panel');
  panel.innerHTML = '';
  panel.innerHTML = `
    <div class="separator">
      <div class="balance-row fit-content-row" style="margin-bottom: 5px;">
        <small class="balance-column text-muted">股权</small>
        <small class="balance-column text-muted">未平仓损益</small>
        <small class="balance-column text-muted">总损益</small>
      </div>
      <div class="balance-row" style="margin-top: 10px;"><small>usd </small></div>
      <div class="balance-row">
        <div class="balance-column"><div>24,489.40</div></div>
        <div class="balance-column"><div>0.00</div></div>
        <div class="balance-column"><div>(251.00)</div></div>
      </div>
      <div class="risk-settings">
        <small>日止损点 $251</small>
        <small>周损失限额 $511</small>
      </div>
    </div>
  `;
});

const scan = await page.evaluate(() => new Promise(resolve => {
  window.__autoLockListeners[0]({ type: 'tradovate-auto-lock:scan-now' }, {}, resolve);
}));
const runtimeState = await page.evaluate(() => window.__stored['tradovateRuntimeState:LFE02567750200006']);
const autoState = await page.evaluate(() => window.__stored['tradovateAutoLockState:LFE02567750200006']);

await browser.close();

assert(scan.ok && Math.abs(Number(scan.pnl) + 251) < 0.01, 'three-column account panel text should parse total pnl as loss', { scan, runtimeState, autoState });
assert(/balance row total pnl/.test(scan.source), 'scan should use direct total pnl balance-row source instead of baseline', { scan, runtimeState });
assert(runtimeState && Math.abs(Number(runtimeState.lastPnl) + 251) < 0.01, 'runtime state should persist direct total pnl', { scan, runtimeState });

console.log(JSON.stringify({ scan, runtimeState, autoState }, null, 2));
