import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/jiangsai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, "..");
const mockPath = path.join(__dirname, "mock_click.html");
const contentPath = path.join(extensionDir, "content.js");

function assert(condition, message, payload = {}) {
  if (!condition) {
    console.error(JSON.stringify({ message, ...payload }, null, 2));
    process.exit(1);
  }
}

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

await page.goto(`file://${mockPath}`);
await page.evaluate(() => {
  window.__stored = {
    "autorobot1.draft": {
      id: "draft-1",
      name: "测试脚本",
      actions: []
    },
    "autorobot1.recording": false
  };
  window.__listeners = [];
  window.__storageListeners = [];
  window.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          window.__listeners.push(fn);
        }
      }
    },
    storage: {
      onChanged: {
        addListener(fn) {
          window.__storageListeners.push(fn);
        }
      },
      local: {
        get(keys, cb) {
          const out = {};
          for (const [key, value] of Object.entries(keys || {})) {
            out[key] = Object.prototype.hasOwnProperty.call(window.__stored, key)
              ? window.__stored[key]
              : value;
          }
          cb?.(out);
          return Promise.resolve(out);
        },
        set(items, cb) {
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = {
              oldValue: window.__stored[key],
              newValue: value
            };
            window.__stored[key] = value;
          }
          for (const listener of window.__storageListeners) listener(changes, "local");
          cb?.();
          return Promise.resolve();
        }
      }
    }
  };
});

await page.addScriptTag({ path: contentPath });

async function send(type, payload = {}) {
  return page.evaluate(({ type, payload }) => new Promise(resolve => {
    window.__listeners[0]({ type, ...payload }, {}, resolve);
  }), { type, payload });
}

const buttonBox = await page.locator("#target").boundingBox();
const clickPoint = {
  x: Math.round(buttonBox.x + buttonBox.width / 2),
  y: Math.round(buttonBox.y + buttonBox.height / 2)
};

const started = await send("AUTOROBOT1_START_RECORDING");
await page.mouse.click(clickPoint.x, clickPoint.y);
await page.waitForTimeout(140);
await page.mouse.click(clickPoint.x, clickPoint.y);
await page.waitForTimeout(140);
await page.evaluate(() => {
  window.dispatchEvent(new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    clientX: 80,
    clientY: 80,
    deltaY: 240
  }));
  window.scrollBy(0, 240);
});
await page.waitForTimeout(140);
await page.locator("#textTarget").click();
await page.keyboard.press("A");
const storedAfterRecord = await page.evaluate(() => ({
  draft: window.__stored["autorobot1.draft"],
  clickCount: window.clickCount,
  scrollY: window.scrollY,
  inputValue: document.getElementById("textTarget").value
}));
const stopped = await send("AUTOROBOT1_STOP_RECORDING");

assert(started.ok, "recording did not start", { started });
assert(stopped.ok, "recording did not stop", { stopped });
assert(storedAfterRecord.draft.actions.length >= 5, "recorded actions were not persisted", { storedAfterRecord });
assert(storedAfterRecord.clickCount === 2, "recording clicks should pass through to the page", { storedAfterRecord });
assert(storedAfterRecord.scrollY > 0, "recording scroll should pass through to the page", { storedAfterRecord });
assert(storedAfterRecord.inputValue === "A", "recording key should pass through to the page", { storedAfterRecord });
assert(storedAfterRecord.draft.actions[0].waitMs === 0, "first recorded action should not wait", { storedAfterRecord });
assert(storedAfterRecord.draft.actions[1].waitMs >= 80, "second recorded action should include pause time", { storedAfterRecord });
assert(storedAfterRecord.draft.actions.some(action => action.type === "scroll"), "scroll action was not recorded", { storedAfterRecord });
assert(storedAfterRecord.draft.actions.some(action => action.type === "key" && action.key === "A"), "keyboard action was not recorded", { storedAfterRecord });

const actions = storedAfterRecord.draft.actions;
await page.evaluate(() => {
  window.scrollTo(0, 0);
  document.getElementById("textTarget").value = "";
  document.activeElement?.blur?.();
});
const replay = await send("AUTOROBOT1_RUN_SCRIPT", { actions });
const replayState = await page.evaluate(() => ({
  clickCount: window.clickCount,
  scrollY: window.scrollY,
  inputValue: document.getElementById("textTarget").value,
  effectCount: document.querySelectorAll("[data-autorobot1='true']").length
}));

assert(replay.ok, "replay failed", { replay });
assert(replayState.clickCount >= 4, "replay did not click target button", { replayState, actions });
assert(replayState.scrollY > 0, "replay did not scroll page", { replayState, actions });
assert(replayState.inputValue.includes("A"), "replay did not type into input", { replayState, actions });
assert(replayState.effectCount >= 1, "replay did not create visible cursor/click effects", { replayState, actions });

const box = await page.locator("#scrollBox").boundingBox();
const boxScrollAction = {
  type: "scroll",
  x: Math.round(box.x + box.width / 2),
  y: Math.round(box.y + box.height / 2),
  deltaX: 0,
  deltaY: 180,
  waitMs: 0
};
const boxReplay = await send("AUTOROBOT1_RUN_SCRIPT", { actions: [boxScrollAction] });
const boxScrollTop = await page.evaluate(() => document.getElementById("scrollBox").scrollTop);

assert(boxReplay.ok, "inner scroll replay failed", { boxReplay, boxScrollAction });
assert(boxScrollTop > 0, "replay did not scroll inner container", { boxScrollTop, boxScrollAction });

await browser.close();

console.log(JSON.stringify({
  recordedActions: actions,
  replayState,
  boxScrollTop
}, null, 2));
