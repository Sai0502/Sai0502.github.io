// TopstepLock content script: walk the Lockout Controls flow and stop before Confirm.
(() => {
  const SCRIPT_BUILD_LABEL = 'TradingAutoLock-TS v1009_2103';
  console.log('[TopstepLock] loaded', SCRIPT_BUILD_LABEL);

  const DEBUG_LOG = [];
  function debugLog(event, details) {
    const entry = { t: new Date().toISOString(), event, details: details || {} };
    DEBUG_LOG.push(entry);
    if (DEBUG_LOG.length > 200) DEBUG_LOG.shift();
    console.log('[TopstepLock]', event, details);
  }
  debugLog('content.loaded', { label: SCRIPT_BUILD_LABEL, url: location.href });

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function textOf(el) { return (el && (el.textContent || el.innerText) || '').trim(); }

  function findByText(re, root = document.body) {
    const all = root.querySelectorAll('button,a,[role="button"],div,span,li,h1,h2,h3,p');
    const matches = [];
    all.forEach(el => {
      if (!isVisible(el)) return;
      const t = textOf(el);
      if (re.test(t)) matches.push({ el, t });
    });
    matches.sort((a, b) => a.t.length - b.t.length);
    return matches.length ? matches[0].el : null;
  }

  function clickEl(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center' }); } catch (_) {}
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    debugLog('click', { tag: el.tagName, cls: (el.className||'').toString().slice(0,80), text: textOf(el).slice(0,40) });
    return true;
  }

  function pressEnter(el) {
    ['keydown', 'keypress', 'keyup'].forEach(type => {
      el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    });
  }

  function typeAndEnter(el, value) {
    try { el.focus({ preventScroll: true }); } catch (_) {}
    try {
      if (typeof el.select === 'function') el.select();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, value);
    } catch (_) { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    pressEnter(el);
    debugLog('typeAndEnter', { value });
  }

  async function waitFor(pred, timeoutMs = 8000, label = '') {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = pred();
      if (r) return r;
      await sleep(200);
    }
    throw new Error('timeout waiting for: ' + label);
  }

  // ---- flow steps ----

  async function clickGearIcon() {
    const candidates = Array.from(document.querySelectorAll('a,button,div,li,span,svg,[role="button"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return isVisible(el) && r.left >= 0 && r.left < 80 && r.width >= 15 && r.width <= 70 && r.height >= 20 && r.height <= 80;
      })
      .filter(el => el.querySelector('svg') || el.tagName === 'svg' || el.children.length === 0)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    debugLog('rail.elements', {
      count: candidates.length,
      list: candidates.map((el, i) => ({ i, tag: el.tagName, aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), y: Math.round(el.getBoundingClientRect().top) }))
    });

    const gear = candidates.find(el => /setting/i.test((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')));
    if (gear) {
      debugLog('gear.found', { aria: gear.getAttribute('aria-label'), tag: gear.tagName });
      clickEl(gear);
      return;
    }
    if (candidates.length >= 5) { debugLog('gear.fallback_index', { index: 4 }); clickEl(candidates[4]); }
    else if (candidates.length >= 1) clickEl(candidates[candidates.length - 1]);
    else throw new Error('左侧栏找不到齿轮，只找到 ' + candidates.length + ' 个候选');
  }

  async function clickLockTrading() {
    const el = await waitFor(() => findByText(/^\s*Lock Trading\s*$/i), 8000, 'Lock Trading row');
    clickEl(el);
  }

  async function openCustomTab() {
    await waitFor(() => findByText(/Lockout controls/i), 5000, 'Lockout controls modal');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const customEl = await waitFor(() => findByText(/^\s*CUSTOM\s*$/i), 3000, 'CUSTOM tab attempt ' + attempt);
      debugLog('custom_tab.click_attempt', { attempt, tag: customEl.tagName, text: textOf(customEl).slice(0,20) });
      clickEl(customEl);
      await sleep(1000);
      const untilLabel = Array.from(document.querySelectorAll('*'))
        .find(el => isVisible(el) && /Lockout until/i.test(textOf(el)));
      if (untilLabel) { debugLog('custom_tab.active', { attempt }); return; }
      debugLog('custom_tab.not_active', { attempt });
    }
    const tabs = Array.from(document.querySelectorAll('button,[role="tab"],div'))
      .filter(isVisible)
      .filter(el => /^\s*(15\s*MIN|30\s*MIN|1\s*HR|ALL\s*DAY|CUSTOM)\s*$/i.test(textOf(el)));
    const tabInfo = tabs.map(t => ({ text: textOf(t), bg: window.getComputedStyle(t).backgroundColor, cls: (t.className||'').toString().slice(0,100) }));
    debugLog('custom_tab.failed', { tabs: tabInfo });
    throw new Error('点了3次CUSTOM都没选中，当前tab: ' + JSON.stringify(tabInfo));
  }

  function periodOf(h) { return h >= 12 ? 'PM' : 'AM'; }
  function hour12Of(h) { const x = h % 12; return x === 0 ? 12 : x; }

  async function findTimeBoxes() {
    // CUSTOM 选中后，三个原生 <select> 在 "Lockout until" 下方
    const modalTitle = findByText(/Lockout controls/i);
    const modalRoot = modalTitle
      ? modalTitle.closest('div[class*="dialog"],[role="dialog"]') || modalTitle.parentElement
      : document.body;
    return Array.from(modalRoot.querySelectorAll('select'))
      .filter(el => isVisible(el))
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }

  async function fillTime(hour24, minute) {
    const hourStr = String(hour12Of(hour24)).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');
    const period = periodOf(hour24);
    await sleep(500);

    const boxes = await findTimeBoxes();
    debugLog('time_boxes', { count: boxes.length, values: boxes.map(b=>b.value) });
    if (boxes.length < 3) throw new Error('找不到3个<select>，只找到 ' + boxes.length);

    function setSelectValue(sel, value) {
      sel.value = value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      debugLog('select.set', { id: sel.id, value, result: sel.value });
    }

    setSelectValue(boxes[0], hourStr);
    await sleep(200);
    setSelectValue(boxes[1], minuteStr);
    await sleep(200);
    setSelectValue(boxes[2], period);
    await sleep(500);
    debugLog('time_filled', { hourStr, minuteStr, period });
  }

  async function selectAllAccounts() {
    const dd = await waitFor(() => findByText(/Select accounts/i), 5000, 'Select accounts dropdown');
    clickEl(dd);
    await sleep(500);
    const selectAll = await waitFor(() => findByText(/Select All/i), 3000, 'Select All option');
    clickEl(selectAll);
    await sleep(400);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    await sleep(300);
    debugLog('all_accounts_selected');
  }

  let lastError = null;
  async function run(targetHour, targetMinute) {
    debugLog('run.start', { targetHour, targetMinute, url: location.href });
    // 如果已经能看到 Lock Trading，说明已在设置页，跳过点齿轮
    const alreadyOnSettings = !!findByText(/Lock Trading/i);
    if (alreadyOnSettings) {
      debugLog('gear.skip', { reason: 'already on settings' });
    } else {
      await clickGearIcon(); await sleep(800);
    }
    await clickLockTrading();
    await openCustomTab();
    await fillTime(targetHour, targetMinute);
    await selectAllAccounts();
    await sleep(500);
    // 点 Confirm
    const confirmBtn = await waitFor(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(isVisible);
      return btns.find(b => /^\s*Confirm\s*$/i.test(textOf(b)) && !b.disabled);
    }, 3000, 'Confirm button');
    debugLog('confirm.click', { disabled: confirmBtn.disabled });
    clickEl(confirmBtn);
    await sleep(1000);
    // 第二个弹窗 "Are you sure?" → 点 I'M SURE
    const sureBtn = await waitFor(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(isVisible);
      return btns.find(b => /I'?M?\s*SURE/i.test(textOf(b)));
    }, 3000, 'I M SURE button');
    debugLog('sure.click');
    clickEl(sureBtn);
    await sleep(1000);
    debugLog('run.done_confirmed');
    return { ok: true, message: '已点击 Confirm + I\'m sure，锁定完成。' };
  }

  function buildDebugSummary() {
    const modal = findByText(/Lockout controls/i);
    let modalHTML = '(未找到 Lockout controls 弹窗)';
    if (modal) {
      const container = modal.closest('div[class*="modal"],div[class*="dialog"],div[role="dialog"]') || modal.parentElement;
      if (container) modalHTML = container.outerHTML.slice(0, 10000);
    }

    const allVisible = Array.from(document.querySelectorAll('button,[role="button"],[role="tab"],[role="combobox"],input,select'))
      .filter(isVisible)
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 30 && r.height > 20; })
      .slice(0, 200)
      .map(el => {
        const r = el.getBoundingClientRect();
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0, 100);
        return `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] <${el.tagName.toLowerCase()}${el.getAttribute('role') ? ' role='+el.getAttribute('role') : ''}> "${textOf(el).slice(0,50)}" class="${cls}"`;
      });

    const allInputs = Array.from(document.querySelectorAll('input')).filter(isVisible)
      .map(i => {
        const r = i.getBoundingClientRect();
        return `[${Math.round(r.left)},${Math.round(r.top)}] value="${i.value}" placeholder="${i.placeholder}" aria="${i.getAttribute('aria-label')}" type="${i.type}" readonly=${i.readOnly} disabled=${i.disabled}`;
      });

    const railBtns = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return isVisible(el) && r.left < 80 && r.width >= 15 && r.width <= 70 && r.height >= 20 && r.height <= 80;
      })
      .filter(el => el.querySelector('svg') || el.tagName === 'svg')
      .sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((el,i) => {
        const r = el.getBoundingClientRect();
        return `#${i} [${Math.round(r.left)},${Math.round(r.top)}] <${el.tagName.toLowerCase()}> aria="${el.getAttribute('aria-label')}" title="${el.getAttribute('title')}"`;
      });

    const tabs = Array.from(document.querySelectorAll('button,[role="tab"],div'))
      .filter(isVisible)
      .filter(el => /^\s*(15\s*MIN|30\s*MIN|1\s*HR|ALL\s*DAY|CUSTOM)\s*$/i.test(textOf(el)));
    const tabInfo = tabs.map(t => {
      const cls = (t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className || '').toString();
      const bg = window.getComputedStyle(t).backgroundColor;
      return `"${textOf(t)}" class="${cls.slice(0,100)}" bg=${bg}`;
    });

    const summary = [
      '# TopstepLock Debug Summary',
      '',
      '## Environment',
      `版本: ${SCRIPT_BUILD_LABEL}`,
      `URL: ${location.href}`,
      `时间: ${new Date().toISOString()}`,
      `视口: ${window.innerWidth}x${window.innerHeight}`,
      '',
      '## Last Error',
      lastError ? lastError : '(无)',
      '',
      '## Debug Log (完整)',
      ...DEBUG_LOG.map(e => `- ${e.t} ${e.event} ${JSON.stringify(e.details).slice(0,500)}`),
      '',
      '## 当前 Tab 状态',
      ...tabInfo,
      '',
      '## Lockout 弹窗 HTML (前10000字符)',
      modalHTML,
      '',
      '## 所有可见 Input',
      ...allInputs,
      '',
      '## 左侧栏按钮',
      ...railBtns,
      '',
      '## 所有可见可交互元素 (前200个)',
      ...allVisible,
    ].join('\n');
    return summary;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'topstep-lock:debug') {
      sendResponse({ ok: true, summary: buildDebugSummary() });
      return true;
    }
    if (msg.type === 'topstep-lock:execute') {
      const t = msg.targetTime || '21:00';
      const [h, m] = t.split(':').map(Number);
      run(h, m)
        .then(r => sendResponse(r))
        .catch(err => {
          lastError = err.message || String(err);
          debugLog('run.error', { error: lastError });
          sendResponse({ ok: false, error: lastError, debugSummary: buildDebugSummary() });
        });
      return true;
    }
  });
})();
