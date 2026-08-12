(function () {
  "use strict";

  const STORAGE_KEY = "tradeTimeGuardRules";
  const OVERLAY_ID = "trade-time-guard-overlay";
  const DEFAULT_RULES = [
    {
      id: "tradovate-daytime-default",
      enabled: true,
      url: "https://trader.tradovate.com/",
      start: "06:00",
      end: "21:00",
      message: "白天开单，罚款100人民币给阿伟"
    },
    {
      id: "topstepx-daytime-default",
      enabled: true,
      url: "https://topstepx.com",
      start: "06:00",
      end: "21:00",
      message: "白天开单，罚款100人民币给阿伟"
    }
  ];

  let rules = DEFAULT_RULES;
  let timer = null;
  let activeRuleId = null;
  const actionLog = [];
  const errorLog = [];

  function logAction(message, detail = {}) {
    actionLog.unshift({ at: new Date().toISOString(), message, detail });
    actionLog.splice(30);
  }

  function logError(message, detail = {}) {
    errorLog.unshift({ at: new Date().toISOString(), message, detail });
    errorLog.splice(10);
  }

  function normalizeUrlText(value) {
    return String(value || "").trim().toLowerCase().replace(/\/+$/, "");
  }

  function currentPageText() {
    return normalizeUrlText(location.origin + location.pathname);
  }

  function hostText() {
    return location.hostname.toLowerCase();
  }

  function ruleMatchesPage(rule) {
    const raw = normalizeUrlText(rule.url);
    if (!raw) return false;

    const page = currentPageText();
    if (page.startsWith(raw)) return true;

    try {
      const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
      const ruleHost = parsed.hostname.toLowerCase();
      return hostText() === ruleHost || hostText().endsWith(`.${ruleHost}`);
    } catch (_error) {
      return page.includes(raw) || hostText().includes(raw);
    }
  }

  function beijingParts(now = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second)
    };
  }

  function parseTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function beijingDateToMs(parts, minuteOfDay) {
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    return Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, minute, 0, 0);
  }

  function scheduleState(rule, now = new Date()) {
    const startMinute = parseTime(rule.start);
    const endMinute = parseTime(rule.end);
    if (startMinute === null || endMinute === null || startMinute === endMinute) {
      return { active: false, remainingMs: 0, reason: "invalid_time" };
    }

    const parts = beijingParts(now);
    const nowMinute = parts.hour * 60 + parts.minute;
    const nowSecond = parts.second;
    const crossesMidnight = endMinute < startMinute;
    const active = crossesMidnight
      ? nowMinute >= startMinute || nowMinute < endMinute
      : nowMinute >= startMinute && nowMinute < endMinute;

    if (!active) return { active: false, remainingMs: 0, reason: "outside_window" };

    let endMs = beijingDateToMs(parts, endMinute);
    const nowMs = beijingDateToMs(parts, nowMinute) + nowSecond * 1000;
    if (crossesMidnight && nowMinute >= startMinute) {
      endMs += 24 * 60 * 60 * 1000;
    }

    return { active: true, remainingMs: Math.max(0, endMs - nowMs), reason: "active" };
  }

  function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="trade-time-guard-panel" role="alert" aria-live="assertive">
        <div class="trade-time-guard-message"></div>
        <div class="trade-time-guard-countdown"></div>
      </div>
    `;
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    if (activeRuleId) logAction("overlay_removed", { activeRuleId });
    activeRuleId = null;
  }

  function renderOverlay(rule, state) {
    const overlay = ensureOverlay();
    overlay.querySelector(".trade-time-guard-message").textContent = rule.message || "当前时段禁止开仓";
    overlay.querySelector(".trade-time-guard-countdown").textContent = `距离结束：${formatRemaining(state.remainingMs)}`;
    if (activeRuleId !== rule.id) {
      logAction("overlay_rendered", { ruleId: rule.id, url: rule.url, start: rule.start, end: rule.end });
    }
    activeRuleId = rule.id;
  }

  function evaluate() {
    const enabledRules = Array.isArray(rules) ? rules.filter((rule) => rule && rule.enabled !== false) : [];
    const matchedRule = enabledRules.find((rule) => ruleMatchesPage(rule) && scheduleState(rule).active);
    if (!matchedRule) {
      removeOverlay();
      return;
    }

    renderOverlay(matchedRule, scheduleState(matchedRule));
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(evaluate, 1000);
  }

  function loadRules() {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_RULES }, (result) => {
      if (chrome.runtime.lastError) {
        logError("storage_get_failed", { error: chrome.runtime.lastError.message });
      }
      rules = Array.isArray(result[STORAGE_KEY]) && result[STORAGE_KEY].length ? result[STORAGE_KEY] : DEFAULT_RULES;
      logAction("rules_loaded", { count: rules.length });
      evaluate();
      startTimer();
    });
  }

  function watchUrlChanges() {
    let last = location.href;
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        evaluate();
      }
    }, 800);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[STORAGE_KEY]) return;
    rules = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : DEFAULT_RULES;
    logAction("rules_changed", { count: rules.length });
    evaluate();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "TRADE_TIME_GUARD_DEBUG") return false;
    const active = Array.isArray(rules)
      ? rules.map((rule) => ({ ...rule, matches: ruleMatchesPage(rule), schedule: scheduleState(rule) }))
      : [];
    sendResponse({
      version: "2026.07.02.3",
      page: location.href,
      title: document.title,
      readyState: document.readyState,
      beijing: beijingParts(),
      activeRuleId,
      hasOverlay: Boolean(document.getElementById(OVERLAY_ID)),
      rules: active,
      actions: actionLog.slice(0, 20),
      errors: errorLog.slice(0, 10),
      domSnippet: document.body ? document.body.innerText.slice(0, 1200) : ""
    });
    return true;
  });

  document.addEventListener("visibilitychange", evaluate);
  window.addEventListener("focus", evaluate);

  loadRules();
  watchUrlChanges();

  window.__tradeTimeGuardDebug = function () {
    const active = Array.isArray(rules)
      ? rules.map((rule) => ({ ...rule, matches: ruleMatchesPage(rule), schedule: scheduleState(rule) }))
      : [];
    return {
      version: "2026.07.02.3",
      page: location.href,
      beijing: beijingParts(),
      activeRuleId,
      rules: active,
      actions: actionLog.slice(0, 20),
      errors: errorLog.slice(0, 10)
    };
  };
})();
