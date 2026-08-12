const CACHE_PREFIX = "weekly-news:";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const PARTIAL_CACHE_TTL_MS = 15 * 60 * 1000;
const PARTIAL_EVENT_THRESHOLD = 4;
const BUILD_LABEL = "ForexFactoryWeekOverlay v2026_0802_235500";
const DEFAULT_CURRENCIES = new Set(["USD"]);
const DEFAULT_IMPACTS = new Set(["High", "Medium"]);
const WEEKDAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const CLEAN_NAME_MAP = new Map([
  ["Flash Manufacturing PMI", "Manufacturing PMI"],
  ["Flash Services PMI", "Services PMI"],
  ["Revised UoM Consumer Sentiment", "UoM Consumer Sentiment"],
  ["Core PCE Price Index m/m", "Core PCE Price Index m/m"],
  ["Final GDP q/q", "Final GDP q/q"],
  ["Final GDP Price Index q/q", "Final GDP Price Index q/q"],
  ["ADP Non-Farm Employment Change", "ADP Non-Farm Employment Change"],
  ["Average Hourly Earnings m/m", "Average Hourly Earnings m/m"],
  ["Non-Farm Employment Change", "Non-Farm Employment Change"],
  ["Unemployment Rate", "Unemployment Rate"],
  ["CB Consumer Confidence", "CB Consumer Confidence"],
  ["JOLTS Job Openings", "JOLTS Job Openings"],
  ["Core Retail Sales m/m", "Core Retail Sales m/m"],
  ["Retail Sales m/m", "Retail Sales m/m"],
  ["Pending Home Sales m/m", "Pending Home Sales m/m"],
  ["Philly Fed Manufacturing Index", "Philly Fed Manufacturing Index"],
  ["Federal Funds Rate", "Federal Funds Rate"],
  ["FOMC Economic Projections", "FOMC Economic Projections"],
  ["FOMC Statement", "FOMC Statement"],
  ["FOMC Press Conference", "FOMC Press Conference"],
  ["New Home Sales", "New Home Sales"],
  ["ISM Manufacturing PMI", "ISM Manufacturing PMI"],
  ["ISM Manufacturing Prices", "ISM Manufacturing Prices"]
]);

const NAME_PRIORITY = new Map([
  ["CPI", 10],
  ["Unemployment Claims", 15],
  ["PPI", 20],
  ["PCE", 30],
  ["GDP", 40],
  ["NFP", 50],
  ["ADP", 60],
  ["Manufacturing PMI", 70],
  ["Services PMI", 80],
  ["Retail Sales", 90],
  ["FOMC Meeting Minutes", 100],
  ["ECB", 110],
  ["ECB Press Conference", 120],
  ["UoM Consumer Sentiment", 130],
  ["Empire State Manufacturing", 140],
  ["Building Permits", 150],
  ["Housing Starts", 160],
  ["Import Prices", 170],
  ["Industrial Production", 180],
  ["NAHB Housing Market Index", 190],
  ["Flash Manufacturing PMI", 200],
  ["Flash Services PMI", 210],
  ["Core PCE Price Index", 220],
  ["Final GDP", 230],
  ["GDP Price Index", 240],
  ["New Home Sales", 250],
  ["Consumer Confidence", 260],
  ["JOLTS Job Openings", 270],
  ["Average Hourly Earnings", 280],
  ["Unemployment Rate", 290],
  ["Federal Funds Rate", 300],
  ["FOMC Economic Projections", 310],
  ["FOMC Statement", 320],
  ["FOMC Press Conference", 330],
  ["Philly Fed Manufacturing Index", 340],
  ["Pending Home Sales", 350]
]);

const HOLIDAY_PRIORITY = new Map([
  ["美盘休市", 5],
  ["CME时间调整", 8],
  ["纽约休市", 10],
  ["伦敦休市", 20]
]);

const FF_COUNTRY_TO_MARKET = new Map([
  ["USD", "纽约"],
  ["GBP", "伦敦"],
  ["EUR", "欧元区"],
  ["AUD", "澳洲"]
]);

