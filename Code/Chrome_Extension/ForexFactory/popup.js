const includeEUR = document.getElementById("include-eur");
const statusNode = document.getElementById("status");
const resultDays = document.getElementById("result-days");
const debugPre = document.getElementById("debug-output");
const buildNode = document.getElementById("build-label");
const copyDebugButton = document.getElementById("copy-debug");
const refreshButton = document.getElementById("refresh-data");
const POPUP_BUILD_LABEL = "ForexFactoryWeekOverlay v2026_0802_235500";

init().catch((error) => {
  statusNode.textContent = error && error.message ? error.message : String(error);
});

async function init() {
  buildNode.textContent = POPUP_BUILD_LABEL;
  const stored = await chrome.storage.local.get("ffwo_settings");
  const settings = Object.assign(
    {
      includeEUR: false,
      cacheHours: 4
    },
    stored.ffwo_settings || {}
  );

  includeEUR.checked = Boolean(settings.includeEUR);
  statusNode.textContent = "正在获取中...";
  await loadPopupData(false);
}

refreshButton.addEventListener("click", async () => {
  statusNode.textContent = "正在重新获取...";
  await loadPopupData(true);
});

includeEUR.addEventListener("change", async () => {
  const stored = await chrome.storage.local.get("ffwo_settings");
  const currentSettings = Object.assign(
    {
      includeEUR: false,
      cacheHours: 4
    },
    stored.ffwo_settings || {}
  );
  const nextSettings = {
    includeEUR: includeEUR.checked,
    cacheHours: currentSettings.cacheHours
  };
  await chrome.storage.local.set({ ffwo_settings: nextSettings });
  statusNode.textContent = "正在获取中...";
  await loadPopupData(true);
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
      includeEUR: Boolean(response.payload && response.payload.settings && response.payload.settings.includeEUR)
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

function renderError(message) {
  resultDays.innerHTML = "";
  statusNode.textContent = message;
  debugPre.textContent = "";
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
