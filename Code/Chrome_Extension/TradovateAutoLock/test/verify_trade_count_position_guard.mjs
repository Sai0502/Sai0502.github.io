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

const baseTradeStats = {
  dateKeyBeijing: '2026-07-17',
  tradeDayStartAtBeijing: '2026-07-17 06:00',
  tradeDayEndAtBeijing: '2026-07-18 06:00',
  fillCountToday: 9,
  tradeCountToday: 5,
  entryFillsToday: 5,
  flatToPositionEntriesToday: 5,
  completedTradesToday: 4,
  hasOpenPositionEstimate: true,
  openPositionCount: 1,
  netPositionAbsEstimate: 1,
  fillsByContract: [
    { accountId: 'LFE02567750200006', contractId: 'MESU6', fills: 9, netPosEstimate: 1 }
  ]
};

const scenarios = [
  {
    name: 'mixed global trade count does not lock current account below limit',
    tradeStats: {
      ...baseTradeStats,
      tradeCountToday: 1,
      flatToPositionEntriesToday: 1,
      completedTradesToday: 1,
      fillCountToday: 2
    },
    visiblePositionHtml: '<div data-visible-position>今日趋平 仓位:+ 0/- 0</div>',
    expectLocked: false,
    expectGuardSource: 'visible position element'
  },
  {
    name: 'position event flat alone does not lock without visible flat position',
    tradeStats: {
      ...baseTradeStats,
      hasPositionEventStatus: true,
      hasOpenPositionByPositionEvent: false,
      positionNetAbs: 0,
      positionsByContract: [
        { accountId: 'LFE02567750200006', contractId: 'MESU6', netPos: 0, absNetPos: 0 }
      ]
    },
    expectLocked: false,
    expectGuardSource: 'visible_position_unavailable'
  },
  {
    name: 'position event open is ignored by the lock guard when visible position is unavailable',
    tradeStats: {
      ...baseTradeStats,
      hasPositionEventStatus: true,
      hasOpenPositionByPositionEvent: true,
      positionNetAbs: 1,
      positionsByContract: [
        { accountId: 'LFE02567750200006', contractId: 'MESU6', netPos: 1, absNetPos: 1 }
      ]
    },
    expectLocked: false,
    expectGuardSource: 'visible_position_unavailable'
  },
  {
    name: 'visible flat position text allows trade count lock',
    tradeStats: {
      ...baseTradeStats,
      hasPositionEventStatus: false,
      hasOpenPositionByPositionEvent: false,
      positionNetAbs: 0,
      positionsByContract: []
    },
    visiblePositionHtml: '<div data-visible-position>今日趋平 仓位:+ 0/- 0</div>',
    expectLocked: true,
    expectGuardSource: 'visible position element'
  },
  {
    name: 'active account-scoped lock state blocks unsafe retry when page button stays manual',
    tradeStats: {
      ...baseTradeStats,
      tradeCountToday: 6,
      fillCountToday: 12,
      completedTradesToday: 6
    },
    visiblePositionHtml: '<div data-visible-position>今日趋平 仓位:+ 0/- 0</div>',
    initialAutoState: {
      status: 'locked',
      lockKey: 'LFE02567750200006:2026-07-17:trade_count',
      kind: 'trade_count',
      tradeEntryCount: 6,
      pnl: 0,
      lockedAt: Date.now() - 60000,
      lockExpiresAt: Date.now() + 15 * 60 * 1000
    },
    expectLocked: false,
    expectedSkip: 'trade count lock already active',
    expectGuardSource: 'visible position element'
  },
  {
    name: 'visible short position text blocks trade count lock',
    tradeStats: {
      ...baseTradeStats,
      tradeCountToday: 6,
      hasPositionEventStatus: true,
      hasOpenPositionByPositionEvent: true,
      positionNetAbs: 1,
      positionsByContract: [
        { accountId: 'LFE02567750200006', contractId: 'MESU6', netPos: -1, bought: 5, sold: 6, absNetPos: 1 }
      ]
    },
    visiblePositionHtml: '<div data-visible-position>今日趋平 仓位:+ 0/- 1</div>',
    expectLocked: false,
    expectGuardSource: 'visible position element'
  },
  {
    name: 'open pnl zero alone does not allow trade count lock',
    tradeStats: {
      ...baseTradeStats,
      hasPositionEventStatus: false,
      hasOpenPositionByPositionEvent: false,
      positionNetAbs: 0,
      positionsByContract: []
    },
    expectLocked: false,
    expectGuardSource: 'visible_position_unavailable'
  }
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});