const MANUAL_MARKET_SCHEDULE_RULES = [
  {
    date: "2026-07-03",
    market: "美盘休市",
    name: "",
    displayText: "美盘休市",
    summaryText: "美盘休市",
    noteText: "美盘休市"
  }
];

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    ffwo_settings: {
      includeEUR: false,
      cacheHours: 4
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "ffwo:getOverlayData") {
    handleGetOverlayData().then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }

  if (message.type === "ffwo:refreshOverlayData") {
    handleGetOverlayData({ forceRefresh: true }).then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }

  if (message.type === "ffwo:getPopupData") {
    handleGetOverlayData().then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }

  if (message.type === "ffwo:refreshPopupData") {
    handleGetOverlayData({ forceRefresh: true }).then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }

  return false;
});

async function handleGetOverlayData(options = {}) {
  const settings = await getSettings();
  const anchor = getTargetAnchorDate();
  const weekSlug = getWeekSlug(anchor);
  const cacheKey = `${CACHE_PREFIX}${weekSlug}:${settings.includeEUR ? "usd-eur" : "usd"}`;
  const now = Date.now();
  const cache = await chrome.storage.local.get(cacheKey);
  const cached = cache[cacheKey];
  const cacheTtl = Math.max(1, Number(settings.cacheHours || 4)) * 60 * 60 * 1000;
  const cachedTtl = cached && cached.debug && cached.debug.partial
    ? Math.min(cacheTtl, PARTIAL_CACHE_TTL_MS)
    : cacheTtl;

  if (!options.forceRefresh && cached && now - cached.fetchedAt < cachedTtl) {
    return {
      ok: true,
      source: "cache",
      payload: applyUiSettings(cached.payload, settings),
      debug: Object.assign({}, cached.debug || {}, {
        build: BUILD_LABEL,
        source: "cache",
        cacheKey,
        cacheAgeMs: now - cached.fetchedAt,
        cacheTtlMs: cachedTtl
      })
    };
  }

  const payload = await fetchWeeklyPayload(anchor, settings);
  const debug = Object.assign({}, payload.debug || {}, {
    partial: isLikelyPartialPayload(payload)
  });
  payload.debug = debug;
  await chrome.storage.local.set({
    [cacheKey]: {
      fetchedAt: now,
      payload,
      debug
    }
  });

  return {
    ok: true,
    source: "live",
    payload: applyUiSettings(payload, settings),
    debug: Object.assign({}, debug, {
      build: BUILD_LABEL,
      source: "live",
      cacheKey,
      cacheAgeMs: 0,
      cacheTtlMs: debug.partial ? Math.min(cacheTtl, PARTIAL_CACHE_TTL_MS) : cacheTtl,
      partial: debug.partial
    })
  };
}

async function getSettings() {
  const stored = await chrome.storage.local.get("ffwo_settings");
  return Object.assign(
    {
      includeEUR: false,
      autoOpen: true,
      cacheHours: 4
    },
    stored.ffwo_settings || {}
  );
}

function getTargetAnchorDate(now = new Date()) {
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const target = new Date(now);
  if (isWeekend) {
    const add = day === 6 ? 2 : 1;
    target.setDate(target.getDate() + add);
  }
  return target;
}

function getMonday(dateLike) {
  const date = new Date(dateLike);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function getSunday(dateLike) {
  const monday = getMonday(dateLike);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

function getWeekSlug(dateLike) {
  const monday = getMonday(dateLike);
  const month = monday.toLocaleString("en-US", { month: "short" }).toLowerCase();
  return `${month}${monday.getDate()}.${monday.getFullYear()}`;
}

async function fetchWeeklyPayload(anchorDate, settings) {
  const jsonPrimary = await fetchJsonPayload(anchorDate, settings).catch((error) => ({
    ok: false,
    error: error && error.message ? error.message : String(error)
  }));
  if (jsonPrimary && jsonPrimary.ok) {
    const parsed = jsonPrimary.parsed;
    return buildWeeklyPayload(anchorDate, settings, parsed, {
      primarySource: "json",
      json: withoutParsed(jsonPrimary),
      webpageFallback: { ok: false, skipped: "json primary succeeded" }
    });
  }

  const webpagePayload = await fetchWeeklyPayloadFromWebPage(anchorDate, settings);
  webpagePayload.debug = Object.assign({}, webpagePayload.debug || {}, {
    primarySource: "webpage",
    json: withoutParsed(jsonPrimary)
  });
  return webpagePayload;
}

async function fetchWeeklyPayloadFromWebPage(anchorDate, settings) {
  const slug = getWeekSlug(anchorDate);
  const url = `https://www.forexfactory.com/calendar?week=${slug}&ffwo_fetch=1`;
  const tab = await chrome.tabs.create({
    url,
    active: false
  });

  try {
    await waitForTabComplete(tab.id, 45000);
    const readyDebug = await waitForCalendarRowsReady(tab.id, 8000);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeCalendarPage
    });

    const value = result && result.result;
    if (!value || !value.ok) {
      throw new Error(value && value.error ? value.error : "Failed to scrape Forex Factory calendar.");
    }

    const parsed = normalizeWeeklyRows(anchorDate, value.rows, settings);
    return buildWeeklyPayload(anchorDate, settings, parsed, {
      primarySource: "webpage",
      fetchUrl: url,
      ready: readyDebug,
      scrape: value.debug || {}
    });
  } finally {
    if (tab && typeof tab.id === "number") {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (_) {
      }
    }
  }
}

