(() => {
  const VERSION = "autorobot-content-v6";
  if (window.__autoRobot1ContentLoaded === VERSION) return;
  window.__autoRobot1ContentLoaded = VERSION;

  const STORAGE = {
    draft: "autorobot1.draft",
    recording: "autorobot1.recording"
  };

  const state = {
    recording: false,
    overlay: null,
    cursor: null,
    lastRecordedAt: 0,
    lastScrollRecordedAt: 0,
    robotCursor: null,
    robotPosition: null
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "AUTOROBOT1_START_RECORDING") {
      startRecording();
      sendResponse?.({ ok: true });
      return true;
    }

    if (message?.type === "AUTOROBOT1_STOP_RECORDING") {
      stopRecording();
      sendResponse?.({ ok: true });
      return true;
    }

    if (message?.type === "AUTOROBOT1_RUN_SCRIPT") {
      runActions(message.actions || [])
        .then(() => sendResponse?.({ ok: true }))
        .catch(error => sendResponse?.({ ok: false, error: error.message || String(error) }));
      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE.recording]) return;
    if (changes[STORAGE.recording].newValue) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  restoreRecordingState();

  async function restoreRecordingState() {
    const data = await chrome.storage.local.get({ [STORAGE.recording]: false });
    if (data[STORAGE.recording]) startRecording();
  }

  function startRecording() {
    if (state.recording) return;
    state.recording = true;
    state.lastRecordedAt = 0;
    createOverlay();
    window.addEventListener("click", captureLeftClick, true);
    window.addEventListener("contextmenu", captureRightClick, true);
    window.addEventListener("wheel", captureWheel, true);
    window.addEventListener("keydown", captureKeyDown, true);
    window.addEventListener("mousemove", moveCursor, true);
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;
    window.removeEventListener("click", captureLeftClick, true);
    window.removeEventListener("contextmenu", captureRightClick, true);
    window.removeEventListener("wheel", captureWheel, true);
    window.removeEventListener("keydown", captureKeyDown, true);
    window.removeEventListener("mousemove", moveCursor, true);
    removeOverlay();
  }

  function captureLeftClick(event) {
    recordPointer(event, "left");
  }

  function captureRightClick(event) {
    recordPointer(event, "right");
  }

  function captureWheel(event) {
    recordWheel(event);
  }

  function captureKeyDown(event) {
    recordKey(event);
  }

  async function recordPointer(event, button) {
    if (!state.recording) return;
    if (isAutoRobotElement(event.target)) return;

    const now = Date.now();

    const action = {
      id: crypto.randomUUID(),
      type: "click",
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      button,
      clicks: 1,
      offsetX: 0,
      offsetY: 0,
      waitMs: nextWaitMs(now),
      createdAt: Date.now()
    };

    const data = await chrome.storage.local.get({ [STORAGE.draft]: null });
    const draft = data[STORAGE.draft];
    if (!draft) return;
    draft.actions = Array.isArray(draft.actions) ? draft.actions : [];
    draft.actions.push(action);
    draft.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE.draft]: draft });
    pulse(action.x, action.y, button);
  }

  async function recordWheel(event) {
    if (!state.recording) return;
    if (isAutoRobotElement(event.target)) return;

    const now = Date.now();
    if (state.lastScrollRecordedAt && now - state.lastScrollRecordedAt < 80) return;
    state.lastScrollRecordedAt = now;

    await appendRecordedAction({
      id: crypto.randomUUID(),
      type: "scroll",
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      deltaX: Math.round(event.deltaX || 0),
      deltaY: Math.round(event.deltaY || 0),
      waitMs: nextWaitMs(),
      createdAt: now
    });
    scrollEffect(event.clientX, event.clientY, event.deltaY || 0);
  }

  async function recordKey(event) {
    if (!state.recording) return;
    if (isAutoRobotElement(event.target)) return;

    const now = Date.now();
    await appendRecordedAction({
      id: crypto.randomUUID(),
      type: "key",
      key: event.key,
      code: event.code,
      keyCode: event.keyCode || event.which || 0,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      waitMs: nextWaitMs(now),
      createdAt: now
    });
    keyEffect(event.key);
  }

  function nextWaitMs(now = Date.now()) {
    const waitMs = state.lastRecordedAt ? Math.max(0, now - state.lastRecordedAt) : 0;
    state.lastRecordedAt = now;
    return waitMs;
  }

  async function appendRecordedAction(action) {
    const data = await chrome.storage.local.get({ [STORAGE.draft]: null });
    const draft = data[STORAGE.draft];
    if (!draft) return;
    draft.actions = Array.isArray(draft.actions) ? draft.actions : [];
    draft.actions.push(action);
    draft.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE.draft]: draft });
  }

  async function runActions(actions) {
    stopRecording();

    for (const action of actions) {
      const type = action.type || "click";
      const waitMs = Math.max(0, Number(action.waitMs || 0));

      if (waitMs) await wait(waitMs);

      if (type === "scroll") {
        await runScrollAction(action);
        continue;
      }

      if (type === "key") {
        await runKeyAction(action);
        continue;
      }

      const x = Number(action.x || 0) + Number(action.offsetX || 0);
      const y = Number(action.y || 0) + Number(action.offsetY || 0);
      const clicks = Math.max(1, Number(action.clicks || 1));
      const button = action.button === "right" ? "right" : "left";

      for (let index = 0; index < clicks; index += 1) {
        await moveRobotCursorTo(x, y);
        simulateClick(x, y, button);
        clickEffect(x, y, button);
        await wait(160);
      }
      await wait(60);
    }
    await wait(220);
    removeRobotCursor();
  }

  async function runScrollAction(action) {
    const x = Number.isFinite(Number(action.x)) ? Number(action.x) : window.innerWidth / 2;
    const y = Number.isFinite(Number(action.y)) ? Number(action.y) : window.innerHeight / 2;
    const deltaX = Number(action.deltaX || 0);
    const deltaY = Number(action.deltaY || 0);
    await moveRobotCursorTo(x, y);
    scrollAtPoint(x, y, deltaX, deltaY);
    scrollEffect(x, y, deltaY);
    await wait(120);
  }

  async function runKeyAction(action) {
    const target = activeEditableElement() || document.activeElement || document.body;
    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: action.key || "",
      code: action.code || "",
      keyCode: Number(action.keyCode || 0),
      which: Number(action.keyCode || 0),
      ctrlKey: Boolean(action.ctrlKey),
      altKey: Boolean(action.altKey),
      shiftKey: Boolean(action.shiftKey),
      metaKey: Boolean(action.metaKey)
    };

    target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    applyTextInput(target, action);
    target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    keyEffect(action.key || action.code || "Key");
    await wait(100);
  }

  function activeEditableElement() {
    const el = document.activeElement;
    if (!el) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || el.isContentEditable) return el;
    return null;
  }

  function applyTextInput(target, action) {
    if (!target || action.ctrlKey || action.altKey || action.metaKey) return;
    const key = action.key || "";
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    const isTextControl = tag === "input" || tag === "textarea";

    if (isTextControl && key.length === 1) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.value = `${target.value.slice(0, start)}${key}${target.value.slice(end)}`;
      target.selectionStart = target.selectionEnd = start + key.length;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: key }));
      return;
    }

    if (isTextControl && key === "Backspace") {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      if (start !== end) {
        target.value = `${target.value.slice(0, start)}${target.value.slice(end)}`;
        target.selectionStart = target.selectionEnd = start;
      } else if (start > 0) {
        target.value = `${target.value.slice(0, start - 1)}${target.value.slice(end)}`;
        target.selectionStart = target.selectionEnd = start - 1;
      }
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    }
  }

  function simulateClick(x, y, button) {
    const target = document.elementFromPoint(x, y);
    if (!target) return;

    const buttonCode = button === "right" ? 2 : 0;
    const buttons = button === "right" ? 2 : 1;
    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: buttonCode,
      buttons
    };
    const pointerInit = {
      ...eventInit,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };

    target.dispatchEvent(new PointerEvent("pointerover", pointerInit));
    target.dispatchEvent(new MouseEvent("mouseover", eventInit));
    target.dispatchEvent(new PointerEvent("pointermove", pointerInit));
    target.dispatchEvent(new MouseEvent("mousemove", eventInit));
    target.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
    target.dispatchEvent(new MouseEvent("mousedown", eventInit));
    if (button !== "right") focusAfterSyntheticClick(target);

    if (button === "right") {
      target.dispatchEvent(new MouseEvent("contextmenu", eventInit));
      target.dispatchEvent(new PointerEvent("pointerup", { ...pointerInit, buttons: 0 }));
      target.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
      return;
    }

    target.dispatchEvent(new PointerEvent("pointerup", { ...pointerInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("click", { ...eventInit, buttons: 0 }));
    if (button !== "right") focusAfterSyntheticClick(target);
  }

  function focusAfterSyntheticClick(target) {
    const focusTarget = target.closest?.(
      "input, textarea, select, button, a[href], [contenteditable='true'], [tabindex]"
    ) || target;
    if (typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function scrollAtPoint(x, y, deltaX, deltaY) {
    const target = document.elementFromPoint(x, y) || document.scrollingElement || document.documentElement;
    const wheelTarget = target === document.documentElement ? window : target;
    wheelTarget.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      deltaX,
      deltaY
    }));

    const scroller = scrollableAncestor(target);
    if (scroller === window) {
      window.scrollBy({ left: deltaX, top: deltaY, behavior: "instant" });
    } else {
      scroller.scrollBy({ left: deltaX, top: deltaY, behavior: "instant" });
    }
  }

  function scrollableAncestor(start) {
    let el = start && start.nodeType === Node.ELEMENT_NODE ? start : null;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const canScrollY = el.scrollHeight > el.clientHeight && /(auto|scroll|overlay)/i.test(style.overflowY);
      const canScrollX = el.scrollWidth > el.clientWidth && /(auto|scroll|overlay)/i.test(style.overflowX);
      if (canScrollY || canScrollX) return el;
      el = el.parentElement;
    }
    return window;
  }

  function createOverlay() {
    removeOverlay();

    state.overlay = document.createElement("div");
    state.overlay.dataset.autorobot1 = "true";
    state.overlay.textContent = "AutoRobot1 录制中：左键/右键点击页面记录动作";
    Object.assign(state.overlay.style, {
      position: "fixed",
      left: "12px",
      top: "12px",
      zIndex: "2147483647",
      padding: "8px 10px",
      borderRadius: "6px",
      background: "#111827",
      color: "#fff",
      font: "12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      boxShadow: "0 6px 20px rgba(0,0,0,.22)",
      pointerEvents: "none"
    });

    state.cursor = document.createElement("div");
    state.cursor.dataset.autorobot1 = "true";
    Object.assign(state.cursor.style, {
      position: "fixed",
      width: "14px",
      height: "14px",
      marginLeft: "-7px",
      marginTop: "-7px",
      borderRadius: "50%",
      border: "2px solid #1264d8",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-100px, -100px)"
    });

    document.documentElement.append(state.overlay, state.cursor);
  }

  function removeOverlay() {
    state.overlay?.remove();
    state.cursor?.remove();
    state.overlay = null;
    state.cursor = null;
  }

  function moveCursor(event) {
    if (!state.cursor) return;
    state.cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  }

  function pulse(x, y, button) {
    const marker = document.createElement("div");
    marker.dataset.autorobot1 = "true";
    Object.assign(marker.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: "22px",
      height: "22px",
      marginLeft: "-11px",
      marginTop: "-11px",
      borderRadius: "50%",
      border: `2px solid ${button === "right" ? "#c43d32" : "#1264d8"}`,
      background: button === "right" ? "rgba(196,61,50,.14)" : "rgba(18,100,216,.14)",
      zIndex: "2147483647",
      pointerEvents: "none",
      transition: "opacity .35s ease, transform .35s ease",
      transform: "scale(1)"
    });
    document.documentElement.append(marker);
    requestAnimationFrame(() => {
      marker.style.opacity = "0";
      marker.style.transform = "scale(1.8)";
    });
    setTimeout(() => marker.remove(), 420);
  }

  async function moveRobotCursorTo(x, y) {
    ensureRobotCursor();
    const from = state.robotPosition || { x, y };
    const distance = Math.hypot(x - from.x, y - from.y);
    const duration = Math.max(160, Math.min(650, distance * 1.2));
    const started = performance.now();

    return new Promise(resolve => {
      function frame(now) {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentX = from.x + (x - from.x) * eased;
        const currentY = from.y + (y - from.y) * eased;
        setRobotCursorPosition(currentX, currentY);
        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          state.robotPosition = { x, y };
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function ensureRobotCursor() {
    if (state.robotCursor) return;
    state.robotCursor = document.createElement("div");
    state.robotCursor.dataset.autorobot1 = "true";
    Object.assign(state.robotCursor.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "18px",
      height: "18px",
      marginLeft: "-9px",
      marginTop: "-9px",
      borderRadius: "999px",
      border: "3px solid #ffcc4d",
      background: "rgba(18, 100, 216, 0.72)",
      boxShadow: "0 0 0 5px rgba(18,100,216,.16), 0 0 24px rgba(18,100,216,.7)",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-100px, -100px)"
    });
    document.documentElement.append(state.robotCursor);
  }

  function setRobotCursorPosition(x, y) {
    if (!state.robotCursor) return;
    state.robotCursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function removeRobotCursor() {
    state.robotCursor?.remove();
    state.robotCursor = null;
    state.robotPosition = null;
  }

  function clickEffect(x, y, button) {
    const color = button === "right" ? "#c43d32" : "#1264d8";
    const ring = document.createElement("div");
    ring.dataset.autorobot1 = "true";
    Object.assign(ring.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: "18px",
      height: "18px",
      marginLeft: "-9px",
      marginTop: "-9px",
      borderRadius: "999px",
      border: `3px solid ${color}`,
      background: button === "right" ? "rgba(196,61,50,.18)" : "rgba(18,100,216,.18)",
      boxShadow: `0 0 24px ${color}`,
      zIndex: "2147483647",
      pointerEvents: "none",
      transition: "opacity .5s ease, transform .5s ease",
      transform: "scale(1)"
    });
    document.documentElement.append(ring);
    requestAnimationFrame(() => {
      ring.style.opacity = "0";
      ring.style.transform = "scale(3.2)";
    });
    setTimeout(() => ring.remove(), 560);
  }

  function scrollEffect(x, y, deltaY) {
    const marker = document.createElement("div");
    marker.dataset.autorobot1 = "true";
    marker.textContent = deltaY >= 0 ? "↓" : "↑";
    Object.assign(marker.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: "34px",
      height: "34px",
      marginLeft: "-17px",
      marginTop: "-17px",
      display: "grid",
      placeItems: "center",
      borderRadius: "999px",
      border: "3px solid #7c3aed",
      background: "rgba(124,58,237,.18)",
      color: "#7c3aed",
      font: "24px system-ui, sans-serif",
      fontWeight: "900",
      boxShadow: "0 0 24px rgba(124,58,237,.65)",
      zIndex: "2147483647",
      pointerEvents: "none",
      transition: "opacity .5s ease, transform .5s ease",
      transform: "translateY(0) scale(1)"
    });
    document.documentElement.append(marker);
    requestAnimationFrame(() => {
      marker.style.opacity = "0";
      marker.style.transform = `translateY(${deltaY >= 0 ? 34 : -34}px) scale(1.5)`;
    });
    setTimeout(() => marker.remove(), 560);
  }

  function keyEffect(key) {
    const marker = document.createElement("div");
    marker.dataset.autorobot1 = "true";
    marker.textContent = `Key: ${String(key || "").slice(0, 18)}`;
    Object.assign(marker.style, {
      position: "fixed",
      left: "50%",
      top: "18px",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      padding: "8px 12px",
      borderRadius: "8px",
      border: "2px solid #059669",
      background: "rgba(5,150,105,.92)",
      color: "#fff",
      font: "13px system-ui, sans-serif",
      fontWeight: "800",
      boxShadow: "0 8px 26px rgba(5,150,105,.32)",
      pointerEvents: "none",
      transition: "opacity .45s ease, transform .45s ease"
    });
    document.documentElement.append(marker);
    requestAnimationFrame(() => {
      marker.style.opacity = "0";
      marker.style.transform = "translateX(-50%) translateY(-12px)";
    });
    setTimeout(() => marker.remove(), 520);
  }

  function isAutoRobotElement(el) {
    return Boolean(el?.closest?.("[data-autorobot1='true']"));
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
