(function () {
  "use strict";

  const PRODUCT_NAME = "TradeTimeGuard";
  const VERSION = "2026.07.02.3";
  const STORAGE_KEY = "tradeTimeGuardRules";
  const DEFAULT_MESSAGE = "白天开单，罚款100人民币给阿伟";
  const DEFAULT_RULES = [
    {
      id: "tradovate-daytime-default",
      enabled: true,
      url: "https://trader.tradovate.com/",
      start: "06:00",
      end: "21:00",
      message: DEFAULT_MESSAGE
    },
    {
      id: "topstepx-daytime-default",
      enabled: true,
      url: "https://topstepx.com",
      start: "06:00",
      end: "21:00",
      message: DEFAULT_MESSAGE
    }
  ];

  const rulesEl = document.getElementById("rules");
  const template = document.getElementById("ruleTemplate");
  const statusEl = document.getElementById("status");
  const addRuleBtn = document.getElementById("addRule");
  const copySummaryBtn = document.getElementById("copySummary");
  const copyDetailedBtn = document.getElementById("copyDetailed");
  const copyRawBtn = document.getElementById("copyRaw");

  let rules = [];
  let saveTimer = null;
  let currentTab = null;
  const actionLog = [];
  const errorLog = [];
  const networkLog = [];

  function logAction(message, detail = {}) {
    actionLog.unshift({ at: new Date().toISOString(), message, detail });
    actionLog.splice(20);
  }

  function logError(message, detail = {}) {
    errorLog.unshift({ at: new Date().toISOString(), message, detail });
    errorLog.splice(10);
  }

  function uid() {
    return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeRule(rule) {
    return {
      id: rule.id || uid(),
      enabled: rule.enabled !== false,
      url: String(rule.url || "").trim(),
      start: rule.start || "06:00",
      end: rule.end || "21:00",
      message: String(rule.message || DEFAULT_MESSAGE).trim()
    };
  }

  function sanitizeUrl(value) {
    if (!value) return "无法获取";
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}${url.search ? " [?query]" : ""}${url.hash ? " [#hash]" : ""}`;
    } catch (_error) {
      return String(value).split("?")[0].split("#")[0] || "无法解析";
    }
  }

  function normalizeUrlText(value) {
    return String(value || "").trim().toLowerCase().replace(/\/+$/, "");
  }

  function pageText() {
    if (!currentTab || !currentTab.url) return "";
    try {
      const parsed = new URL(currentTab.url);
      return normalizeUrlText(parsed.origin + parsed.pathname);
    } catch (_error) {
      return normalizeUrlText(currentTab.url);
    }
  }

  function pageHost() {
    if (!currentTab || !currentTab.url) return "";
    try {
      return new URL(currentTab.url).hostname.toLowerCase();
    } catch (_error) {
      return "";
    }
  }

  function ruleMatchesCurrentTab(rule) {
    const raw = normalizeUrlText(rule.url);
    if (!raw || !currentTab || !currentTab.url) return false;

    const currentPage = pageText();
    if (currentPage.startsWith(raw)) return true;

    try {
      const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
      const ruleHost = parsed.hostname.toLowerCase();
      const host = pageHost();
      return host === ruleHost || host.endsWith(`.${ruleHost}`);
    } catch (_error) {
      return currentPage.includes(raw) || pageHost().includes(raw);
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

  function scheduleState(rule, now = new Date()) {
    const startMinute = parseTime(rule.start);
    const endMinute = parseTime(rule.end);
    if (startMinute === null || endMinute === null || startMinute === endMinute) {
      return { active: false, reason: "invalid_time" };
    }

    const parts = beijingParts(now);
    const nowMinute = parts.hour * 60 + parts.minute;
    const crossesMidnight = endMinute < startMinute;
    const active = crossesMidnight
      ? nowMinute >= startMinute || nowMinute < endMinute
      : nowMinute >= startMinute && nowMinute < endMinute;

    return { active, reason: active ? "active" : "outside_window" };
  }

  function isRuleLocked(rule) {
    return rule.enabled !== false && scheduleState(rule).active;
  }

  function setStatus(text) {
    statusEl.textContent = text;
    if (text) {
      setTimeout(() => {
        if (statusEl.textContent === text) statusEl.textContent = "";
      }, 1600);
    }
  }

  function readRulesFromDom() {
    return Array.from(rulesEl.querySelectorAll(".rule")).map((node) => {
      const original = rules.find((rule) => rule.id === node.dataset.id);
      if (node.dataset.locked === "true" && original) return original;
      return normalizeRule({
        id: node.dataset.id,
        enabled: node.querySelector(".field-enabled").checked,
        url: node.querySelector(".field-url").value,
        start: node.querySelector(".field-start").value,
        end: node.querySelector(".field-end").value,
        message: node.querySelector(".field-message").value
      });
    }).filter((rule) => rule.url);
  }

  function saveNow(reason = "settings_saved") {
    rules = readRulesFromDom();
    chrome.storage.sync.set({ [STORAGE_KEY]: rules }, () => {
      if (chrome.runtime.lastError) {
        logError("保存设置失败", { error: chrome.runtime.lastError.message });
        setStatus("保存失败");
        return;
      }
      logAction(reason, { ruleCount: rules.length });
      setStatus("已保存");
      render();
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(), 300);
  }

  function setRuleLockedUi(node, locked) {
    node.dataset.locked = locked ? "true" : "false";
    node.classList.toggle("locked", locked);
    node.querySelectorAll("input, textarea").forEach((field) => {
      field.disabled = locked;
    });
    const deleteBtn = node.querySelector(".delete");
    deleteBtn.disabled = locked;
    node.querySelector(".lock-note").hidden = !locked;
  }

  function renderRule(rule) {
    const node = template.content.firstElementChild.cloneNode(true);
    const locked = isRuleLocked(rule);
    node.dataset.id = rule.id;
    node.querySelector(".field-enabled").checked = rule.enabled;
    node.querySelector(".field-url").value = rule.url;
    node.querySelector(".field-start").value = rule.start;
    node.querySelector(".field-end").value = rule.end;
    node.querySelector(".field-message").value = rule.message;

    node.addEventListener("input", () => {
      if (node.dataset.locked === "true") return;
      scheduleSave();
    });
    node.addEventListener("change", () => {
      if (node.dataset.locked === "true") return;
      scheduleSave();
    });
    node.querySelector(".delete").addEventListener("click", () => {
      if (node.dataset.locked === "true") return;
      logAction("delete_rule_clicked", { id: rule.id, url: rule.url });
      node.remove();
      saveNow("rule_deleted");
    });

    setRuleLockedUi(node, locked);
    rulesEl.appendChild(node);
  }

  function render() {
    rulesEl.textContent = "";
    rules.forEach(renderRule);
  }

  function loadCurrentTab(callback) {
    if (!chrome.tabs || !chrome.tabs.query) {
      logError("无法获取当前标签页", { reason: "tabs_api_unavailable" });
      callback();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        logError("获取当前标签页失败", { error: chrome.runtime.lastError.message });
      }
      currentTab = tabs && tabs[0] ? tabs[0] : null;
      logAction("current_tab_loaded", { page: sanitizeUrl(currentTab && currentTab.url) });
      callback();
    });
  }

  function load() {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_RULES }, (result) => {
      if (chrome.runtime.lastError) {
        logError("读取设置失败", { error: chrome.runtime.lastError.message });
      }
      const stored = result[STORAGE_KEY];
      rules = Array.isArray(stored) && stored.length ? stored.map(normalizeRule) : DEFAULT_RULES.map(normalizeRule);
      loadCurrentTab(() => {
        render();
        logAction("popup_loaded", { ruleCount: rules.length });
      });
    });
  }

  async function getContentDebug() {
    if (!currentTab || !currentTab.id || !chrome.tabs || !chrome.tabs.sendMessage) {
      return { ok: false, reason: "无法获取当前标签页或 tabs.sendMessage 不可用" };
    }

    try {
      return await new Promise((resolve) => {
        chrome.tabs.sendMessage(currentTab.id, { type: "TRADE_TIME_GUARD_DEBUG" }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, reason: chrome.runtime.lastError.message });
            return;
          }
          resolve({ ok: true, response });
        });
      });
    } catch (error) {
      return { ok: false, reason: error && error.message ? error.message : String(error) };
    }
  }

  function activeLockedRules() {
    return rules.filter(isRuleLocked);
  }

  function currentCoreData(contentDebug) {
    return {
      currentPage: sanitizeUrl(currentTab && currentTab.url),
      activeLockedRules: activeLockedRules().map((rule) => ({
        id: rule.id,
        url: rule.url,
        start: rule.start,
        end: rule.end,
        message: rule.message
      })),
      contentActiveRuleId: contentDebug && contentDebug.ok && contentDebug.response ? contentDebug.response.activeRuleId : null,
      ruleCount: rules.length,
      enabledRuleCount: rules.filter((rule) => rule.enabled !== false).length
    };
  }

  function featureSummary() {
    return {
      chromeStorage: Boolean(chrome.storage && chrome.storage.sync),
      chromeTabs: Boolean(chrome.tabs && chrome.tabs.query),
      clipboard: Boolean(navigator.clipboard && navigator.clipboard.writeText),
      intlBeijingTimezone: (() => {
        try {
          return Boolean(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()));
        } catch (_error) {
          return false;
        }
      })()
    };
  }

  function permissionSummary() {
    return {
      storage: "manifest permissions: storage",
      tabs: "manifest permissions: tabs",
      hostAccess: "content_scripts matches tradovate/topstepx"
    };
  }

  function formatList(items, emptyText = "无") {
    return items && items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : emptyText;
  }

  function buildClues(core, contentDebug) {
    const clues = [];
    if (!currentTab || !currentTab.url) clues.push("Popup 没有拿到当前标签页 URL，先看 tabs 权限或打开位置。");
    if (!core.activeLockedRules.length) clues.push("当前没有任何规则处于锁定时段，若预期应锁定，优先检查规则时段和北京时间。");
    if (contentDebug && !contentDebug.ok) clues.push("Popup 没有从页面脚本拿到 debug，可能当前页未注入 content script 或不在匹配网址。");
    if (errorLog.length) clues.push("最近存在错误日志，优先看 Errors / Warnings。");
    clues.push("如果设置项能改但页面仍被锁，检查 storage 里对应规则是否仍处于启用和活跃时段。");
    return clues.slice(0, 5);
  }

  async function buildDiagnostic(level) {
    const contentDebug = await getContentDebug();
    const core = currentCoreData(contentDebug);
    const now = new Date().toISOString();
    const detectionOk = core.activeLockedRules.length > 0 || (contentDebug.ok && contentDebug.response && contentDebug.response.activeRuleId);
    const recentLogs = actionLog.slice(0, level === "summary" ? 20 : 80).map((item) => `${item.at} ${item.message} ${JSON.stringify(item.detail)}`);
    const warnings = errorLog.slice(0, level === "summary" ? 10 : 40).map((item) => `${item.at} ${item.message} ${JSON.stringify(item.detail)}`);
    const rulesBrief = rules.map((rule) => `${rule.enabled === false ? "停用" : "启用"} ${rule.url} ${rule.start}-${rule.end}${isRuleLocked(rule) ? " [当前锁定]" : ""}`);
    const clues = buildClues(core, contentDebug);

    const summary = `# ${PRODUCT_NAME} AI Debug Summary

## Problem Context
用户当前正在做什么：检查开仓时段提醒浮层和插件设置
实际结果：请用户在这里补充
预期结果：命中网址和时段时页面被不可关闭浮层锁住；锁住中的对应规则不能修改或删除

## Environment
版本：${VERSION}
浏览器：${navigator.userAgent}
系统：${navigator.platform || "无法获取"}
页面：${core.currentPage}
时间：${now}

## Current State
核心状态：${core.activeLockedRules.length ? "当前有锁定中的规则" : "当前没有锁定中的规则"}
核心数据：${JSON.stringify(core)}
配置摘要：
${formatList(rulesBrief)}

## Detection Result
数据来源：popup storage + 当前标签页 URL + content debug
解析结果：${contentDebug.ok ? "content debug 可读取" : `content debug 不可读取：${contentDebug.reason}`}
是否成功：${detectionOk ? "是" : "否/未命中"}
失败原因：${detectionOk ? "无" : "未命中网址/时段，或当前页未注入 content script"}

## Recent Actions
${formatList(actionLog.slice(0, 10).map((item) => `${item.at} ${item.message}`))}

## Errors / Warnings
${formatList(warnings)}

## Recent Logs
${formatList(recentLogs)}

## Network Summary
${networkLog.length ? formatList(networkLog.slice(0, 10).map((item) => JSON.stringify(item))) : "无网络请求；本插件当前不主动请求网络"}

## Feature / Permission Summary
${JSON.stringify({ feature: featureSummary(), permission: permissionSummary() }, null, 2)}

## What Codex Should Look At First
${formatList(clues)}
`;

    if (level === "summary") return summary;

    const detailed = `${summary}

---

# Detailed

## Full Runtime State
\`\`\`json
${JSON.stringify({
  product: PRODUCT_NAME,
  version: VERSION,
  now,
  currentTab: currentTab ? { id: currentTab.id, url: sanitizeUrl(currentTab.url), title: currentTab.title } : null,
  beijing: beijingParts(),
      rules: rules.map((rule) => ({ ...rule, matchesCurrentTab: ruleMatchesCurrentTab(rule), schedule: scheduleState(rule), settingsLocked: isRuleLocked(rule) })),
  contentDebug,
  actions: actionLog,
  errors: errorLog,
  network: networkLog,
  feature: featureSummary(),
  permission: permissionSummary()
}, null, 2)}
\`\`\`
`;

    if (level === "detailed") return detailed;

    return `${detailed}

---

# Raw

注意：Raw 包含完整规则配置、Popup DOM 片段和 content debug 原始返回，不包含 cookie/token/authorization header。

\`\`\`json
${JSON.stringify({
  localState: {
    rules,
    actionLog,
    errorLog,
    networkLog
  },
  popupDomText: document.body.innerText.slice(0, 8000),
  contentDebug
}, null, 2)}
\`\`\`
`;
  }

  async function copyDiagnostic(level) {
    if (level === "raw" && !window.confirm("Raw 诊断包体积较大，可能包含页面片段和完整配置。确认复制？")) {
      return;
    }
    const text = await buildDiagnostic(level);
    await navigator.clipboard.writeText(text);
    logAction(`copy_${level}_diagnostic`);
    setStatus(`已复制 ${level}`);
  }

  addRuleBtn.addEventListener("click", () => {
    rules = readRulesFromDom();
    rules.push(normalizeRule({
      id: uid(),
      enabled: true,
      url: "https://",
      start: "06:00",
      end: "21:00",
      message: DEFAULT_MESSAGE
    }));
    logAction("add_rule_clicked");
    render();
    saveNow("rule_added");
  });

  copySummaryBtn.addEventListener("click", (event) => {
    event.preventDefault();
    copyDiagnostic("summary").catch((error) => {
      logError("复制 Summary 失败", { error: error.message });
      setStatus("复制失败");
    });
  });

  copyDetailedBtn.addEventListener("click", () => {
    copyDiagnostic("detailed").catch((error) => {
      logError("复制 Detailed 失败", { error: error.message });
      setStatus("复制失败");
    });
  });

  copyRawBtn.addEventListener("click", () => {
    copyDiagnostic("raw").catch((error) => {
      logError("复制 Raw 失败", { error: error.message });
      setStatus("复制失败");
    });
  });

  load();
})();