function buildWeeklyPayload(anchorDate, settings, parsed, sourceDebug = {}) {
  const slug = getWeekSlug(anchorDate);
  return {
    build: BUILD_LABEL,
    generatedAt: new Date().toISOString(),
    requestedWeekSlug: slug,
    requestedWeekRange: formatWeekRange(anchorDate),
    targetMode: isWeekend(new Date()) ? "next-week" : "this-week",
    settings: {
      includeEUR: Boolean(settings.includeEUR)
    },
    summaryText: formatWeekText(anchorDate, parsed.events, parsed.holidays),
    days: buildDayCards(anchorDate, parsed.events, parsed.holidays),
    holidays: parsed.holidays,
    debug: Object.assign({
      build: BUILD_LABEL,
      requestedWeekSlug: slug,
      requestedWeekRange: formatWeekRange(anchorDate),
      targetMode: isWeekend(new Date()) ? "next-week" : "this-week",
      includeEUR: Boolean(settings.includeEUR),
      eventCount: parsed.events.length,
      holidayCount: parsed.holidays.length
    }, sourceDebug)
  };
}

function withoutParsed(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  const copy = Object.assign({}, value);
  delete copy.parsed;
  return copy;
}

async function fetchJsonPayload(anchorDate, settings) {
  const jsonUrl = getJsonExportUrl(anchorDate);
  const response = await fetch(jsonUrl, {
    cache: "no-store",
    credentials: "omit"
  });
  if (!response.ok) {
    throw new Error(`Forex Factory JSON export failed: HTTP ${response.status}`);
  }
  const items = await response.json();
  if (!Array.isArray(items)) {
    throw new Error("Forex Factory JSON export returned an unexpected payload.");
  }
  const parsed = normalizeJsonCalendarItems(anchorDate, items, settings);
  return {
    ok: true,
    source: "nfs.faireconomy.media",
    url: jsonUrl,
    itemCount: items.length,
    eventCount: parsed.events.length,
    holidayCount: parsed.holidays.length,
    parsed
  };
}

function getJsonExportUrl(anchorDate) {
  const targetMonday = getMonday(anchorDate).getTime();
  const currentMonday = getMonday(new Date()).getTime();
  const period = targetMonday > currentMonday ? "nextweek" : "thisweek";
  return `https://nfs.faireconomy.media/ff_calendar_${period}.json`;
}

