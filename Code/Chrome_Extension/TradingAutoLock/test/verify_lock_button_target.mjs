import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '..');
const mockPath = path.join(__dirname, 'mock_tradovate_lock.html');
const contentPath = path.join(extensionDir, 'content.js');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});
const page = await browser.newPage({ viewport: { width: 1475, height: 1132 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__autoLockListeners = [];
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
          const out = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
          if (cb) cb(out);
          return Promise.resolve(out);
        },
        set(items, cb) {
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});
await page.addScriptTag({ path: contentPath });

const result = await page.evaluate(async () => {
  const listener = window.__autoLockListeners[0];
  const response = await new Promise(resolve => {
    listener({ type: 'tradovate-auto-lock:debug-locate-final' }, {}, resolve);
  });
  const expected = document.querySelector('[data-expected-lock-button]').getBoundingClientRect();
  const actual = document.getElementById('tradovate-auto-lock-highlight').getBoundingClientRect();
  const expectedCenter = {
    x: expected.left + expected.width / 2,
    y: expected.top + expected.height / 2
  };
  const actualCenter = {
    x: actual.left + actual.width / 2,
    y: actual.top + actual.height / 2
  };
  return {
    response,
    expected: {
      left: expected.left,
      top: expected.top,
      width: expected.width,
      height: expected.height
    },
    actual: {
      left: actual.left,
      top: actual.top,
      width: actual.width,
      height: actual.height
    },
    delta: {
      x: Math.round((actualCenter.x - expectedCenter.x) * 100) / 100,
      y: Math.round((actualCenter.y - expectedCenter.y) * 100) / 100
    }
  };
});

await browser.close();

if (!result.response?.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

if (Math.abs(result.delta.x) > 12 || Math.abs(result.delta.y) > 12) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
