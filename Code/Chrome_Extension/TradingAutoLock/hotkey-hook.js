// TradingAutoLock hotkey-hook.js (MAIN world, document_start)
// 在页面脚本之前注入，最早捕获 keydown。用户配置"原快捷键 -> 新快捷键"映射，
// 按下新快捷键时拦截并合成派发原快捷键事件，让 Tradovate 执行对应下单动作。
(function () {
  const HOOK_FLAG = '__tradingAutoLockHotkeyHookInstalled';
  const CONFIG_TYPE = 'tradovate-auto-lock:hotkey-config';
  if (window[HOOK_FLAG]) return;
  window[HOOK_FLAG] = true;

  // 默认映射：buy/sell/close 三个动作
  const DEFAULT_MAP = {
    buy: { from: 'Ctrl+Command+Alt+1', to: '' },
    sell: { from: 'Ctrl+Command+Alt+2', to: '' },
    close: { from: 'Ctrl+Command+Alt+3', to: '' }
  };

  let hotkeyMap = DEFAULT_MAP;

  // ---- 按键文本格式化 / 解析 ----

  const SPECIAL_KEYS = {
    ' ': 'Space',
    space: 'Space',
    spacebar: 'Space',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    escape: 'Escape',
    esc: 'Escape',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    insert: 'Insert',
    f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
    f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12'
  };

  function keyNameFromEvent(e) {
    const k = e.key;
    if (!k || k === 'Dead' || k === 'Unidentified') return null;
    const lower = String(k).toLowerCase();
    if (lower === 'control' || lower === 'meta' || lower === 'alt' || lower === 'shift') return null; // 纯修饰键不算
    const mapped = SPECIAL_KEYS[lower];
    if (mapped) return mapped; // 空格/回车/方向键等特殊键优先统一命名（如 ' ' -> 'Space'）
    if (k.length === 1) return /[0-9]/.test(k) ? k : k.toUpperCase();
    return k;
  }

  function formatChord(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Command');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    const key = keyNameFromEvent(e);
    if (!key) return null;
    parts.push(key);
    return parts.join('+');
  }

  function parseChord(str) {
    const parts = String(str || '').split('+').map(s => s.trim()).filter(Boolean);
    const result = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: '', code: '', keyCode: 0 };
    const keys = [];
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') result.ctrlKey = true;
      else if (lower === 'cmd' || lower === 'command' || lower === 'meta') result.metaKey = true;
      else if (lower === 'alt' || lower === 'option') result.altKey = true;
      else if (lower === 'shift') result.shiftKey = true;
      else keys.push(p);
    }
    if (!keys.length) return null;
    const raw = keys.join('+');
    const lower = raw.toLowerCase();
    if (SPECIAL_KEYS[lower]) {
      result.key = SPECIAL_KEYS[lower];
    } else if (raw.length === 1) {
      result.key = /[0-9]/.test(raw) ? raw : raw.toUpperCase();
    } else {
      result.key = raw;
    }
    // 推导 code / keyCode
    const key = result.key;
    if (/^[0-9]$/.test(key)) { result.code = 'Digit' + key; result.keyCode = 48 + Number(key); }
    else if (/^[A-Z]$/.test(key)) { result.code = 'Key' + key; result.keyCode = 65 + key.charCodeAt(0) - 65; }
    else if (/^F([1-9]|1[0-2])$/.test(key)) { result.code = key; result.keyCode = 111 + Number(key.slice(1)); }
    else if (key === 'Space') { result.code = 'Space'; result.keyCode = 32; }
    else if (key === 'Enter') { result.code = 'Enter'; result.keyCode = 13; }
    else if (key === 'Tab') { result.code = 'Tab'; result.keyCode = 9; }
    else if (key === 'Escape') { result.code = 'Escape'; result.keyCode = 27; }
    else if (key === 'Backspace') { result.code = 'Backspace'; result.keyCode = 8; }
    else if (key === 'Delete') { result.code = 'Delete'; result.keyCode = 46; }
    else if (key === 'ArrowUp') { result.code = 'ArrowUp'; result.keyCode = 38; }
    else if (key === 'ArrowDown') { result.code = 'ArrowDown'; result.keyCode = 40; }
    else if (key === 'ArrowLeft') { result.code = 'ArrowLeft'; result.keyCode = 37; }
    else if (key === 'ArrowRight') { result.code = 'ArrowRight'; result.keyCode = 39; }
    else if (key === 'Home') { result.code = 'Home'; result.keyCode = 36; }
    else if (key === 'End') { result.code = 'End'; result.keyCode = 35; }
    else if (key === 'PageUp') { result.code = 'PageUp'; result.keyCode = 33; }
    else if (key === 'PageDown') { result.code = 'PageDown'; result.keyCode = 34; }
    else if (key === 'Insert') { result.code = 'Insert'; result.keyCode = 45; }
    return result;
  }

  function chordMatches(e, chordStr) {
    const parsed = parseChord(chordStr);
    if (!parsed) return false;
    return e.ctrlKey === parsed.ctrlKey &&
      e.metaKey === parsed.metaKey &&
      e.altKey === parsed.altKey &&
      e.shiftKey === parsed.shiftKey &&
      keyNameFromEvent(e) === parsed.key;
  }

  function buildSyntheticEvent(parsed, type) {
    return new KeyboardEvent(type, {
      key: parsed.key,
      code: parsed.code,
      keyCode: parsed.keyCode,
      which: parsed.keyCode,
      ctrlKey: parsed.ctrlKey,
      metaKey: parsed.metaKey,
      altKey: parsed.altKey,
      shiftKey: parsed.shiftKey,
      bubbles: true,
      cancelable: true,
      view: window
    });
  }

  // ---- 拦截 ----

  window.addEventListener('keydown', function (e) {
    if (e.__tdvHotkeySynthetic) return; // 自己派发的合成事件，不再拦截
    for (const action of ['buy', 'sell', 'close']) {
      const cfg = hotkeyMap[action];
      if (!cfg || !cfg.to) continue;
      if (chordMatches(e, cfg.to)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
        const parsed = parseChord(cfg.from);
        if (!parsed) break;
        const target = document.body || document.documentElement;
        if (!target) break;
        const ev = buildSyntheticEvent(parsed, 'keydown');
        ev.__tdvHotkeySynthetic = true;
        target.dispatchEvent(ev);
        const up = buildSyntheticEvent(parsed, 'keyup');
        up.__tdvHotkeySynthetic = true;
        target.dispatchEvent(up);
        break;
      }
    }
  }, true);

  // ---- 配置接收（来自 content.js 的 postMessage）----

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.source !== CONFIG_TYPE) return;
    const map = event.data.map;
    if (map && typeof map === 'object') {
      hotkeyMap = {
        buy: map.buy || DEFAULT_MAP.buy,
        sell: map.sell || DEFAULT_MAP.sell,
        close: map.close || DEFAULT_MAP.close
      };
    }
  });
})();
