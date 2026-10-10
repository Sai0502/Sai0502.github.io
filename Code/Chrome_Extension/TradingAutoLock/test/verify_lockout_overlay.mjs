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

await page.addInitScript(() => {
  window.__autoLockListeners = [];
  const readStore = () => {
    try {
      return JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}');
    } catch {
      return {};
    }
  };
  const writeStore = store => {
    window.localStorage.setItem('__mockChromeStorage', JSON.stringify(store));
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
          const store = readStore();
          if (typeof keys === 'object' && !Array.isArray(keys)) {
            const out = {};
            for (const [key, value] of Object.entries(keys)) out[key] = store[key] ?? value;
            cb?.(out);
            return Promise.resolve(out);
          }
          cb?.({});
          return Promise.resolve({});
        },
        set(items, cb) {
          writeStore({ ...readStore(), ...items });
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});

async function loadMockPage() {
  await page.goto(`file://${mockPath}`);
  await page.evaluate(() => {
    window.__autoLockListeners = [];
  });
  await page.addScriptTag({ path: contentPath });
}

async function send(type, payload = {}) {
  return page.evaluate(({ type, payload }) => new Promise(resolve => {
    window.__autoLockListeners[0]({ type, ...payload }, {}, resolve);
  }), { type, payload });
}

await page.goto(`file://${mockPath}`);
await page.evaluate(() => window.localStorage.removeItem('__mockChromeStorage'));
await loadMockPage();
await page.evaluate(() => {
  const store = JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}');
  store.lockDuration = '15m';
  window.localStorage.setItem('__mockChromeStorage', JSON.stringify(store));
});

const lock = await send('tradovate-auto-lock:execute-real-lockout');
assert(lock.ok && lock.done, 'real lockout did not complete', { lock });
assert(lock.lockDuration === '15m', 'lock duration should be 15m', { lock });

const overlayAfterLock = await page.evaluate(() => ({
  exists: Boolean(document.getElementById('tradovate-auto-lockout-overlay')),
  title: document.querySelector('#tradovate-auto-lockout-overlay .tradovate-lockout-title')?.textContent || '',
  timer: document.getElementById('tradovate-auto-lockout-timer')?.textContent || '',
  state: JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}').tradovateLockoutOverlayState
}));
assert(overlayAfterLock.exists, 'overlay should appear after lockout', { overlayAfterLock });
assert(/熔断才是保命之道/.test(overlayAfterLock.title), 'overlay title mismatch', { overlayAfterLock });
assert(/^\d{1,2}:\d{2}(?::\d{2})?$/.test(overlayAfterLock.timer), 'overlay timer format mismatch', { overlayAfterLock });
assert(overlayAfterLock.state?.dismissed === false, 'overlay should not be dismissed after new lock', { overlayAfterLock });

await page.evaluate(() => document.getElementById('tradovate-auto-lockout-close')?.click());
const overlayAfterClose = await page.evaluate(() => ({
  exists: Boolean(document.getElementById('tradovate-auto-lockout-overlay')),
  state: JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}').tradovateLockoutOverlayState
}));
assert(!overlayAfterClose.exists, 'overlay should be removed after user closes it', { overlayAfterClose });
assert(overlayAfterClose.state?.dismissed === false, 'closing overlay should not dismiss this lock cycle in storage', { overlayAfterClose });

await loadMockPage();
await page.waitForTimeout(300);
const overlayAfterReloadClosed = await page.evaluate(() => Boolean(document.getElementById('tradovate-auto-lockout-overlay')));
assert(overlayAfterReloadClosed, 'closed overlay should reappear after reload while lock is active', { overlayAfterReloadClosed });

await page.evaluate(() => {
  document.getElementById('tradovate-auto-lockout-overlay')?.remove();
  const store = JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}');
  store.tradovateLockoutOverlayState = {
    ...store.tradovateLockoutOverlayState,
    active: true,
    dismissed: true,
    expiresAt: Date.now() + 15 * 60 * 1000
  };
  window.localStorage.setItem('__mockChromeStorage', JSON.stringify(store));
});
await loadMockPage();
await page.waitForTimeout(300);
const overlayAfterReloadOldDismissed = await page.evaluate(() => Boolean(document.getElementById('tradovate-auto-lockout-overlay')));
assert(overlayAfterReloadOldDismissed, 'old dismissed=true state should not block overlay reload', { overlayAfterReloadOldDismissed });

await page.evaluate(() => {
  const store = JSON.parse(window.localStorage.getItem('__mockChromeStorage') || '{}');
  store.tradovateLockoutOverlayState = {
    ...store.tradovateLockoutOverlayState,
    active: true,
    dismissed: false,
    expiresAt: Date.now() + 15 * 60 * 1000
  };
  window.localStorage.setItem('__mockChromeStorage', JSON.stringify(store));
});
await loadMockPage();
await page.waitForTimeout(300);
const overlayAfterReloadActive = await page.evaluate(() => ({
  exists: Boolean(document.getElementById('tradovate-auto-lockout-overlay')),
  title: document.querySelector('#tradovate-auto-lockout-overlay .tradovate-lockout-title')?.textContent || ''
}));
assert(overlayAfterReloadActive.exists, 'active non-dismissed overlay should reappear after reload', { overlayAfterReloadActive });

await browser.close();

console.log(JSON.stringify({
  lock,
  overlayAfterLock,
  overlayAfterClose,
  overlayAfterReloadClosed,
  overlayAfterReloadOldDismissed,
  overlayAfterReloadActive
}, null, 2));