function applyUiSettings(payload, settings) {
  return Object.assign({}, payload, {
    settings: Object.assign({}, payload.settings || {}, {
      includeEUR: Boolean(settings.includeEUR)
    })
  });
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for Forex Factory page to load."));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function waitForCalendarRowsReady(tabId, timeoutMs = 8000) {
  const startedAt = Date.now();
  let bestScore = -1;
  let best = null;
  let previousSignature = "";
  let stablePolls = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const rows = Array.from(document.querySelectorAll("tr.calendar__row"));
        const daySet = new Set();
        let eventCount = 0;
        for (const tr of rows) {
          const dateText = tr.querySelector("td.calendar__date .date")?.innerText?.replace(/\s+/g, " ").trim() || "";
          if (dateText) daySet.add(dateText);
          const eventTitle = tr.querySelector(".calendar__event-title")?.innerText?.trim() || "";
          if (eventTitle) eventCount += 1;
        }
        return {
          rowCount: rows.length,
          dayCount: daySet.size,
          eventCount,
          bodyText: document.body ? document.body.innerText || "" : ""
        };
      }
    });
    const value = result && result.result ? result.result : { rowCount: 0, dayCount: 0, eventCount: 0, bodyText: "" };
    const signature = `${value.rowCount}:${value.dayCount}:${value.eventCount}`;
    stablePolls = signature === previousSignature ? stablePolls + 1 : 0;
    previousSignature = signature;
    const score = value.rowCount + value.dayCount * 100 + value.eventCount * 10;
    if (score > bestScore) {
      bestScore = score;
      best = Object.assign({ elapsedMs: Date.now() - startedAt }, value);
    }
    if (value.dayCount >= 5 && value.rowCount >= 20 && stablePolls >= 2) {
      return Object.assign({ ok: true, reason: "enough_rows_stable", elapsedMs: Date.now() - startedAt }, value);
    }
    if (/安全验证|Cloudflare|验证您不是自动程序|Please Wait|Just a moment/i.test(value.bodyText || "")) {
      return Object.assign({ ok: false, reason: "cloudflare_or_wait_page", elapsedMs: Date.now() - startedAt }, value);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return Object.assign({
    ok: false,
    reason: "timeout",
    elapsedMs: Date.now() - startedAt
  }, best || { rowCount: 0, dayCount: 0, eventCount: 0, bodyText: "" });
}

function isLikelyPartialPayload(payload) {
  const debug = payload && payload.debug ? payload.debug : {};
  return debug.primarySource === "webpage"
    && debug.ready
    && debug.ready.dayCount >= 5
    && debug.eventCount < PARTIAL_EVENT_THRESHOLD;
}

function scrapeCalendarPage() {
  const blockedMarkers = ["安全验证", "Cloudflare", "验证您不是自动程序", "Please Wait", "Just a moment"];
  const bodyText = document.body ? document.body.innerText || "" : "";
  if (blockedMarkers.some((marker) => bodyText.includes(marker))) {
    return {
      ok: false,
      error: "Forex Factory triggered Cloudflare verification. Open the calendar page manually and complete the check first."
    };
  }

  const rows = [];
  const tableRows = Array.from(document.querySelectorAll("tr.calendar__row"));
  for (const tr of tableRows) {
    const dateText = tr.querySelector("td.calendar__date .date")?.innerText?.replace(/\s+/g, " ").trim() || "";
    const timeText = tr.querySelector("td.calendar__time span")?.innerText?.trim() || "";
    const currency = tr.querySelector("td.calendar__currency span")?.innerText?.trim() || "";
    const impactTitle = tr.querySelector("td.calendar__impact span[title]")?.getAttribute("title") || "";
    const eventTitle = tr.querySelector(".calendar__event-title")?.innerText?.trim() || "";
    if (!dateText && !timeText && !currency && !impactTitle && !eventTitle) {
      continue;
    }
    rows.push({
      dateText,
      timeText,
      currency,
      impactTitle,
      eventTitle
    });
  }

  if (!rows.length) {
    return {
      ok: false,
      error: "No calendar rows were found. Forex Factory may have changed its page structure."
    };
  }

  return {
    ok: true,
    rows,
    debug: {
      rowCount: rows.length,
      dates: Array.from(new Set(rows.map((row) => row.dateText).filter(Boolean))).slice(0, 10),
      firstRows: rows.slice(0, 12)
    }
  };
}

