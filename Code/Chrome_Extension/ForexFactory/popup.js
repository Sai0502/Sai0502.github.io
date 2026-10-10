const localTimeBox = document.getElementById("local-time");
const statusNode = document.getElementById("status");
const resultDays = document.getElementById("result-days");
const debugPre = document.getElementById("debug-output");
const copyDebugButton = document.getElementById("copy-debug");
const refreshButton = document.getElementById("refresh-data");
const POPUP_BUILD_LABEL = "v1004_1915";

// 监听 background 在获取过程中广播的状态（正在 JSON / 正在网页 / JSON 404 等）
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "ffwo:progressStatus" && typeof message.text === "string") {
    statusNode.textContent = message.text;
  }
});

init().catch((error) => {
  statusNode.textContent = error && error.message ? error.message : String(error);
});

async function init() {
  const stored = await chrome.storage.local.get("ffwo_settings");
  const settings = Object.assign(
    {
      cacheHours: 4,
      useLocalTime: true
    },
    stored.ffwo_settings || {}
  );

  localTimeBox.checked = Boolean(settings.useLocalTime);
  statusNode.textContent = "正在获取中...";
  await loadPopupData(false);
}

refreshButton.addEventListener("click", async () => {
  statusNode.textContent = "正在重新获取...";
  await loadPopupData(true);
});

// 切换本地时间开关：只改 settings，然后让 background 用缓存的 parsed 数据重新 build（不重新联网）
localTimeBox.addEventListener("change", async () => {
  const stored = await chrome.storage.local.get("ffwo_settings");
  const current = Object.assign(
    { cacheHours: 4, useLocalTime: true },
    stored.ffwo_settings || {}
  );
  await chrome.storage.local.set({
    ffwo_settings: Object.assign({}, current, { useLocalTime: localTimeBox.checked })
  });
  // 不显示"正在获取"——本地切换，直接走缓存 rebuild
  await loadPopupData(false);
});

function loadPopupData(forceRefresh) {
  refreshButton.disabled = true;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: forceRefresh ? "ffwo:refreshPopupData" : "ffwo:getPopupData" }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        statusNode.textContent = `获取失败：${lastError.message || "扩展通信失败"}`;
        renderError(statusNode.textContent);
        refreshButton.disabled = false;
        resolve();
        return;
      }
      if (!response || !response.ok) {
        statusNode.textContent = `获取失败：${(response && response.error) || "未知错误"}`;
        renderError(statusNode.textContent);
        refreshButton.disabled = false;
        resolve();
        return;
      }

      const partial = Boolean(response.debug && response.debug.partial);
      // 获取完成：不再显示"正在通过…"这类获取状态，仅在不完整时提示
      statusNode.textContent = partial ? "数据源返回内容可能不完整，可稍后重新获取" : "";
      resultDays.innerHTML = renderDays(response.payload.days);
      renderDebug(response);
      refreshButton.disabled = false;
      resolve();
    });
  });
}

function renderDebug(response) {
  const debug = Object.assign(
    {
      popupBuild: POPUP_BUILD_LABEL
    },
    response.debug || {},
    {
      payloadGeneratedAt: response.payload && response.payload.generatedAt ? response.payload.generatedAt : "",
      payloadWeek: response.payload && response.payload.requestedWeekRange ? response.payload.requestedWeekRange : "",
      useLocalTime: Boolean(response.payload && response.payload.settings && response.payload.settings.useLocalTime)
    }
  );
  debugPre.textContent = JSON.stringify(debug, null, 2);
}

function renderDays(days) {
  return days
    .map((day) => {
      const body = day.empty
        ? `<div class="popup-empty">无数据</div>`
        : day.events
            .map((group) => {
              const items = group.items
                .map((item) => {
                  const note = item.note ? ` <span class="popup-item-note">(${escapeHtml(item.note)})</span>` : "";
                  return `<div class="popup-item">${escapeHtml(item.name)}${note}</div>`;
                })
                .join("");
              return `
                <div class="popup-event-group">
                  <div class="popup-time">${escapeHtml(group.time)}</div>
                  <div class="popup-items">${items}</div>
                </div>
              `;
            })
            .join("");

      return `
        <section class="popup-day">
          <div class="popup-day-head">
            <div class="popup-day-label">${escapeHtml(day.dateLabel)} ${escapeHtml(day.weekdayLabel)}</div>
            <div class="popup-day-holiday">${day.holidaySuffix ? escapeHtml(day.holidaySuffix) : ""}</div>
          </div>
          ${body}
        </section>
      `;
    })
    .join("");
}

function renderError(message, diagnostic) {
  resultDays.innerHTML = "";
  statusNode.textContent = message;
  // 失败时把错误信息 + 完整诊断写进调试面板，方便复制排查
  const dump = {
    popupBuild: POPUP_BUILD_LABEL,
    error: message,
    diagnostic: diagnostic || null,
    env: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffsetMin: new Date().getTimezoneOffset(),
      userAgent: navigator.userAgent,
      now: new Date().toISOString()
    }
  };
  debugPre.textContent = JSON.stringify(dump, null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

copyDebugButton.addEventListener("click", async (event) => {
  event.stopPropagation();
  try {
    await navigator.clipboard.writeText(debugPre.textContent || "");
    statusNode.textContent = "调试信息已复制";
  } catch (error) {
    statusNode.textContent = error && error.message ? error.message : String(error);
  }
});
