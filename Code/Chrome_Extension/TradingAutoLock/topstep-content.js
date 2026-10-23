// TopstepLock content script: walk the Lockout Controls flow and stop before Confirm.
(() => {
  const SCRIPT_BUILD_LABEL = 'TradingAutoLock-TS v1014_1220';
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
  // ---- 白天交易提醒弹窗（当地时间 6:00-21:00，每次打开页面弹出）----
  const DAYTIME_OVERLAY_ID = 'trading-autolock-daytime-overlay';
  let daytimeReminderClosedByUser = false;
  function showDaytimeReminder(force) {
    const h = new Date().getHours();
    if (h < 6 || h >= 21) return; // 仅本地时间 6:00-20:59 触发
    if (daytimeReminderClosedByUser && !force) return;
    if (document.getElementById(DAYTIME_OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = DAYTIME_OVERLAY_ID;
    overlay.innerHTML = [
      '<div class="daytime-reminder-card" role="dialog" aria-live="assertive">',
      '  <button class="daytime-reminder-close" type="button" aria-label="关闭">×</button>',
      '  <div class="daytime-reminder-title">白天不要做单</div>',
      '  <div class="daytime-reminder-line"></div>',
      '  <div class="daytime-reminder-body">',
      '    <div class="daytime-reminder-row"><span class="daytime-reminder-key">白天忍不住的根因：</span><span class="daytime-reminder-val">昨天亏了</span></div>',
      '    <div class="daytime-reminder-row"><span class="daytime-reminder-key">白天不能做的根因：</span><span class="daytime-reminder-val">数据统计显示，白天做单刹不住车，80% 都是亏的</span></div>',
      '    <div class="daytime-reminder-row"><span class="daytime-reminder-key">明知会亏还要做的根因：</span><span class="daytime-reminder-val">情绪，马上回本的焦虑情绪</span></div>',
      '  </div>',
      '</div>'
    ].join('');
    overlay.style.cssText = [
      'position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center;',
      'padding: 5vh 4vw; background: rgba(0, 0, 0, 0.72);',
      'color: #eef3f8; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;'
    ].join(' ');
    const style = document.createElement('style');
    style.textContent = `
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-card {
        box-sizing: border-box; position: relative;
        width: min(92vw, 1320px);
        display: grid; align-content: center; gap: clamp(27px, 3.9vh, 48px);
        padding: clamp(42px, 7.5vw, 84px);
        border: 1px solid rgba(125, 151, 184, 0.55);
        border-radius: 27px; background: #101821;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        text-align: center;
      }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-title {
        color: #ff4d57; font-size: clamp(39px, 5.25vw, 66px);
        line-height: 1.15; font-weight: 900;
      }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-line { height: 1px; background: rgba(126, 151, 183, 0.65); }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-body {
        display: flex; flex-direction: column; gap: clamp(15px, 2.4vh, 24px);
        text-align: left;
      }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-row {
        font-size: clamp(23px, 2.9vw, 32px); line-height: 1.55; color: #d6dde8;
      }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-key { color: #f0b429; font-weight: 700; }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-close {
        position: absolute; top: 24px; right: 27px; width: 57px; height: 57px;
        border: 1px solid rgba(150, 167, 188, 0.45); border-radius: 999px;
        background: rgba(255, 255, 255, 0.04); color: #b8c2d0;
        cursor: pointer; font-size: 36px; line-height: 1;
      }
      #${DAYTIME_OVERLAY_ID} .daytime-reminder-close:hover { color: #ffffff; border-color: rgba(255, 255, 255, 0.72); }
    `;
    overlay.appendChild(style);
    document.documentElement.appendChild(overlay);
    overlay.querySelector('.daytime-reminder-close')?.addEventListener('click', () => { daytimeReminderClosedByUser = true; overlay.remove(); });
    debugLog('daytime_reminder.shown', { hour: h });
  }
  function armDaytimeReminder() {
    const run = () => {
      showDaytimeReminder();
      // SPA 跳转可能清掉弹窗 DOM：1.2s 后若弹窗丢失且用户未关闭，补弹一次
      setTimeout(() => {
        if (!document.getElementById(DAYTIME_OVERLAY_ID)) showDaytimeReminder(true);
      }, 1200);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }
  armDaytimeReminder();
})();