function normalizeWeeklyRows(anchorDate, rows, settings) {
  const anchor = new Date(anchorDate);
  const currentYear = anchor.getFullYear();
  const events = [];
  const holidays = [];
  let currentDay = null;
  let currentTime = "";
  let currentCurrency = "";

  const currencies = new Set(DEFAULT_CURRENCIES);
  if (settings.includeEUR) {
    currencies.add("EUR");
  }

  for (const row of rows) {
    if (row.dateText) {
      currentDay = parseForexFactoryDay(row.dateText, currentYear);
    }

    if (!currentDay || currentDay.getDay() === 0 || currentDay.getDay() === 6) {
      continue;
    }

    if (row.timeText) {
      currentTime = row.timeText;
    }
    if (row.currency) {
      currentCurrency = row.currency;
    }

    const rawTitle = row.eventTitle || "";
    const impact = mapImpact(row.impactTitle || "");

    if (!rawTitle) {
      continue;
    }

    if (rawTitle === "Bank Holiday") {
      if (!["USD", "GBP"].includes(currentCurrency)) {
        continue;
      }
      const market = FF_COUNTRY_TO_MARKET.get(currentCurrency) || currentCurrency || "未知市场";
      holidays.push({
        name: "休市",
        market: `${market}休市`,
        day: toDateKey(currentDay)
      });
      continue;
    }

    if (!currencies.has(currentCurrency)) {
      continue;
    }
    if (!DEFAULT_IMPACTS.has(impact)) {
      continue;
    }
    if (!currentTime || currentTime === "Tentative" || currentTime === "All Day") {
      continue;
    }

    const eventDateTime = combineTime(currentDay, currentTime);
    events.push({
      name: cleanEventName(rawTitle),
      rawTitle,
      currency: currentCurrency,
      impact,
      note: inferNote(rawTitle, impact),
      datetime: eventDateTime.toISOString(),
      dateKey: toDateKey(currentDay),
      hhmm: pad(eventDateTime.getHours()) + ":" + pad(eventDateTime.getMinutes())
    });
  }

  const monday = getMonday(anchor);
  const sunday = getSunday(anchor);
  const startMs = monday.getTime();
  const endMs = sunday.getTime();
  const manualHolidays = getManualMarketScheduleRules(anchor);

  const filteredEvents = events
    .filter((event) => {
      const dt = new Date(event.datetime);
      return dt.getTime() >= startMs && dt.getTime() <= endMs;
    })
    .sort((a, b) => {
      const diff = new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      if (diff !== 0) {
        return diff;
      }
      const priorityDiff = eventPriority(a.name) - eventPriority(b.name);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.name.localeCompare(b.name);
    });

  const filteredHolidays = holidays
    .filter((holiday) => {
      const day = new Date(`${holiday.day}T00:00:00`);
      return day.getTime() >= startMs && day.getTime() <= endMs;
    })
    .sort((a, b) => {
      if (a.day !== b.day) {
        return a.day.localeCompare(b.day);
      }
      const priorityDiff = (HOLIDAY_PRIORITY.get(a.market) || 999) - (HOLIDAY_PRIORITY.get(b.market) || 999);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.market.localeCompare(b.market);
    });

  for (const item of manualHolidays) {
    filteredHolidays.push(item);
  }

  filteredHolidays.sort((a, b) => {
    if (a.day !== b.day) {
      return a.day.localeCompare(b.day);
    }
    const priorityDiff = (HOLIDAY_PRIORITY.get(a.market) || 999) - (HOLIDAY_PRIORITY.get(b.market) || 999);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return (a.displayText || a.market || "").localeCompare(b.displayText || b.market || "");
  });

  return {
    events: filteredEvents,
    holidays: filteredHolidays
  };
}