async function runScenario(scenario) {
  const page = await browser.newPage({ viewport: { width: 1328, height: 900 } });
  await page.goto(`file://${mockPath}`);
  await page.evaluate(({ tradeStats, visiblePositionHtml, initialAutoState }) => {
    if (visiblePositionHtml) {
      const holder = document.createElement('div');
      holder.innerHTML = visiblePositionHtml;
      document.body.appendChild(holder);
    }
    window.__autoLockListeners = [];
    const monitorKey = 'tradovateMonitorSettings:LFE02567750200006';
    const autoStateKey = 'tradovateAutoLockState:LFE02567750200006';
    window.__stored = {
      [monitorKey]: {
        autoMonitorEnabled: true,
        autoLockEnabled: true,
        dailyLossLimit: 250,
        dailyProfitTarget: 550,
        scanIntervalSeconds: 60,
        lockDuration: 'end_of_day',
        tradeCountLockEnabled: true,
        dailyEntryLimit: 5
      },
      [autoStateKey]: initialAutoState || {},
      tradovateWsCapture: {
        accountMappings: [
          { id: '57435508', name: 'LFE02567750200006' }
        ],
        tradeStatsByAccount: {
          LFE02567750200006: {
            ...tradeStats,
            accountId: '57435508',
            accountName: 'LFE02567750200006',
            numericAccountId: '57435508',
            accountMatchedBy: 'account_name'
          }
        },
        tradeStats: {
          ...tradeStats,
          tradeCountToday: 999,
          note: 'global mixed diagnostic only; should not drive locking'
        }
      }
    };
    window.chrome = {
      runtime: {
        onMessage: {
          addListener(fn) {
            window.__autoLockListeners.push(fn);
          }
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
            return Promise.resolve();
          }
        }
      }
    };
  }, scenario);
  await page.addScriptTag({ path: contentPath });
  const scan = await page.evaluate(() => new Promise(resolve => {
    window.__autoLockListeners[0]({ type: 'tradovate-auto-lock:scan-now' }, {}, resolve);
  }));
  const state = await page.evaluate(() => ({
    modalOpen: document.body.classList.contains('modal-open'),
    confirmOpen: document.body.classList.contains('confirm-open'),
    autoState: window.__stored['tradovateAutoLockState:LFE02567750200006'],
    runtimeState: window.__stored['tradovateRuntimeState:LFE02567750200006']
  }));
  await page.close();
  return { scan, state };
}

for (const scenario of scenarios) {
  const result = await runScenario(scenario);
  if (scenario.expectLocked) {
    assert(result.scan.ok && ['locked', 'locking'].includes(result.state.autoState?.status), `${scenario.name}: expected lock attempt state`, result);
    assert(result.state.modalOpen || result.state.confirmOpen, `${scenario.name}: lock flow was not attempted`, result);
    assert(result.state.autoState?.kind === 'trade_count', `${scenario.name}: lock kind should be trade_count`, result);
  } else {
    assert(result.scan.ok && !result.scan.locked, `${scenario.name}: should not lock`, result);
    assert(!result.state.modalOpen && !result.state.confirmOpen, `${scenario.name}: modal should stay closed`, result);
    if (scenario.expectedSkip) {
      assert(result.scan.skipped === scenario.expectedSkip, `${scenario.name}: skip reason mismatch`, result);
    }
  }
  const guard = result.state.autoState?.tradePositionGuard || result.state.runtimeState?.lastTradePositionGuard || {};
  assert(guard.source === scenario.expectGuardSource, `${scenario.name}: guard source mismatch`, { guard, result });
}

await browser.close();

console.log(JSON.stringify({ ok: true, scenarios: scenarios.map(item => item.name) }, null, 2));
