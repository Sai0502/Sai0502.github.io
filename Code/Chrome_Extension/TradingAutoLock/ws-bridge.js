(function () {
  const MESSAGE_TYPE = 'tradovate-auto-lock:ws-capture';
  const STORAGE_KEY = 'tradovateWsCapture';
  const MAX_FRAMES = 80;
  const MAX_EVENTS = 120;
  const MAX_TRADE_FACTS = 500;
  const TRADE_DAY_START_HOUR_BEIJING = 6;
  const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
  const FLUSH_DELAY_MS = 350;
  let flushTimer = null;

  const state = {
    version: '2026-07-21-position-increase-trade-stats-v9',
    installedAt: new Date().toISOString(),
    pageUrl: safePageUrl(location.href),
    hookReady: false,
    hookReadyAt: '',
    socketCount: 0,
    frameCount: 0,
    inboundCount: 0,
    outboundCount: 0,
    textFrameCount: 0,
    jsonFrameCount: 0,
    binaryFrameCount: 0,
    keywordHitCount: 0,
    keywordCounts: {},
    entityCounts: {},
    lastMessageAt: '',
    lastError: '',
    recentEvents: [],
    recentFrames: [],
    recentTradeFacts: [],
    accountMappings: [],
    tradeStatsByAccount: {},
    tradeStats: {
      dateKeyBeijing: '',
      fillCountToday: 0,
      fillCountLast30m: 0,
      fillCountLast60m: 0,
      entryFillsToday: 0,
      flatToPositionEntriesToday: 0,
      completedTradesToday: 0,
      tradeCountToday: 0,
      hasOpenPositionEstimate: false,
      hasPositionEventStatus: false,
      hasOpenPositionByPositionEvent: false,
      uniqueFillCountKnown: 0,
      note: 'diagnostic only; does not lock account'
    }
  };

  function safePageUrl(url) {
    try {
      const parsed = new URL(String(url), location.href);
      return `${parsed.origin}${parsed.pathname}${parsed.search ? '?query=present' : ''}`;
    } catch (_) {
      return String(url || '').slice(0, 240);
    }
  }

  function sanitizeText(value, max = 1200) {
    return String(value || '')
      .replace(/(authorization|access[_-]?token|token|password|secret)"?\s*[:=]\s*"?[^",}\s]+/gi, '$1:[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, '[JWT_REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
      .slice(0, max);
  }

  function sanitizeObject(value, max = 3000) {
    try {
      return JSON.parse(sanitizeText(JSON.stringify(value || null), max));
    } catch (_) {
      return null;
    }
  }

  function dateKeyInZone(timestamp, timeZone = 'Asia/Shanghai') {
    const ms = Number(timestamp);
    if (!Number.isFinite(ms)) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date(ms));
      const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${map.year}-${map.month}-${map.day}`;
    } catch (_) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function beijingDateKeyFromUtcMs(utcMs) {
    const date = new Date(utcMs + BEIJING_OFFSET_MS);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }

  function tradingDayWindowBeijing(timestamp) {
    const ms = Number(timestamp);
    const safeMs = Number.isFinite(ms) ? ms : Date.now();
    const beijingDate = new Date(safeMs + BEIJING_OFFSET_MS);
    const year = beijingDate.getUTCFullYear();
    const monthIndex = beijingDate.getUTCMonth();
    const day = beijingDate.getUTCDate();
    const hour = beijingDate.getUTCHours();
    const startBeijingUtcMs = hour < TRADE_DAY_START_HOUR_BEIJING
      ? Date.UTC(year, monthIndex, day - 1, TRADE_DAY_START_HOUR_BEIJING)
      : Date.UTC(year, monthIndex, day, TRADE_DAY_START_HOUR_BEIJING);
    const startUtcMs = startBeijingUtcMs - BEIJING_OFFSET_MS;
    const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
    return {
      startUtcMs,
      endUtcMs,
      startAtBeijing: `${beijingDateKeyFromUtcMs(startUtcMs)} ${pad2(TRADE_DAY_START_HOUR_BEIJING)}:00`,
      endAtBeijing: `${beijingDateKeyFromUtcMs(endUtcMs)} ${pad2(TRADE_DAY_START_HOUR_BEIJING)}:00`,
      dateKeyBeijing: beijingDateKeyFromUtcMs(startUtcMs)
    };
  }

  function timestampMs(value) {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : 0;
  }

  function numericValue(value) {
    if (value === null || value === undefined || value === '') return NaN;
    const normalized = String(value).replace(/,/g, '').replace(/−/g, '-').trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }

  function tradeFactKey(fact) {
    if (fact.id !== undefined && fact.id !== null) return `${fact.kind}:${fact.id}`;
    return [
      fact.kind || '',
      fact.accountId || '',
      fact.contractId || '',
      fact.orderId || '',
      fact.timestamp || '',
      fact.action || '',
      fact.qty || fact.orderQty || '',
      fact.price || ''
    ].join(':');
  }

  function normalizeTradeFact(fact) {
    const clean = sanitizeObject(fact, 2200);
    if (!clean || typeof clean !== 'object') return null;
    clean.kind = String(clean.kind || '');
    clean.timestampMs = timestampMs(clean.timestamp) || timestampMs(clean.receivedAt);
    return clean;
  }

  function mergeTradeFacts(facts) {
    if (!Array.isArray(facts) || !facts.length) return;
    const byKey = new Map(state.recentTradeFacts.map(item => [tradeFactKey(item), item]));
    for (const raw of facts) {
      const fact = normalizeTradeFact(raw);
      if (!fact || !fact.kind) continue;
      byKey.set(tradeFactKey(fact), fact);
    }
    state.recentTradeFacts = Array.from(byKey.values())
      .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0))
      .slice(-MAX_TRADE_FACTS);
    recomputeTradeStats();
  }

  function signedFillQty(fill) {
    const qty = Number(fill.qty ?? fill.filledQty ?? fill.orderQty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    const action = String(fill.action || '').toLowerCase();
    if (action.includes('buy')) return qty;
    if (action.includes('sell')) return -qty;
    return 0;
  }

  function accountKey(value) {
    const key = String(value ?? '').trim();
    return key || '';
  }

  function accountDisplayName(account) {
    return accountKey(account.name || account.accountName || account.displayName);
  }

  function accountMappingForId(mappings, id) {
    const key = accountKey(id);
    if (!key) return null;
    return mappings.find(item => accountKey(item.id || item.accountId) === key) || null;
  }

  function buildOrderAccountIndex(mappings) {
    const index = new Map();
    for (const fact of state.recentTradeFacts) {
      if (!fact || fact.kind !== 'order') continue;
      const accountId = accountKey(fact.accountId);
      if (!accountId) continue;
      const mapping = accountMappingForId(mappings, accountId);
      const accountName = mapping ? mapping.name || '' : '';
      for (const key of [fact.id, fact.orderId]) {
        const orderKey = accountKey(key);
        if (!orderKey) continue;
        index.set(orderKey, {
          accountId,
          accountName,
          source: 'order_account'
        });
      }
    }
    return index;
  }

  function accountForFact(fact, orderAccountIndex, mappings) {
    const directAccountId = accountKey(fact && fact.accountId);
    if (directAccountId) {
      const mapping = accountMappingForId(mappings, directAccountId);
      return {
        accountId: directAccountId,
        accountName: mapping ? mapping.name || '' : accountDisplayName(fact),
        source: 'fact_account'
      };
    }

    for (const key of [fact && fact.orderId, fact && fact.id]) {
      const orderKey = accountKey(key);
      if (orderKey && orderAccountIndex.has(orderKey)) {
        return orderAccountIndex.get(orderKey);
      }
    }

    return {
      accountId: '',
      accountName: '',
      source: ''
    };
  }

  function collectAccountMappings() {
    const byId = new Map();
    for (const fact of state.recentTradeFacts) {
      if (!fact || fact.kind !== 'account') continue;
      const id = accountKey(fact.id || fact.accountId);
      if (!id) continue;
      const existing = byId.get(id) || {};
      const name = accountDisplayName(fact) || existing.name || '';
      byId.set(id, {
        id,
        name,
        userId: fact.userId ?? existing.userId ?? null,
        timestamp: fact.timestamp || fact.receivedAt || existing.timestamp || ''
      });
    }
    state.accountMappings = Array.from(byId.values())
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
      .slice(0, 80);
    return state.accountMappings;
  }

  function accountMatchesFact(fact, accountId, orderAccountIndex, mappings) {
    const wanted = accountKey(accountId);
    if (!wanted) return true;
    const inferred = accountForFact(fact, orderAccountIndex, mappings);
    return accountKey(inferred.accountId) === wanted ||
      accountKey(inferred.accountName) === wanted ||
      accountKey(fact.accountId) === wanted ||
      accountKey(fact.id) === wanted ||
      accountDisplayName(fact) === wanted;
  }

  function buildTradeStatsForAccount({ now, tradeDay, accountId = '', accountName = '', mappings = [] }) {
    const dateKeyBeijing = tradeDay.dateKeyBeijing;
    const orderAccountIndex = buildOrderAccountIndex(mappings);
    const fills = state.recentTradeFacts
      .filter(item => item.kind === 'fill')
      .map(item => ({
        ...item,
        __account: accountForFact(item, orderAccountIndex, mappings)
      }))
      .filter(item => !accountId || accountMatchesFact(item, accountId, orderAccountIndex, mappings))
      .filter(item => Number.isFinite(Number(item.timestampMs)) && Number(item.timestampMs) > 0)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    const todayFills = fills.filter(fill => fill.timestampMs >= tradeDay.startUtcMs && fill.timestampMs < tradeDay.endUtcMs);
    const posByKey = {};
    const fillsByContract = {};
    let entryFillsToday = 0;
    let flatToPositionEntriesToday = 0;
    let completedTradesToday = 0;

    for (const fill of todayFills) {
      const signed = signedFillQty(fill);
      if (!signed) continue;
      const fillAccountId = fill.__account && fill.__account.accountId ? fill.__account.accountId : fill.accountId || '';
      const fillAccountName = fill.__account && fill.__account.accountName ? fill.__account.accountName : accountName;
      const key = `${fillAccountId || ''}:${fill.contractId || ''}`;
      const before = Number(posByKey[key]) || 0;
      const after = before + signed;
      if (before === 0 && after !== 0) flatToPositionEntriesToday += 1;
      if (before !== 0 && after === 0) completedTradesToday += 1;
      if (Math.abs(after) > Math.abs(before) && Math.sign(after) === Math.sign(signed)) {
        entryFillsToday += 1;
      }
      posByKey[key] = after;
      if (!fillsByContract[key]) fillsByContract[key] = {
        accountId: fillAccountId,
        accountName: fillAccountName,
        contractId: fill.contractId || '',
        fills: 0,
        accountSource: fill.__account ? fill.__account.source || '' : '',
        netPosEstimate: 0
      };
      fillsByContract[key].fills += 1;
      fillsByContract[key].netPosEstimate = after;
    }

    const openPositionCount = Object.values(posByKey).filter(value => Math.abs(Number(value) || 0) > 0).length;
    const netPositionAbsEstimate = Object.values(posByKey).reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    const positions = state.recentTradeFacts
      .filter(item => item.kind === 'position')
      .filter(item => !accountId || accountMatchesFact(item, accountId, orderAccountIndex, mappings))
      .map((item, index) => ({ ...item, _sortIndex: index }))
      .filter(item => Number.isFinite(numericValue(item.netPos)))
      .sort((a, b) => ((a.timestampMs || 0) - (b.timestampMs || 0)) || (a._sortIndex - b._sortIndex));
    const latestPositionByKey = {};
    for (const position of positions) {
      const key = `${position.accountId || ''}:${position.contractId || position.positionId || position.id || ''}`;
      if (!key.replace(/:/g, '')) continue;
      latestPositionByKey[key] = position;
    }
    const positionsByContract = Object.values(latestPositionByKey).map(position => {
      const netPos = numericValue(position.netPos);
      return {
        accountId: position.accountId || '',
        accountName,
        contractId: position.contractId || '',
        positionId: position.positionId || position.id || '',
        netPos,
        absNetPos: Math.abs(netPos),
        timestamp: position.timestamp || position.receivedAt || '',
        timestampMs: position.timestampMs || 0,
        eventType: position.eventType || '',
        active: position.active ?? null
      };
    });
    const positionOpenCount = positionsByContract.filter(position => Math.abs(Number(position.netPos) || 0) > 0).length;
    const positionNetAbs = positionsByContract.reduce((sum, position) => sum + Math.abs(Number(position.netPos) || 0), 0);
    const lastPositionEventAtMs = positionsByContract.reduce((max, position) => Math.max(max, Number(position.timestampMs) || 0), 0);
    const positionTradeCountEstimate = positions.reduce((max, position) => {
      const bought = numericValue(position.bought);
      const sold = numericValue(position.sold);
      const estimate = Math.max(
        Number.isFinite(bought) ? Math.abs(bought) : 0,
        Number.isFinite(sold) ? Math.abs(sold) : 0
      );
      return Math.max(max, estimate);
    }, 0);
    const positionFillCountEstimate = positions.reduce((max, position) => {
      const bought = numericValue(position.bought);
      const sold = numericValue(position.sold);
      const estimate = (Number.isFinite(bought) ? Math.abs(bought) : 0) +
        (Number.isFinite(sold) ? Math.abs(sold) : 0);
      return Math.max(max, estimate);
    }, 0);
    const tradeCountToday = entryFillsToday;
    const fillCountToday = todayFills.length;

    return {
      accountId,
      accountName,
      accountMappings: mappings,
      dateKeyBeijing,
      tradeDayStartHourBeijing: TRADE_DAY_START_HOUR_BEIJING,
      tradeDayStartAtBeijing: tradeDay.startAtBeijing,
      tradeDayEndAtBeijing: tradeDay.endAtBeijing,
      fillCountToday,
      fillCountLast30m: fills.filter(fill => now - fill.timestampMs <= 30 * 60 * 1000).length,
      fillCountLast60m: fills.filter(fill => now - fill.timestampMs <= 60 * 60 * 1000).length,
      entryFillsToday,
      flatToPositionEntriesToday,
      completedTradesToday,
      tradeCountToday,
      tradeCountSource: 'position_increase_fills',
      positionTradeCountEstimate,
      positionFillCountEstimate,
      openPositionCount,
      netPositionAbsEstimate,
      hasOpenPositionEstimate: openPositionCount > 0,
      hasPositionEventStatus: positionsByContract.length > 0,
      positionOpenCount,
      positionNetAbs,
      hasOpenPositionByPositionEvent: positionOpenCount > 0,
      positionStatusSource: positionsByContract.length > 0 ? 'position_event' : '',
      positionEventCountKnown: positions.length,
      lastPositionEventAt: lastPositionEventAtMs ? new Date(lastPositionEventAtMs).toISOString() : '',
      positionsByContract: positionsByContract.slice(0, 20),
      uniqueFillCountKnown: fills.length,
      fillsByContract: Object.values(fillsByContract).slice(0, 20),
      recentFillsToday: todayFills.slice(-12),
      note: accountId
        ? 'account scoped; tradeCountToday counts position-increase entry fills, including same-direction scale-ins'
        : 'global diagnostic only; content script must use account-scoped stats for locking'
    };
  }

  function recomputeTradeStats() {
    const now = Date.now();
    const tradeDay = tradingDayWindowBeijing(now);
    const mappings = collectAccountMappings();
    const accountIds = new Set();
    for (const fact of state.recentTradeFacts) {
      if (fact && (fact.kind === 'fill' || fact.kind === 'position')) {
        const id = accountKey(fact.accountId);
        if (id) accountIds.add(id);
      }
    }
    for (const account of mappings) {
      if (account.id) accountIds.add(account.id);
    }

    const byAccount = {};
    for (const id of accountIds) {
      const mapping = mappings.find(item => item.id === id) || {};
      const stats = buildTradeStatsForAccount({
        now,
        tradeDay,
        accountId: id,
        accountName: mapping.name || '',
        mappings
      });
      byAccount[id] = stats;
      if (mapping.name) {
        byAccount[mapping.name] = {
          ...stats,
          accountName: mapping.name,
          numericAccountId: id,
          accountMatchedBy: 'account_name'
        };
      }
    }

    state.tradeStatsByAccount = byAccount;
    state.tradeStats = buildTradeStatsForAccount({ now, tradeDay, mappings });
  }

  function pushCapped(list, item, limit) {
    list.push(item);
    while (list.length > limit) list.shift();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: state });
      } catch (err) {
        state.lastError = err && err.message ? err.message : String(err);
      }
    }, FLUSH_DELAY_MS);
  }

  function recordEvent(payload) {
    const receivedAt = new Date(payload.ts || Date.now()).toISOString();
    const tradeFacts = Array.isArray(payload.tradeFacts)
      ? payload.tradeFacts.slice(0, 500).map(item => {
          const clean = sanitizeObject(item, 2200);
          return clean && typeof clean === 'object'
            ? { receivedAt, ...clean }
            : null;
        }).filter(Boolean)
      : [];
    const item = {
      ts: new Date(payload.ts || Date.now()).toISOString(),
      kind: payload.kind || '',
      url: safePageUrl(payload.url || payload.pageUrl || ''),
      socketId: sanitizeText(payload.socketId || '', 120),
      direction: payload.direction || '',
      dataType: payload.dataType || '',
      size: Number(payload.size) || 0,
      keywords: Array.isArray(payload.keywords) ? payload.keywords.slice(0, 12) : [],
      sample: sanitizeText(payload.sample || '', 1200),
      jsonPreview: sanitizeText(payload.jsonPreview || '', 1200),
      snippets: Array.isArray(payload.snippets)
        ? payload.snippets.slice(0, 8).map(item => sanitizeText(item, 540))
        : [],
      entitySummaries: Array.isArray(payload.entitySummaries)
        ? payload.entitySummaries.slice(0, 20).map(item => sanitizeObject(item, 2200)).filter(Boolean)
        : [],
      tradeFactsPreview: tradeFacts.slice(0, 8),
      readyState: payload.readyState ?? null,
      code: payload.code ?? null,
      wasClean: payload.wasClean ?? null,
      reason: sanitizeText(payload.reason || '', 240)
    };

    state.lastMessageAt = item.ts;
    pushCapped(state.recentEvents, item, MAX_EVENTS);

    if (item.kind === 'hook-ready') {
      state.hookReady = true;
      state.hookReadyAt = item.ts;
    }
    if (item.kind === 'socket-created') state.socketCount += 1;
    if (item.kind === 'hook-error' || item.kind === 'socket-error') state.lastError = payload.error || item.kind;

    if (item.kind === 'frame') {
      state.frameCount += 1;
      if (item.direction === 'in') state.inboundCount += 1;
      if (item.direction === 'out') state.outboundCount += 1;
      if (item.dataType === 'string') state.textFrameCount += 1;
      if (payload.json) state.jsonFrameCount += 1;
      if (item.dataType === 'arraybuffer' || item.dataType === 'blob') state.binaryFrameCount += 1;
      if (item.keywords.length) {
        state.keywordHitCount += 1;
        for (const keyword of item.keywords) {
          state.keywordCounts[keyword] = (state.keywordCounts[keyword] || 0) + 1;
        }
      }
      if (item.entitySummaries.length) {
        for (const summary of item.entitySummaries) {
          const key = summary.entityType || summary.kind || 'unknown';
          const amount = Number(summary.count) || 1;
          state.entityCounts[key] = (state.entityCounts[key] || 0) + amount;
        }
      }
      if (tradeFacts.length) {
        mergeTradeFacts(tradeFacts);
      }
      if (item.keywords.length || item.entitySummaries.length || item.dataType !== 'string') {
        pushCapped(state.recentFrames, item, MAX_FRAMES);
      }
    }

    scheduleFlush();
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const payload = event.data || {};
    if (!payload || payload.source !== MESSAGE_TYPE) return;
    recordEvent(payload);
  });

  recordEvent({
    kind: 'bridge-ready',
    ts: Date.now(),
    pageUrl: location.href
  });
})();