function normalizeJsonCalendarItems(anchorDate, items, settings) {
  const currencies = new Set(DEFAULT_CURRENCIES);
  if (settings.includeEUR) {
    currencies.add("EUR");
  }

  const monday = getMonday(anchorDate);
  const sunday = getSunday(anchorDate);
  const startMs = monday.getTime();
  const endMs = getEndOfDay(sunday).getTime();
  const events = [];
  const holidays = [];

  for (const item of items) {
    const currency = String(item.country || item.currency || "").trim();
    const rawTitle = String(item.title || item.event || "").replace(/\s+/g, " ").trim();
    const impact = mapImpact(String(item.impact || "").trim());
    const dt = new Date(item.date || item.datetime || "");

    if (!rawTitle || !Number.isFinite(dt.getTime())) {
      continue;
    }
    if (dt.getTime() < startMs || dt.getTime() > endMs) {
      continue;
    }

    if (rawTitle === "Bank Holiday") {
      if (!["USD", "GBP"].includes(currency)) {
        continue;
      }
      const market = FF_COUNTRY_TO_MARKET.get(currency) || currency || "未知市场";
      holidays.push({
        name: "休市",
        market: `${market}休市`,
        day: toDateKey(dt)
      });
      continue;
    }

    if (!currencies.has(currency)) {
      continue;
    }
    if (!DEFAULT_IMPACTS.has(impact)) {
      continue;
    }

    events.push({
      name: cleanEventName(rawTitle),
      rawTitle,
      currency,
      impact,
      note: inferNote(rawTitle, impact),
      datetime: dt.toISOString(),
      dateKey: toDateKey(dt),
      hhmm: pad(dt.getHours()) + ":" + pad(dt.getMinutes())
    });
  }

  const manualHolidays = getManualMarketScheduleRules(anchorDate);
  const filteredHolidays = [...holidays, ...manualHolidays].sort((a, b) => {
    if (a.day !== b.day) {
      return a.day.localeCompare(b.day);
    }
    const priorityDiff = (HOLIDAY_PRIORITY.get(a.market) || 999) - (HOLIDAY_PRIORITY.get(b.market) || 999);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return (a.displayText || a.market || "").localeCompare(b.displayText || b.market || "");
  });

  return {
    events: events.sort((a, b) => {
      const diff = new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      if (diff !== 0) {
        return diff;
      }
      const priorityDiff = eventPriority(a.name) - eventPriority(b.name);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.name.localeCompare(b.name);
    }),
    holidays: filteredHolidays
  };
}

function getManualMarketScheduleRules(anchorDate) {
  const monday = getMonday(anchorDate);
  const sunday = getSunday(anchorDate);
  const startKey = toDateKey(monday);
  const endKey = toDateKey(sunday);

  return MANUAL_MARKET_SCHEDULE_RULES
    .filter((rule) => rule.date >= startKey && rule.date <= endKey)
    .map((rule) => ({
      day: rule.date,
      market: rule.market,
      name: rule.name || "",
      displayText: rule.displayText || "",
      summaryText: rule.summaryText || rule.displayText || "",
      noteText: rule.noteText || rule.summaryText || rule.displayText || ""
    }));
}

function parseForexFactoryDay(text, year) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^([A-Za-z]{3}) ([A-Za-z]{3}) (\d{1,2})$/);
  if (!match) {
    return null;
  }

  const [, , monthText, dayText] = match;
  const month = monthNameToIndex(monthText);
  if (month < 0) {
    return null;
  }
  const date = new Date(year, month, Number(dayText), 0, 0, 0, 0);
  return date;
}

function monthNameToIndex(monthText) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return months.indexOf(String(monthText).toLowerCase());
}

function mapImpact(value) {
  const mapping = {
    "High Impact Expected": "High",
    "Med Impact Expected": "Medium",
    "Medium Impact Expected": "Medium",
    "Low Impact Expected": "Low",
    "Non-Economic": "Holiday"
  };
  return mapping[value] || value || "";
}

function combineTime(day, ffTime) {
  const normalized = ffTime.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (!match) {
    return new Date(day);
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3];
  if (period === "pm" && hours !== 12) {
    hours += 12;
  }
  if (period === "am" && hours === 12) {
    hours = 0;
  }

  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

function cleanEventName(name) {
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  return CLEAN_NAME_MAP.get(cleaned) || cleaned;
}

function inferNote(rawTitle, impact) {
  const lower = String(rawTitle).toLowerCase();
  if (lower.includes("unemployment claims") || lower.includes("jobless claims")) {
    return "fx orange folder";
  }
  if (
    (lower.includes("cpi") || lower.includes("ppi") || lower.includes("services pmi") || lower.includes("ecb press conference")) &&
    (impact === "High" || impact === "Medium")
  ) {
    return "金十三星";
  }
  return "";
}

function eventPriority(name) {
  return NAME_PRIORITY.get(name) || 999;
}

function buildDayCards(anchorDate, events, holidays) {
  const monday = getMonday(anchorDate);
  const eventsByDay = new Map();
  const holidaysByDay = new Map();

  for (const event of events) {
    const list = eventsByDay.get(event.dateKey) || [];
    list.push(event);
    eventsByDay.set(event.dateKey, list);
  }

  for (const holiday of holidays) {
    const list = holidaysByDay.get(holiday.day) || [];
    list.push(holiday);
    holidaysByDay.set(holiday.day, list);
  }

  const cards = [];
  for (let offset = 0; offset < 5; offset += 1) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + offset);
    const dateKey = toDateKey(day);
    const dayEvents = eventsByDay.get(dateKey) || [];
    const dayHolidays = holidaysByDay.get(dateKey) || [];
    cards.push({
      dateKey,
      dateLabel: `${pad(day.getMonth() + 1)}.${pad(day.getDate())}`,
      weekdayLabel: WEEKDAY_CN[(day.getDay() + 6) % 7],
      events: compressEventsForDay(dayEvents),
      holidaySuffix: dayHolidays.length
        ? dayHolidays.map((item) => item.displayText || `${item.market}${item.name || ""}`).join("，")
        : "",
      empty: dayEvents.length === 0
    });
  }

  return cards;
}

