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
  window.__clipboardText = '';
  window.__stored = {
    [runtimeKey]: {
      lastPnl: -251,
      lastPnlSource: 'tradovate balance row total pnl',
      nextScanAt: Date.now() + 30000,
      lastCalendarCandidates: [{ pnl: -251, text: '总损益 => (251.00); source tradovate balance row total pnl' }]
    }
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText(text) {
        window.__clipboardText = text;
        return Promise.resolve();
      }
    },
    configurable: true
  });
  window.chrome = {
    runtime: {
      id: 'mock-extension-id',
      getManifest() {
        return {
          name: 'TradovateAutoLock',
          version: '0.1.0',
          permissions: ['activeTab', 'storage'],
          host_permissions: ['https://trader.tradovate.com/*']
        };
      }
    },
    permissions: {
      getAll(cb) {
        cb({ permissions: ['activeTab', 'storage'], origins: ['https://trader.tradovate.com/*'] });
      }
    },
    tabs: {
      query(_query, cb) {
        const tabs = [{ id: 1, url: 'https://trader.tradovate.com/?token=secret#hidden', title: 'Tradovate - Default', status: 'complete' }];
        cb?.(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage(_tabId, message) {
        if (message.type === 'tradovate-auto-lock:debug-snapshot') {
          return Promise.resolve({ ok: true, accountIdGuess: 'default', pageIndicatesLocked: true });
        }
        if (message.type === 'tradovate-auto-lock:diagnostic-bundle') {
          return Promise.resolve({
            copiedAt: new Date().toISOString(),
            page: { url: 'https://trader.tradovate.com/?token=secret#hidden', title: 'Tradovate - Default', readyState: 'complete' },
            build: { scriptBuild: 'Tradovate PL Auto Lock test', scriptVersion: 'test-v1' },
            accountId: 'LFE02567750200007',
            browserEnvironment: {
              navigator: { userAgent: 'Mock Chrome', platform: 'macOS' },
              time: { beijing: '2026-07-01 10:00:00' }
            },
            permissions: {
              notificationPermission: 'granted',
              queried: [{ name: 'notifications', state: 'granted' }]
            },
            featureDetection: {
              chromeRuntime: true,
              chromeStorage: true,
              extensionContextValid: true,
              notification: true,
              permissionsApi: true,
              clipboardApi: true
            },
            performance: {
              recentResources: [
                { name: { origin: 'https://trader.tradovate.com', pathname: '/api/example' }, initiatorType: 'fetch', duration: 12, responseStatus: 200 }
              ]
            },
            pnlExtraction: { pnl: -251, equity: 24489.4, source: 'tradovate balance row total pnl', text: '总损益 (251.00)' },
            domDiagnostics: { totalPnlTextWindow: '股权 未平仓损益 总损益 24,489.40 0.00 (251.00)' },
            runtimeDiagnosticEvents: [{ time: '2026-07-01T02:00:00Z', type: 'debugLog', details: { event: 'monitor.scan' } }],
            debugSnapshot: {
              pageIndicatesLocked: true,
              lockButtonState: { text: '锁定 18 小时', remainingMs: 64800000 },
              manualLockButtonFound: true
            },
            storage: {
              monitorSettings: { dailyLossLimit: 250, dailyProfitTarget: 550, scanIntervalSeconds: 10, lockDuration: 'end_of_day' },
              runtimeState: {
                lastPnl: -251,
                lastEquity: 24489.4,
                lastPnlSource: 'tradovate balance row total pnl',
                lastCalendarCandidates: [{ pnl: -251, text: '总损益 => (251.00)' }]
              },
              autoState: { status: 'locked', pnl: -251 },
              debugLogTail: [
                { ts: '2026-07-01T02:00:00Z', event: 'monitor.scan', details: { pnl: -251 } },
                { ts: '2026-07-01T02:00:01Z', event: 'lock_setting_prompt.skip', details: { reason: 'account_locked' } }
              ]
            }
          });
        }
        return Promise.resolve({ ok: true });
      }
    },
    scripting: { executeScript() { return Promise.resolve(); } },
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

const initial = await page.evaluate(() => ({
  detailsOpen: document.getElementById('diagnosticDetails').open,
  hasSummary: Boolean(document.getElementById('copySummary')),
  hasDetailed: Boolean(document.getElementById('copyDetailed')),
  hasRaw: Boolean(document.getElementById('copyRaw')),
  preview: document.getElementById('diagnosticPreview').textContent
}));
assert(!initial.detailsOpen, 'diagnostic details should be folded by default', { initial });
assert(initial.hasSummary && initial.hasDetailed && initial.hasRaw, 'diagnostic layer buttons should exist', { initial });

await page.click('#copySummary');
await page.waitForTimeout(250);
const summaryText = await page.evaluate(() => window.__clipboardText);
assert(summaryText.includes('# TradovateAutoLock AI Debug Summary'), 'summary should copy markdown summary', { summaryText });
assert(summaryText.includes('## What Codex Should Look At First'), 'summary should include AI prioritization section', { summaryText });
assert(summaryText.includes('?query=present') && summaryText.includes('#hash=present'), 'summary should sanitize URL query/hash', { summaryText });
assert(!summaryText.includes('"domDiagnostics"'), 'summary should not include full raw JSON sections by default', { summaryText });

await page.click('#diagnosticDetails summary');
await page.waitForTimeout(500);
const opened = await page.evaluate(() => ({
  open: document.getElementById('diagnosticDetails').open,
  preview: document.getElementById('diagnosticPreview').textContent
}));
assert(opened.open && opened.preview.includes('# TradovateAutoLock AI Debug Summary'), 'opening details should generate summary preview', { opened });

await page.click('#copyDetailed');
await page.waitForTimeout(250);
const detailedText = await page.evaluate(() => window.__clipboardText);
assert(detailedText.includes('# TradovateAutoLock AI Debug Detailed'), 'detailed should copy detailed markdown', { detailedText });
assert(detailedText.includes('"domDiagnostics"'), 'detailed should include DOM diagnostics', { detailedText });

await browser.close();

console.log(JSON.stringify({
  initial,
  summaryLength: summaryText.length,
  detailedLength: detailedText.length
}, null, 2));