function compressEventsForDay(events) {
  const byTime = new Map();
  for (const event of events) {
    const bucket = byTime.get(event.hhmm) || [];
    bucket.push(event);
    byTime.set(event.hhmm, bucket);
  }

  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, bucket]) => {
      const sortedBucket = [...bucket].sort((left, right) => {
        const priorityDiff = eventPriority(left.name) - eventPriority(right.name);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return left.name.localeCompare(right.name);
      });

      const notes = [];
      for (const item of sortedBucket) {
        if (item.note && !notes.includes(item.note)) {
          notes.push(item.note);
        }
      }

      return {
        time,
        items: sortedBucket.map((item, index) => ({
          name: item.name,
          impact: item.impact,
          currency: item.currency,
          note: index === sortedBucket.length - 1 ? notes.join("; ") : ""
        }))
      };
    });
}

function formatWeekText(anchorDate, events, holidays) {
  const days = buildDayCards(anchorDate, events, holidays);
  const monday = getMonday(anchorDate);
  const sunday = getSunday(anchorDate);
  const weekLabel = `Week ${getIsoWeek(monday)}`;
  const lines = [`${formatDate(monday)}-${formatDate(sunday)} ${weekLabel}`, ""];

  for (const day of days) {
    const prefix = `${day.dateLabel} ${day.weekdayLabel}`;
    if (day.empty) {
      lines.push(`${prefix} 无数据${day.holidaySuffix ? `+${day.holidaySuffix}` : ""}`);
      lines.push("");
      continue;
    }

    const firstGroup = day.events[0];
    const firstLine = formatEventLine(firstGroup, true);
    lines.push(`${prefix} ${firstLine}${day.holidaySuffix ? `+${day.holidaySuffix}` : ""}`);
    const continuationIndent = " ".repeat(prefix.length + 1);
    for (let i = 1; i < day.events.length; i += 1) {
      lines.push(`${continuationIndent}${formatEventLine(day.events[i], false)}`);
    }
    lines.push("");
  }

  lines.push(`备注： ${formatHolidayNote(holidays)}`);
  return lines.join("\n").trimEnd();
}

function formatEventLine(group, includeTime) {
  const labels = group.items.map((item, index) => {
    const suffix = item.note ? ` (${item.note})` : "";
    return `${item.name}${suffix}`;
  });

  if (!labels.length) {
    return includeTime ? `${group.time} 无数据` : "无数据";
  }

  const [first, ...rest] = labels;
  if (rest.length === 0) {
    return includeTime ? `${group.time} ${first}` : first;
  }

  return [includeTime ? `${group.time} ${first}` : first, ...rest].join("\n");
}

function formatHolidayNote(holidays) {
  if (!holidays.length) {
    return "本周无假期";
  }
  const marketRules = holidays.filter((holiday) => holiday.noteText);
  if (marketRules.length) {
    const unique = [];
    for (const item of marketRules) {
      if (item.noteText && !unique.includes(item.noteText)) {
        unique.push(item.noteText);
      }
    }
    return `本周其余日期无假期，${unique.join("；")}`;
  }
  return holidays.map((holiday) => holiday.displayText || `${holiday.market}${holiday.name}`).join("、");
}

function formatWeekRange(anchorDate) {
  const monday = getMonday(anchorDate);
  const sunday = getSunday(anchorDate);
  return `${formatDate(monday)}-${formatDate(sunday)}`;
}

function formatDate(date) {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getEndOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(23, 59, 59, 999);
  return date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getIsoWeek(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}
