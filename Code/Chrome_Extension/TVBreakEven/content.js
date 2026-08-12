(() => {
  const TVBE_CONTENT_VERSION = '0.3.0-tradovate-api';
  if (window.__tvBreakEvenLoaded === TVBE_CONTENT_VERSION) return;
  window.__tvBreakEvenLoaded = TVBE_CONTENT_VERSION;

  const LINE_IDS = {
    trigger: 'tvbe-trigger-line',
    breakeven: 'tvbe-breakeven-line'
  };
  const LINE_CONFIG = {
    trigger: {
      label: '触发价',
      storageKey: 'triggerPrice',
      color: '#f6c34a',
      textColor: '#fff2bf',
      debugPrefix: 'triggerLine'
    },
    breakeven: {
      label: '推保价',
      storageKey: 'breakevenPrice',
      color: '#36d399',
      textColor: '#d7ffe8',
      debugPrefix: 'breakevenLine'
    }
  };
  const PANEL_ID = 'tvbe-side-panel';
  const VERSION_STAMP = '20260630174930';
  const PRICE_RE = /[-+−]?(?:\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d+)?/g;

  let monitorTimer = null;
  let panelTimer = null;
  let lineSyncTimer = null;
  const lineStates = {};
  let bridgeRequestSeq = 0;

  function nowText() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function parsePrice(value) {
    if (value === null || value === undefined) return null;
    const raw = String(value).replace(/−/g, '-').trim();
    if (!raw) return null;
    const normalized = raw.replace(/,/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function fmt(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return number.toFixed(number >= 100 ? 2 : 4).replace(/\.?0+$/, '');
  }

  function getTitlePriceCandidate() {
    const match = String(document.title || '').match(/^[A-Z0-9:!.\-]+\s+([-+−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/i);
    if (!match) return null;
    const price = parsePrice(match[1]);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, text: `document title ${document.title}` };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeJson(value, spaces = 2) {
    try { return JSON.stringify(value, null, spaces); }
    catch (err) { return String(err && err.message || err); }
  }

  function storageGet(defaults) {
    return chrome.storage.local.get(defaults);
  }

  function storageSet(values) {
    return chrome.storage.local.set(values);
  }

  function safeStorageGet(defaults) {
    return storageGet(defaults).catch(err => {
      if (/Extension context invalidated/i.test(err && err.message || String(err))) stopAllTimers();
      throw err;
    });
  }

  function safeStorageSet(values) {
    return storageSet(values).catch(err => {
      if (/Extension context invalidated/i.test(err && err.message || String(err))) stopAllTimers();
      throw err;
    });
  }

  function stopAllTimers() {
    if (monitorTimer) window.clearInterval(monitorTimer);
    if (panelTimer) window.clearInterval(panelTimer);
    if (lineSyncTimer) window.clearInterval(lineSyncTimer);
    monitorTimer = null;
    panelTimer = null;
    lineSyncTimer = null;
  }

  async function addLog(message, level = 'info') {
    const data = await safeStorageGet({ logs: [] });
    const logs = Array.isArray(data.logs) ? data.logs : [];
    logs.unshift({
      at: Date.now(),
      time: nowText(),
      level,
      message
    });
    await safeStorageSet({ logs: logs.slice(0, 80) });
  }

  async function addDebug(event, details = {}) {
    const data = await safeStorageGet({ debugEvents: [] });
    const debugEvents = Array.isArray(data.debugEvents) ? data.debugEvents : [];
    debugEvents.unshift({
      at: Date.now(),
      time: nowText(),
      event,
      details
    });
    await safeStorageSet({ debugEvents: debugEvents.slice(0, 120) });
  }

  function requestTradovateState(timeoutMs = 800) {
    return requestBridge('get-tradovate-state', { refresh: true }, 'tradovate-state', timeoutMs);
  }

  function requestBridge(type, payload = {}, responseType = '', timeoutMs = 1200) {
    const requestId = `tvbe-${Date.now()}-${++bridgeRequestSeq}`;
    return new Promise(resolve => {
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, timeoutMs);
      function onMessage(event) {
        if (!event.data || event.data.source !== 'tvbe-bridge') return;
        if (responseType && event.data.type !== responseType) return;
        if (event.data.requestId !== requestId) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(event.data.payload || null);
      }
      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'tvbe-content', type, requestId, ...payload }, '*');
    });
  }

  function normalizeRoot(symbol) {
    if (!symbol) return '';
    if (typeof tdvNormalizeSymbol === 'function') return tdvNormalizeSymbol(symbol);
    let sym = String(symbol).toUpperCase();
    if (sym.includes(':')) sym = sym.split(':')[1];
    sym = sym.replace(/\d+!$/, '');
    sym = sym.replace(/[FGHJKMNQUVXZ]\d{1,4}$/, '');
    return sym;
  }

  function getChartSymbolFromDom() {
    const titleMatch = document.title.match(/^([A-Z0-9:!]+)/);
    const toolbar = Array.from(document.querySelectorAll('[data-name*="legend"], [class*="legend"], [class*="symbol"], button, span'))
      .map(textOf)
      .find(text => /^[A-Z0-9]{1,5}\d?!/.test(text) || /^[A-Z]{1,5}[FGHJKMNQUVXZ]\d{1,4}\b/.test(text));
    return toolbar || (titleMatch ? titleMatch[1] : '');
  }

  function signedQty(position) {
    if (!position) return 0;
    const rawQty = Number(position.qty ?? position.netPos ?? position.netQty ?? position.position ?? 0);
    if (!Number.isFinite(rawQty)) return 0;
    if (typeof position.side === 'string' && /sell|short/i.test(position.side)) return -Math.abs(rawQty);
    return rawQty;
  }

  function orderPrice(order) {
    const value = order && (order.stopPrice ?? order.limitPrice ?? order.price);
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function orderTypeText(order) {
    return String(order && (order.type || order.ordType || order.orderType || order.order_type) || '').toLowerCase();
  }

  function orderIsStop(order) {
    const type = orderTypeText(order);
    if (/limit/.test(type) && !/stop/.test(type)) return false;
    if (/stop/.test(type)) return true;
    const stopPrice = Number(order && order.stopPrice);
    return Number.isFinite(stopPrice) && stopPrice > 0;
  }

  function orderIsTakeProfit(order) {
    const type = orderTypeText(order);
    if (/stop/.test(type)) return false;
    if (/limit|profit|target|takeprofit|take_profit/.test(type)) return true;
    const text = JSON.stringify({
      bracketType: order && order.bracketType,
      role: order && order.role,
      label: order && order.label,
      name: order && order.name
    }).toLowerCase();
    return /profit|target|takeprofit|take_profit|止盈/.test(text);
  }

  function orderIsWorking(order) {
    const status = String(order && (order.status || order.ordStatus || order.orderStatus) || '').toLowerCase();
    return !status || ['working', 'pending', 'pendingnew', 'accepted'].includes(status);
  }

  function deriveCurrentPriceFromPosition(position) {
    if (!position) return null;
    const avg = Number(position.avgPrice ?? position.averagePrice ?? position.netPrice ?? position.entryPrice);
    const pnl = Number(position.unrealizedPl ?? position.openPl);
    const qty = Math.abs(signedQty(position));
    const spec = typeof tdvGetContractSpec === 'function' ? tdvGetContractSpec(position.instrument || position.symbol) : null;
    if (!Number.isFinite(avg) || !Number.isFinite(pnl) || !qty || !spec || !spec.pointValue) return null;
    const side = signedQty(position) < 0 ? -1 : 1;
    return avg + (pnl / (Number(spec.pointValue) * qty)) * side;
  }

  function pickActiveOrderSnapshot(bridge) {
    if (!bridge || !bridge.state) return null;
    const chartRoot = normalizeRoot(bridge.chartSymbol || getChartSymbolFromDom());
    let best = null;
    for (const accountId of Object.keys(bridge.state)) {
      const account = bridge.state[accountId] || {};
      const positions = Array.isArray(account.positions) ? account.positions : [];
      const orders = Array.isArray(account.orders) ? account.orders : [];
      for (const position of positions) {
        const qty = signedQty(position);
        if (!qty) continue;
        const root = normalizeRoot(position.instrument || position.symbol);
        if (chartRoot && root && chartRoot !== root) continue;
        const avg = Number(position.avgPrice ?? position.averagePrice ?? position.netPrice ?? position.entryPrice);
        const side = qty < 0 ? 'short' : 'long';
        const relatedOrders = orders.filter(order => {
          const orderRoot = normalizeRoot(order.instrument || order.symbol || position.instrument || position.symbol);
          return orderIsWorking(order) && (!root || !orderRoot || orderRoot === root);
        });
        const protectiveStops = relatedOrders
          .filter(order => orderIsStop(order) && !orderIsTakeProfit(order))
          .filter(order => {
            const price = orderPrice(order);
            if (!Number.isFinite(price) || !Number.isFinite(avg)) return true;
            if (side === 'long') return price < avg;
            return price > avg;
          });
        const takeProfits = relatedOrders
          .filter(order => orderIsTakeProfit(order) && !orderIsStop(order))
          .filter(order => {
            const price = orderPrice(order);
            if (!Number.isFinite(price) || !Number.isFinite(avg)) return true;
            if (side === 'long') return price > avg;
            return price < avg;
          });
        const stopOrder = protectiveStops[0] || relatedOrders.find(order => orderIsStop(order) && !orderIsTakeProfit(order)) || null;
        const takeProfitOrder = takeProfits[0] || relatedOrders.find(order => orderIsTakeProfit(order) && !orderIsStop(order)) || null;
        const snapshot = {
          source: 'tradovate-bridge',
          accountId,
          symbol: position.instrument || position.symbol || '',
          side,
          qty: Math.abs(qty),
          entryPrice: Number.isFinite(avg) ? avg : null,
          stopOrderId: stopOrder ? String(stopOrder.id || stopOrder.orderId || '') : '',
          stopPrice: stopOrder ? orderPrice(stopOrder) : null,
          takeProfitOrderId: takeProfitOrder ? String(takeProfitOrder.id || takeProfitOrder.orderId || '') : '',
          takeProfitPrice: takeProfitOrder ? orderPrice(takeProfitOrder) : null,
          rawPosition: position,
          rawStopOrder: stopOrder,
          rawTakeProfitOrder: takeProfitOrder,
          lastUpdate: account.lastUpdate || 0
        };
        if (!best || snapshot.lastUpdate > best.lastUpdate) best = snapshot;
      }
    }
    return best;
  }

  function getConnectionStatus(snapshot) {
    const bridge = snapshot && snapshot.bridgeStatus;
    const hints = snapshot && snapshot.textHints;
    const hasTradovateBridge = Boolean(
      bridge &&
      (bridge.loggedIn || bridge.accountStateCount > 0 || bridge.accounts > 0)
    );
    if (hasTradovateBridge) {
      return {
        key: 'tradovate',
        text: '已连接 Tradovate',
        orderCapable: true,
        autoCapable: true
      };
    }
    if (hints && hints.hasPaperTrading) {
      return {
        key: 'paper',
        text: '检测到 Paper Trading（暂未支持自动接管）',
        orderCapable: false,
        autoCapable: false
      };
    }
    return {
      key: 'none',
      text: '未获取到任何连接',
      orderCapable: false,
      autoCapable: false
    };
  }

  function textOf(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function collectPriceCandidates() {
    const candidates = [];
    const nodes = [
      ...document.querySelectorAll('[class*="last"], [class*="price"], [class*="value"], [data-name], [aria-label], [title]')
    ].filter(visible).slice(0, 900);

    for (const el of nodes) {
      if (el.closest(`#${PANEL_ID}, .tvbe-price-line-overlay`)) continue;
      const raw = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('data-name') || ''} ${textOf(el)}`.trim();
      if (!raw || raw.length > 220) continue;
      const matches = raw.match(PRICE_RE);
      if (!matches) continue;
      for (const match of matches) {
        const price = parsePrice(match);
        if (!Number.isFinite(price) || price <= 0) continue;
        candidates.push({
          price,
          text: raw.slice(0, 180)
        });
      }
    }

    const bodyText = textOf(document.body).slice(0, 5000);
    const matches = bodyText.match(PRICE_RE) || [];
    for (const match of matches.slice(0, 80)) {
      const price = parsePrice(match);
      if (Number.isFinite(price) && price > 0) candidates.push({ price, text: 'body text candidate' });
    }

    return candidates;
  }

  function collectLabeledPriceCandidates(keywords) {
    const candidates = [];
    const nodes = [
      ...document.querySelectorAll('[class], [data-name], [aria-label], [title], span, div, button')
    ].filter(visible).slice(0, 1200);

    for (const el of nodes) {
      const raw = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        el.getAttribute('data-name') || '',
        el.className && typeof el.className === 'string' ? el.className : '',
        textOf(el)
      ].join(' ').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 260 || !keywords.test(raw)) continue;
      const matches = raw.match(PRICE_RE);
      if (!matches) continue;
      for (const match of matches) {
        const price = parsePrice(match);
        if (!Number.isFinite(price) || price <= 0) continue;
        candidates.push({
          price,
          text: raw.slice(0, 220)
        });
      }
    }

    return candidates;
  }

  function scorePriceCandidate(candidate) {
    const text = candidate.text.toLowerCase();
    let score = 0;
    if (/document title/i.test(candidate.text)) score += 40;
    if (/last|最新|当前|price|价格/.test(text)) score += 6;
    if (/收=|close|last price|最新价|当前价/.test(text)) score += 6;
    if (/bid|ask|买|卖/.test(text)) score += 2;
    if (/开=|高=|低=|收=|open|high|low|close|图表 #/i.test(candidate.text)) score -= 18;
    if (/pnl|盈亏|qty|数量|volume|成交量|保证金|margin|杠杆|leverage|tick|ticks/.test(text)) score -= 8;
    if (candidate.price > 1000 && candidate.price < 100000) score += 4;
    return score;
  }

  function getCurrentPrice() {
    const title = getTitlePriceCandidate();
    if (title) return title;
    const candidates = collectPriceCandidates()
      .sort((a, b) => scorePriceCandidate(b) - scorePriceCandidate(a));
    return candidates[0] || null;
  }

  function debugPriceCandidates() {
    const title = getTitlePriceCandidate();
    return [
      ...(title ? [title] : []),
      ...collectPriceCandidates()
    ]
      .sort((a, b) => scorePriceCandidate(b) - scorePriceCandidate(a))
      .slice(0, 12)
      .map(item => ({
        price: item.price,
        score: scorePriceCandidate(item),
        text: item.text
      }));
  }

  function scoreEntryPriceCandidate(candidate) {
    const text = candidate.text.toLowerCase();
    let score = 0;
    if (/entry\s*price|avg\.?\s*price|average\s*price|avg\s*fill|open\s*price/.test(text)) score += 10;
    if (/开仓价|开仓价格|入场价|入场价格|成交均价|持仓均价|平均价格|成本价|均价/.test(candidate.text)) score += 10;
    if (/position|持仓|头寸/.test(text)) score += 2;
    if (/stop|loss|profit|take profit|止损|止盈|保证金|margin|leverage|杠杆|tick|ticks|qty|quantity|数量|市价|限价/.test(text)) score -= 8;
    if (candidate.price > 1000 && candidate.price < 10000) score += 4;
    return score;
  }

  function getEntryPrice() {
    const entryKeywords = /entry\s*price|avg\.?\s*price|average\s*price|avg\s*fill|open\s*price|开仓价|开仓价格|入场价|入场价格|成交均价|持仓均价|平均价格|成本价|均价/i;
    const candidates = collectLabeledPriceCandidates(entryKeywords)
      .sort((a, b) => scoreEntryPriceCandidate(b) - scoreEntryPriceCandidate(a));
    const best = candidates[0];
    if (!best || scoreEntryPriceCandidate(best) < 8) return null;
    return best;
  }

  async function inferPositionSnapshot() {
    const bridge = await requestTradovateState();
    const orderSnapshot = pickActiveOrderSnapshot(bridge);
    const text = textOf(document.body);
    const current = getCurrentPrice();
    const entry = getEntryPrice();
    const lower = text.toLowerCase();
    const side = /short|sell|空/.test(lower) && !/long|buy|多/.test(lower) ? 'short' : 'unknown';
    const side2 = orderSnapshot ? orderSnapshot.side : (/long|buy|多/.test(lower) ? 'long' : side);
    const currentPrice = current ? current.price : null;
    return {
      url: location.href,
      title: document.title,
      currentPrice,
      currentPriceSource: current ? current.text : '',
      entryPrice: orderSnapshot && Number.isFinite(orderSnapshot.entryPrice)
        ? orderSnapshot.entryPrice
        : (entry ? entry.price : null),
      entryPriceSource: orderSnapshot && Number.isFinite(orderSnapshot.entryPrice)
        ? 'tradovate position avgPrice'
        : (entry ? entry.text : ''),
      orderSnapshot,
      bridgeStatus: bridge ? {
        loggedIn: Boolean(bridge.auth && bridge.auth.loggedIn),
        accounts: Array.isArray(bridge.accounts) ? bridge.accounts.length : 0,
        accountStateCount: bridge.state ? Object.keys(bridge.state).length : 0,
        ts: bridge.ts || null
      } : null,
      sideHint: side2,
      textHints: {
        hasTradovate: /tradovate/i.test(text),
        hasPaperTrading: /paper trading/i.test(text),
        hasPosition: /position|持仓|头寸/i.test(text),
        hasStop: /stop|止损/i.test(text),
        hasProfit: /profit|take profit|止盈/i.test(text)
      }
    };
  }

  function ensureLineStyles() {
    if (document.getElementById('tvbe-style')) return;
    const style = document.createElement('style');
    style.id = 'tvbe-style';
    style.textContent = `
      .tvbe-price-line-overlay {
        position: fixed;
        left: 0;
        right: 0;
        height: 0;
        z-index: 2147483645;
        pointer-events: none;
      }
      .tvbe-price-line-overlay .tvbe-line {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        border-top: 2px dashed var(--tvbe-line-color);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
      }
      .tvbe-price-line-overlay .tvbe-handle {
        position: absolute;
        right: 18px;
        top: -16px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        border: 1px solid var(--tvbe-line-color);
        border-radius: 7px;
        background: rgba(13, 18, 25, 0.96);
        color: var(--tvbe-line-text);
        font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        pointer-events: auto;
        cursor: grab;
        user-select: none;
      }
      #${PANEL_ID} {
        position: fixed;
        top: 72px;
        right: 74px;
        width: 430px;
        max-height: min(780px, calc(100vh - 96px));
        overflow: auto;
        z-index: 2147483646;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #101419;
        color: #eef3f8;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.38);
        font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      #${PANEL_ID} * {
        box-sizing: border-box;
      }
      #${PANEL_ID} .tvbe-panel-header,
      #${PANEL_ID} .tvbe-panel-section {
        padding: 8px;
        border-bottom: 1px solid #2b3542;
      }
      #${PANEL_ID} .tvbe-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        cursor: move;
        user-select: none;
        background: #0d1218;
      }
      #${PANEL_ID} .tvbe-panel-title {
        font-weight: 900;
        font-size: 14px;
      }
      #${PANEL_ID} .tvbe-line-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        align-items: center;
        padding: 7px 8px;
        border-bottom: 1px solid #2b3542;
      }
      #${PANEL_ID} .tvbe-line-row:last-child {
        border-bottom: 0;
      }
      #${PANEL_ID} .tvbe-line-row.tvbe-single {
        grid-template-columns: 1fr;
      }
      #${PANEL_ID} .tvbe-field {
        min-width: 0;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 7px;
      }
      #${PANEL_ID} .tvbe-field.tvbe-stack {
        grid-template-columns: 1fr;
        gap: 3px;
      }
      #${PANEL_ID} .tvbe-field-label {
        color: #95a3b3;
        font-size: 12px;
        white-space: nowrap;
      }
      #${PANEL_ID} .tvbe-field-value {
        min-width: 0;
        min-height: 30px;
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border: 1px solid #2b3542;
        border-radius: 7px;
        background: #0c1117;
        color: #eef3f8;
        font-weight: 850;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PANEL_ID} .tvbe-field-value.tvbe-big {
        font-size: 20px;
        font-weight: 950;
      }
      #${PANEL_ID} .tvbe-field-value.tvbe-disabled {
        opacity: 0.45;
      }
      #${PANEL_ID} .tvbe-status-pill {
        border-color: #2b3542;
        color: #95a3b3;
      }
      #${PANEL_ID} .tvbe-status-pill.tvbe-ok {
        border-color: rgba(54, 211, 153, 0.65);
        color: #d7ffe8;
      }
      #${PANEL_ID} .tvbe-status-pill.tvbe-warn {
        border-color: rgba(246, 195, 74, 0.65);
        color: #fff2bf;
      }
      #${PANEL_ID} .tvbe-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
      }
      #${PANEL_ID} details.tvbe-collapsible > summary {
        list-style: none;
      }
      #${PANEL_ID} details.tvbe-collapsible > summary::-webkit-details-marker {
        display: none;
      }
      #${PANEL_ID} details.tvbe-collapsible .tvbe-section-title::before {
        content: "▸ ";
        color: #95a3b3;
      }
      #${PANEL_ID} details.tvbe-collapsible[open] .tvbe-section-title::before {
        content: "▾ ";
      }
      #${PANEL_ID} details.tvbe-collapsible .tvbe-log,
      #${PANEL_ID} details.tvbe-collapsible .tvbe-debug {
        margin-top: 7px;
      }
      #${PANEL_ID} .tvbe-mini-button {
        min-height: 24px;
        padding: 2px 8px;
        font-size: 12px;
        border-color: #2b3542;
        background: #1a2430;
        color: #eef3f8;
      }
      #${PANEL_ID} .tvbe-version {
        color: #95a3b3;
        font-size: 11px;
        font-weight: 700;
      }
      #${PANEL_ID} button {
        min-height: 30px;
        border: 1px solid #64a8ff;
        border-radius: 7px;
        background: #64a8ff;
        color: #07111f;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
      }
      #${PANEL_ID} button:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }
      #${PANEL_ID} button.tvbe-secondary {
        border-color: #2b3542;
        background: #1a2430;
        color: #eef3f8;
      }
      #${PANEL_ID} button.tvbe-danger {
        border-color: #ff3b3b;
        background: #ff3b3b;
        color: white;
      }
      #${PANEL_ID} button.tvbe-active {
        border-color: #36d399;
        background: #36d399;
        color: #07111f;
      }
      #${PANEL_ID} .tvbe-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      #${PANEL_ID} .tvbe-row {
        display: grid;
        grid-template-columns: 88px 1fr;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        margin-bottom: 7px;
      }
      #${PANEL_ID} .tvbe-row:last-child {
        margin-bottom: 0;
      }
      #${PANEL_ID} .tvbe-readonly {
        min-height: 31px;
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border: 1px solid #2b3542;
        border-radius: 7px;
        background: #0c1117;
        color: #eef3f8;
        font-weight: 800;
      }
      #${PANEL_ID} .tvbe-readonly.tvbe-disabled {
        opacity: 0.45;
      }
      #${PANEL_ID} .tvbe-connection {
        margin-top: 8px;
        padding: 7px 8px;
        border: 1px solid #2b3542;
        border-radius: 7px;
        background: #0c1117;
        color: #95a3b3;
        font-weight: 800;
      }
      #${PANEL_ID} .tvbe-connection.tvbe-ok {
        border-color: rgba(54, 211, 153, 0.55);
        color: #d7ffe8;
      }
      #${PANEL_ID} .tvbe-connection.tvbe-warn {
        border-color: rgba(246, 195, 74, 0.55);
        color: #fff2bf;
      }
      #${PANEL_ID} .tvbe-order-hint {
        margin: 0 0 8px;
        color: #f6c34a;
        font-size: 12px;
        line-height: 1.35;
        display: none;
      }
      #${PANEL_ID} .tvbe-order-hint.tvbe-show {
        display: block;
      }
      #${PANEL_ID} .tvbe-order-line {
        display: grid;
        gap: 4px;
        margin-top: 8px;
        padding: 8px;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #151b22;
      }
      #${PANEL_ID} .tvbe-order-mini {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
        color: #95a3b3;
      }
      #${PANEL_ID} .tvbe-order-mini span {
        padding: 7px 8px;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #0c1117;
      }
      #${PANEL_ID} .tvbe-card {
        display: grid;
        gap: 4px;
        padding: 8px;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #151b22;
      }
      #${PANEL_ID} .tvbe-card.tvbe-running {
        border-color: #f6c34a;
        background: rgba(246, 195, 74, 0.16);
      }
      #${PANEL_ID} .tvbe-card.tvbe-triggered {
        border-color: #36d399;
        background: rgba(54, 211, 153, 0.16);
      }
      #${PANEL_ID} .tvbe-field-value.tvbe-running {
        border-color: #f6c34a;
        background: rgba(246, 195, 74, 0.16);
      }
      #${PANEL_ID} .tvbe-field-value.tvbe-triggered {
        border-color: #36d399;
        background: rgba(54, 211, 153, 0.16);
      }
      #${PANEL_ID} .tvbe-muted {
        color: #95a3b3;
        font-size: 12px;
      }
      #${PANEL_ID} .tvbe-value {
        font-weight: 900;
        font-size: 20px;
      }
      #${PANEL_ID} label {
        display: grid;
        grid-template-columns: 88px 1fr;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${PANEL_ID} input,
      #${PANEL_ID} select {
        width: 100%;
        min-height: 31px;
        border: 1px solid #2b3542;
        border-radius: 7px;
        padding: 5px 8px;
        background: #0c1117;
        color: #eef3f8;
        font: inherit;
      }
      #${PANEL_ID} .tvbe-actions {
        display: flex;
        justify-content: center;
        gap: 8px;
      }
      #${PANEL_ID} .tvbe-actions button {
        width: min(260px, 52%);
      }
      #${PANEL_ID} .tvbe-action-wide {
        grid-column: 1 / -1;
      }
      #${PANEL_ID} .tvbe-log {
        max-height: 130px;
        overflow: auto;
        padding: 8px;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #0c1117;
        color: #95a3b3;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 12px;
        line-height: 1.45;
      }
      #${PANEL_ID} .tvbe-debug {
        max-height: 210px;
        overflow: auto;
        padding: 8px;
        border: 1px solid #2b3542;
        border-radius: 8px;
        background: #070b10;
        color: #a9b8ca;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 11px;
        line-height: 1.38;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getChartRect() {
    const rects = Array.from(document.querySelectorAll('canvas'))
      .map(canvas => canvas.getBoundingClientRect())
      .filter(rect => rect.width > 260 && rect.height > 220)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return rects[0] || {
      top: 80,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight - 120,
      right: window.innerWidth,
      bottom: window.innerHeight - 40
    };
  }

  function collectAxisLabels(chartRect) {
    const labels = [];
    const seen = new Set();
    const elements = Array.from(document.querySelectorAll('span, div, button, [aria-label], [title]'));
    for (const el of elements) {
      if (!visible(el) || el.closest(`#${PANEL_ID}, .tvbe-price-line-overlay`)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < chartRect.top - 12 || rect.top > chartRect.bottom + 12) continue;
      if (rect.left < window.innerWidth * 0.28 && rect.right < chartRect.right - 80) continue;
      const raw = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        textOf(el)
      ].join(' ').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 48 || /[%$]|tick|ticks|杠杆|保证金|margin|qty|数量/i.test(raw)) continue;
      const matches = raw.match(PRICE_RE) || [];
      if (matches.length !== 1) continue;
      const price = parsePrice(matches[0]);
      if (!Number.isFinite(price) || price <= 0 || price > 1000000) continue;
      const y = rect.top + rect.height / 2;
      const key = `${Math.round(y)}:${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push({ y, price, text: raw.slice(0, 48) });
    }
    return labels.sort((a, b) => a.y - b.y);
  }

  function buildPriceMapper() {
    const chartRect = getChartRect();
    const labels = collectAxisLabels(chartRect);
    let best = null;
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const dy = Math.abs(labels[j].y - labels[i].y);
        const dp = Math.abs(labels[j].price - labels[i].price);
        if (dy < 80 || dp <= 0) continue;
        const directionOk = labels[i].price > labels[j].price;
        if (!directionOk) continue;
        const score = dy + dp;
        if (!best || score > best.score) best = { a: labels[i], b: labels[j], score };
      }
    }

    if (best) {
      const { a, b } = best;
      const slope = (b.price - a.price) / (b.y - a.y);
      return {
        chartRect,
        labels,
        source: 'price-axis',
        priceFromY: y => a.price + (y - a.y) * slope,
        yFromPrice: price => a.y + (price - a.price) / slope
      };
    }

    const current = getCurrentPrice();
    const centerPrice = current ? current.price : 100;
    const visibleRange = Math.max(centerPrice * 0.01, 10);
    const topPrice = centerPrice + visibleRange;
    const bottomPrice = centerPrice - visibleRange;
    return {
      chartRect,
      labels,
      source: 'fallback-current-price',
      priceFromY: y => {
        const ratio = Math.max(0, Math.min(1, (y - chartRect.top) / chartRect.height));
        return topPrice + (bottomPrice - topPrice) * ratio;
      },
      yFromPrice: price => {
        const ratio = (price - topPrice) / (bottomPrice - topPrice);
        return chartRect.top + Math.max(0, Math.min(1, ratio)) * chartRect.height;
      }
    };
  }

  function clampY(kind, y) {
    const state = lineStates[kind];
    const rect = state.mapper.chartRect;
    return Math.max(rect.top + 8, Math.min(rect.top + rect.height - 8, y));
  }

  function priceFromY(kind, y) {
    const state = lineStates[kind];
    if (!state) return null;
    state.mapper = buildPriceMapper();
    return state.mapper.priceFromY(y);
  }

  function updateLineLabel(kind) {
    const overlay = document.getElementById(LINE_IDS[kind]);
    const state = lineStates[kind];
    if (!overlay || !state) return;
    const label = overlay.querySelector('.tvbe-price');
    const price = priceFromY(kind, state.y);
    if (label) label.textContent = fmt(price);
  }

  function removePriceLine(kind) {
    document.getElementById(LINE_IDS[kind])?.remove();
    delete lineStates[kind];
  }

  async function persistLinePrice(kind) {
    const state = lineStates[kind];
    if (!state) return null;
    const config = LINE_CONFIG[kind];
    const price = priceFromY(kind, state.y);
    const formatted = fmt(price);
    await safeStorageSet({ [config.storageKey]: formatted });
    await addDebug(`${config.debugPrefix}:update`, {
      price: formatted,
      y: state.y,
      mapperSource: state.mapper.source,
      axisLabels: state.mapper.labels.slice(0, 12)
    });
    return formatted;
  }

  async function createPriceLine(kind) {
    ensureLineStyles();
    const config = LINE_CONFIG[kind];
    const existing = document.getElementById(LINE_IDS[kind]);
    if (existing && lineStates[kind]) {
      updateLineLabel(kind);
      return { ok: true, currentPrice: getCurrentPrice()?.price ?? null, reused: true };
    }

    const mapper = buildPriceMapper();
    const data = await safeStorageGet({ [config.storageKey]: '' });
    const savedPrice = parsePrice(data[config.storageKey]);
    const y = Number.isFinite(savedPrice) && savedPrice > 0
      ? mapper.yFromPrice(savedPrice)
      : mapper.chartRect.top + mapper.chartRect.height / 2 + (kind === 'breakeven' ? 42 : 0);
    lineStates[kind] = {
      mapper,
      y: Math.max(mapper.chartRect.top + 8, Math.min(mapper.chartRect.top + mapper.chartRect.height - 8, y))
    };

    const overlay = document.createElement('div');
    overlay.id = LINE_IDS[kind];
    overlay.className = 'tvbe-price-line-overlay';
    overlay.style.setProperty('--tvbe-line-color', config.color);
    overlay.style.setProperty('--tvbe-line-text', config.textColor);
    overlay.style.top = `${lineStates[kind].y}px`;
    overlay.innerHTML = `
      <div class="tvbe-line"></div>
      <div class="tvbe-handle">
        <span>${config.label}</span>
        <strong class="tvbe-price"></strong>
      </div>
    `;
    document.documentElement.appendChild(overlay);
    updateLineLabel(kind);
    persistLinePrice(kind);

    const handle = overlay.querySelector('.tvbe-handle');
    let dragging = false;

    const moveTo = clientY => {
      lineStates[kind].y = clampY(kind, clientY);
      overlay.style.top = `${lineStates[kind].y}px`;
      updateLineLabel(kind);
      persistLinePrice(kind);
    };

    handle.addEventListener('pointerdown', event => {
      dragging = true;
      handle.setPointerCapture(event.pointerId);
      handle.style.cursor = 'grabbing';
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging) return;
      moveTo(event.clientY);
    });
    handle.addEventListener('pointerup', event => {
      dragging = false;
      handle.releasePointerCapture(event.pointerId);
      handle.style.cursor = 'grab';
      persistLinePrice(kind).then(price => {
        if (price) addLog(`图表水平线更新${config.label} ${price}`, 'info');
      });
    });

    addDebug(`${config.debugPrefix}:create`, {
      currentPrice: getCurrentPrice()?.price ?? null,
      chartRect: mapper.chartRect,
      mapperSource: mapper.source,
      axisLabels: mapper.labels.slice(0, 12)
    });
    return { ok: true, currentPrice: getCurrentPrice()?.price ?? null };
  }

  function reachedTrigger(side, currentPrice, triggerPrice) {
    if (!Number.isFinite(currentPrice) || !Number.isFinite(triggerPrice)) return false;
    if (side === 'short') return currentPrice <= triggerPrice;
    return currentPrice >= triggerPrice;
  }

  async function notify(title, message) {
    try {
      await chrome.runtime.sendMessage({ type: 'tvbe:notify', title, message });
    } catch (_err) {
      // Notifications are a convenience. The on-page alert is the fallback.
    }
    window.alert(`${title}\n\n${message}`);
  }

  async function executeMoveStop(settings, currentPrice) {
    if (settings.executionMode !== 'auto') {
      await notify(
        'TVBreakEven 已触发',
        `价格 ${fmt(currentPrice)} 已触发 ${settings.side === 'short' ? '空单' : '多单'} 推保。请把止损移动到 ${fmt(settings.breakevenPrice)}。`
      );
      return { ok: false, assisted: true, reason: 'assist mode' };
    }

    const result = await moveTradovateStopToPrice(settings);
    if (!result.ok) {
      await notify(
        'TVBreakEven 自动推保失败',
        `价格已触发，但没有确认止损移动成功。请手动把止损移动到 ${fmt(settings.breakevenPrice)}。原因：${result.reason}`
      );
    }
    return result;
  }

  async function moveTradovateStopToPrice(settings) {
    const stored = await safeStorageGet({ lastOrderSnapshot: null, lastSnapshot: null });
    const connection = getConnectionStatus(stored.lastSnapshot || {});
    if (connection.key !== 'tradovate') {
      return { ok: false, reason: '自动改单当前只支持已连接 Tradovate；Paper Trading 暂未找到稳定改单接口' };
    }
    const order = stored.lastOrderSnapshot || null;
    if (!order) return { ok: false, reason: '没有读到当前持仓订单，不能确定要修改哪一张止损单' };
    if (!order.stopOrderId) return { ok: false, reason: '没有读到止损单 ID，不能自动改单' };
    if (!order.accountId) return { ok: false, reason: '没有读到账号 ID，不能自动改单' };
    const result = await requestBridge('modify-stop-order', {
      accountId: order.accountId,
      orderId: order.stopOrderId,
      stopPrice: settings.breakevenPrice,
      rawOrder: order.rawStopOrder || null
    }, 'modify-stop-order-result', 6000);
    if (!result) return { ok: false, reason: 'Tradovate 桥接无响应' };
    if (!result.ok) return { ok: false, reason: result.error || 'Tradovate 改止损返回失败', detail: result };
    const verify = await refreshOrderSnapshot().catch(() => null);
    const newStop = verify && verify.order ? Number(verify.order.stopPrice) : null;
    const target = Number(settings.breakevenPrice);
    const verified = Number.isFinite(newStop) && Math.abs(newStop - target) < 0.00001;
    if (!verified) {
      return {
        ok: false,
        method: 'tradovate-api-put-order',
        verified,
        newStop,
        response: result,
        reason: `Tradovate 已返回改单响应，但复查止损价未变成 ${fmt(target)}，当前读到 ${fmt(newStop)}`
      };
    }
    return { ok: true, method: 'tradovate-api-put-order', verified, newStop, response: result };
  }

  async function getPanelData() {
    const data = await safeStorageGet({
      enabled: false,
      triggerPrice: '',
      breakevenPrice: '',
      side: 'long',
      executionMode: 'auto',
      triggered: false,
      startedAt: null,
      triggeredAt: null,
      lastCurrentPrice: null,
      lastSnapshot: null,
      lastOrderSnapshot: null,
      lastExecutionResult: null,
      linesVisible: false,
      testLinesVisible: false,
      logs: [],
      debugEvents: []
    });
    if (data.executionMode !== 'auto') {
      data.executionMode = 'auto';
      safeStorageSet({ executionMode: 'auto' }).catch(() => {});
    }
    return data;
  }

  function cleanPriceText(value) {
    return String(value || '').replace(/[^\d.,\-−]/g, '');
  }

  async function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const data = await getPanelData();
    const stateText = data.enabled ? '监控中' : '未启动';
    panel.querySelector('[data-tvbe-current]').textContent = fmt(data.lastCurrentPrice);
    const order = data.lastOrderSnapshot || {};
    const snapshot = data.lastSnapshot || {};
    const connection = getConnectionStatus(snapshot);
    const hasOrder = Boolean(order && order.symbol);
    const disabled = !connection.orderCapable || !hasOrder;
    const connectionText = connection.key === 'tradovate'
      ? (hasOrder ? '已连接 Tradovate' : '已连接 Tradovate，但未获取到订单信息')
      : '未连接到任何交易所';
    const connectionEl = panel.querySelector('[data-tvbe-connection]');
    connectionEl.textContent = connectionText;
    connectionEl.className = `tvbe-field-value tvbe-status-pill ${connection.key === 'tradovate' ? (hasOrder ? 'tvbe-ok' : 'tvbe-warn') : ''}`;
    panel.querySelector('[data-tvbe-entry]').textContent = hasOrder ? fmt(order.entryPrice) : '-';
    panel.querySelector('[data-tvbe-stop]').textContent = hasOrder ? fmt(order.stopPrice) : '-';
    panel.querySelectorAll('[data-tvbe-order-field]').forEach(el => {
      el.classList.toggle('tvbe-disabled', disabled);
    });
    const stateCard = panel.querySelector('[data-tvbe-state-card]');
    stateCard.classList.toggle('tvbe-running', Boolean(data.enabled));
    stateCard.classList.toggle('tvbe-triggered', false);
    panel.querySelector('[data-tvbe-state]').textContent = stateText;
    const setupButton = panel.querySelector('[data-tvbe-action="setup-lines"]');
    if (setupButton) {
      setupButton.textContent = data.enabled ? '取消监控' : '启动监控';
      setupButton.classList.toggle('tvbe-active', Boolean(data.enabled));
      setupButton.classList.toggle('tvbe-danger', !data.enabled);
    }
    for (const [id, value] of Object.entries({
      executionMode: data.executionMode || 'auto',
      triggerPrice: data.enabled || data.testLinesVisible ? data.triggerPrice || '' : '',
      breakevenPrice: data.enabled || data.testLinesVisible ? data.breakevenPrice || '' : ''
    })) {
      const el = panel.querySelector(`[data-tvbe-input="${id}"]`);
      if (el && document.activeElement !== el) el.value = value;
    }
    panel.querySelectorAll('[data-tvbe-input="triggerPrice"], [data-tvbe-input="breakevenPrice"]').forEach(el => {
      el.disabled = !data.enabled && !data.testLinesVisible;
    });
    const logs = Array.isArray(data.logs) ? data.logs.slice(0, 8) : [];
    panel.querySelector('[data-tvbe-log]').textContent = logs.length
      ? logs.map(item => `${item.time || ''} ${item.message || ''}`).join('\n')
      : '还没有日志。';
    const debugPayload = {
      version: VERSION_STAMP,
      connection,
      currentPrice: data.lastCurrentPrice,
      currentPriceSource: data.lastCurrentPriceSource,
      order,
      snapshot: {
        bridgeStatus: snapshot.bridgeStatus,
        textHints: snapshot.textHints,
        entryPriceSource: snapshot.entryPriceSource,
        url: snapshot.url,
        title: snapshot.title
      },
      lastExecutionResult: data.lastExecutionResult,
      recentDebug: Array.isArray(data.debugEvents) ? data.debugEvents.slice(0, 8) : []
    };
    panel.querySelector('[data-tvbe-debug]').textContent = safeJson(debugPayload);
  }

  async function copyLogPayload() {
    const data = await safeStorageGet({ logs: [] });
    const text = Array.isArray(data.logs)
      ? data.logs.map(item => `${item.time || ''} ${item.message || ''}`).join('\n')
      : '';
    try {
      await navigator.clipboard.writeText(text || '还没有日志。');
      await addLog('日志已复制到剪贴板', 'good');
      return { ok: true };
    } catch (err) {
      await addDebug('copyLogPayload:failed', { error: err.message || String(err), text });
      return { ok: false, text };
    }
  }

  async function savePanelSettings(panel, extra = {}) {
    const settings = {
      executionMode: panel.querySelector('[data-tvbe-input="executionMode"]').value || 'auto',
      triggerPrice: cleanPriceText(panel.querySelector('[data-tvbe-input="triggerPrice"]').value),
      breakevenPrice: cleanPriceText(panel.querySelector('[data-tvbe-input="breakevenPrice"]').value),
      ...extra
    };
    await safeStorageSet(settings);
    await addDebug('panel:saveSettings', settings);
    return settings;
  }

  async function seedPricesFromOrder(panel) {
    const orderData = await refreshOrderSnapshot().catch(() => null);
    const order = orderData && orderData.order;
    if (!order) return null;
    const triggerInput = panel.querySelector('[data-tvbe-input="triggerPrice"]');
    const breakevenInput = panel.querySelector('[data-tvbe-input="breakevenPrice"]');
    const entry = Number(order.entryPrice);
    const takeProfit = Number(order.takeProfitPrice);
    const initialTrigger = Number.isFinite(entry) && Number.isFinite(takeProfit)
      ? entry + (takeProfit - entry) / 2
      : entry;
    if (Number.isFinite(initialTrigger)) triggerInput.value = fmt(initialTrigger);
    const stop = Number(order.stopPrice);
    const initialBreakeven = Number.isFinite(entry) && Number.isFinite(stop)
      ? (entry + stop) / 2
      : stop;
    if (Number.isFinite(initialBreakeven)) breakevenInput.value = fmt(initialBreakeven);
    await safeStorageSet({
      triggerPrice: triggerInput.value,
      breakevenPrice: breakevenInput.value,
      side: order.side || 'long',
      triggered: false,
      triggeredAt: null,
      lastExecutionResult: null
    });
    return order;
  }

  async function clearSetupLines(panel, message = '已隐藏推保线', extra = {}) {
    if (lineSyncTimer) {
      window.clearInterval(lineSyncTimer);
      lineSyncTimer = null;
    }
    await removeNativePriceLines().catch(err => addDebug('nativeLine:clearFailed', { error: err.message || String(err) }));
    removePriceLine('trigger');
    removePriceLine('breakeven');
    await safeStorageSet({ linesVisible: false, testLinesVisible: false, ...extra });
    await addLog(message, 'info');
    if (panel) await updatePanel();
    return { ok: true, visible: false };
  }

  async function drawSetupLines(panel, options = {}) {
    const current = await safeStorageGet({ linesVisible: false, testLinesVisible: false, enabled: false });
    const isTest = Boolean(options.test);
    if (current.enabled) {
      await addLog('请先停止监控，再重新设置推保线', 'warn');
      await updatePanel();
      return { ok: false, reason: 'monitor running' };
    }
    if (current.linesVisible && Boolean(current.testLinesVisible) === isTest) {
      return clearSetupLines(panel);
    }
    if (options.seedFromOrder) await seedPricesFromOrder(panel);
    await savePanelSettings(panel, { triggered: false, triggeredAt: null, lastExecutionResult: null });
    const trigger = parsePrice(panel.querySelector('[data-tvbe-input="triggerPrice"]').value);
    const breakeven = parsePrice(panel.querySelector('[data-tvbe-input="breakevenPrice"]').value);
    if (!Number.isFinite(trigger) || trigger <= 0 || !Number.isFinite(breakeven) || breakeven <= 0) {
      await addLog('请先填写触发价和推保价，再设置推保线', 'bad');
      await updatePanel();
      return { ok: false, reason: 'missing prices' };
    }
    await removeNativePriceLines().catch(err => addDebug('nativeLine:removeBeforeDrawFailed', { error: err.message || String(err) }));
    const triggerResult = await drawNativePriceLine('trigger', panel);
    const breakevenResult = await drawNativePriceLine('breakeven', panel);
    startLineSyncLoop();
    await safeStorageSet({ linesVisible: true, testLinesVisible: isTest, triggered: false, triggeredAt: null });
    if (!options.deferUpdate) await updatePanel();
    return { ok: Boolean(triggerResult && triggerResult.ok && breakevenResult && breakevenResult.ok), triggerResult, breakevenResult };
  }

  async function setupAndStartBreakEven(panel) {
    const current = await safeStorageGet({ linesVisible: false, testLinesVisible: false, enabled: false });
    if (current.enabled) return stopMonitoring('已取消本次推保监控');
    if (current.linesVisible && !current.testLinesVisible) await clearSetupLines(panel, '已重置上一组推保线', { triggerPrice: '', breakevenPrice: '' });
    const result = await drawSetupLines(panel, { seedFromOrder: true, deferUpdate: true });
    if (!result || !result.ok) return result;
    return startFromPanel(panel);
  }

  async function testBreakEvenSetup(panel) {
    const current = await safeStorageGet({ linesVisible: false, testLinesVisible: false, enabled: false });
    if (current.linesVisible && current.testLinesVisible) return clearSetupLines(panel);
    if (current.enabled) {
      await addLog('请先停止监控，再重新测试推保线', 'warn');
      await updatePanel();
      return { ok: false, reason: 'monitor running' };
    }
    const snapshot = await inferPositionSnapshot();
    const base = Number(snapshot.currentPrice) || parsePrice(panel.querySelector('[data-tvbe-input="breakevenPrice"]').value) || 100;
    const root = normalizeRoot(snapshot.title || getChartSymbolFromDom());
    const spec = typeof tdvGetContractSpec === 'function' ? tdvGetContractSpec(root || 'MGC') : null;
    const tick = Number(spec && spec.tickSize) || 0.1;
    const trigger = base + tick * 10;
    const breakeven = base;
    panel.querySelector('[data-tvbe-input="triggerPrice"]').value = fmt(trigger);
    panel.querySelector('[data-tvbe-input="breakevenPrice"]').value = fmt(breakeven);
    await safeStorageSet({
      triggerPrice: fmt(trigger),
      breakevenPrice: fmt(breakeven),
      lastSnapshot: snapshot,
      lastCurrentPrice: snapshot.currentPrice || base,
      lastCurrentPriceSource: snapshot.currentPriceSource || 'test setup base',
      triggered: false,
      triggeredAt: null,
      lastExecutionResult: null
    });
    await addLog(`测试推保：触发价 ${fmt(trigger)}，推保价 ${fmt(breakeven)}。仅画线，不启动监控。`, 'info');
    return drawSetupLines(panel, { test: true });
  }

  async function syncNativeLinePrices() {
    const result = await requestBridge('get-line-prices', {}, 'get-line-prices-result', 1000);
    if (!result || !result.ok || !result.lines) {
      await addDebug('lineSync:unavailable', result || {});
      return;
    }
    const updates = {};
    const debug = {};
    for (const kind of ['trigger', 'breakeven']) {
      const line = result.lines[kind] || {};
      const price = Number(line.price);
      debug[kind] = line;
      if (!Number.isFinite(price) || price <= 0) continue;
      const key = LINE_CONFIG[kind].storageKey;
      updates[key] = fmt(price);
    }
    if (!Object.keys(updates).length) {
      await addDebug('lineSync:no-readable-price', debug);
      return;
    }
    const current = await safeStorageGet({ triggerPrice: '', breakevenPrice: '' });
    const changed = {};
    for (const [key, value] of Object.entries(updates)) {
      if (String(current[key] || '') !== String(value)) changed[key] = value;
    }
    if (!Object.keys(changed).length) return;
    await safeStorageSet(changed);
    await addDebug('lineSync:update', { changed, debug });
    await updatePanel();
  }

  function startLineSyncLoop() {
    if (lineSyncTimer) return;
    lineSyncTimer = window.setInterval(() => {
      syncNativeLinePrices().catch(err => addDebug('lineSync:error', { error: err.message || String(err) }));
    }, 1000);
    syncNativeLinePrices().catch(err => addDebug('lineSync:error', { error: err.message || String(err) }));
  }

  async function removeNativePriceLines() {
    const result = await requestBridge('remove-horizontal-lines', {}, 'remove-horizontal-lines-result', 1200);
    await addDebug('nativeLine:remove', result || {});
    return result;
  }

  async function refreshOrderSnapshot() {
    const snapshot = await inferPositionSnapshot();
    const order = snapshot.orderSnapshot || null;
    const current = await safeStorageGet({ breakevenPrice: '', enabled: false, lastOrderSnapshot: null, lastSnapshot: null, lastSeenAt: null });
    const previousBridge = current.lastSnapshot && current.lastSnapshot.bridgeStatus;
    const previousWasTradovate = Boolean(previousBridge && (previousBridge.loggedIn || previousBridge.accountStateCount > 0 || previousBridge.accounts > 0));
    const currentIsTradovate = Boolean(snapshot.bridgeStatus && (snapshot.bridgeStatus.loggedIn || snapshot.bridgeStatus.accountStateCount > 0 || snapshot.bridgeStatus.accounts > 0));
    if (!currentIsTradovate && previousWasTradovate && current.lastSeenAt && Date.now() - current.lastSeenAt < 30000) {
      snapshot.bridgeStatus = previousBridge;
      snapshot.textHints = {
        ...(snapshot.textHints || {}),
        hasTradovate: true,
        hasPaperTrading: false
      };
    }
    const retainedOrder = order || (current.enabled ? current.lastOrderSnapshot : null);
    const updates = {
      lastSnapshot: snapshot,
      lastOrderSnapshot: retainedOrder,
      lastCurrentPrice: snapshot.currentPrice || null,
      lastCurrentPriceSource: snapshot.currentPriceSource || '',
      lastSeenAt: Date.now()
    };
    if (retainedOrder && retainedOrder.side) updates.side = retainedOrder.side;
    await safeStorageSet(updates);
    await addDebug('orderSnapshot:refresh', { snapshot, order: retainedOrder, freshOrder: order });
    const prevOrder = current.lastOrderSnapshot || null;
    const changed = JSON.stringify({
      symbol: prevOrder && prevOrder.symbol,
      side: prevOrder && prevOrder.side,
      qty: prevOrder && prevOrder.qty,
      entryPrice: prevOrder && prevOrder.entryPrice,
      stopPrice: prevOrder && prevOrder.stopPrice
    }) !== JSON.stringify({
      symbol: order && order.symbol,
      side: order && order.side,
      qty: order && order.qty,
      entryPrice: order && order.entryPrice,
      stopPrice: order && order.stopPrice
    });
    if (order && changed) {
      await addLog(`读取订单：${order.symbol} ${order.side} ${order.qty} @ ${fmt(order.entryPrice)}，止损 ${fmt(order.stopPrice)}`, 'info');
    } else if (!order && changed) {
      await addLog('没有从 Tradovate/Paper Trading 缓存读到当前图表持仓', 'warn');
    }
    return { ok: Boolean(retainedOrder), snapshot, order: retainedOrder, freshOrder: order };
  }

  async function startFromPanel(panel) {
    const orderData = await refreshOrderSnapshot().catch(() => null);
    const autoSide = orderData && orderData.order && orderData.order.side ? orderData.order.side : undefined;
    const settings = await savePanelSettings(panel, { enabled: true, triggered: false, startedAt: Date.now(), ...(autoSide ? { side: autoSide } : {}) });
    const trigger = parsePrice(settings.triggerPrice);
    const breakeven = parsePrice(settings.breakevenPrice);
    if (!Number.isFinite(trigger) || !Number.isFinite(breakeven) || trigger <= 0 || breakeven <= 0) {
      await safeStorageSet({ enabled: false });
      await addDebug('panel:start-invalid-price', settings);
      await addLog('请先填写大于 0 的触发价和推保价', 'bad');
      await updatePanel();
      return { ok: false, reason: 'invalid price' };
    }
    startMonitorLoop();
    await addDebug('panel:start-ok', settings);
    await addLog(`启动监控：${settings.side === 'short' ? '空单' : '多单'} 触发价 ${fmt(trigger)}，推保价 ${fmt(breakeven)}`, 'good');
    await updatePanel();
    return { ok: true };
  }

  async function stopMonitoring(message = '已停止监控') {
    await clearSetupLines(document.getElementById(PANEL_ID), message, {
      enabled: false,
      triggered: false,
      triggeredAt: null,
      triggerPrice: '',
      breakevenPrice: ''
    });
    await addDebug('panel:stop');
    await updatePanel();
    return { ok: true };
  }

  async function copyDebugPayload() {
    const data = await safeStorageGet({
      enabled: false,
      triggered: false,
      side: '',
      executionMode: '',
      triggerPrice: '',
      breakevenPrice: '',
      lastCurrentPrice: null,
      lastCurrentPriceSource: '',
      lastSnapshot: null,
      lastOrderSnapshot: null,
      lastExecutionResult: null,
      logs: [],
      debugEvents: []
    });
    const bridge = await requestTradovateState(1500).catch(() => null);
    const priceCandidates = debugPriceCandidates();
    const payload = {
      version: VERSION_STAMP,
      url: location.href,
      title: document.title,
      copiedAt: new Date().toISOString(),
      settings: {
        enabled: data.enabled,
        triggered: data.triggered,
        side: data.side,
        executionMode: data.executionMode,
        triggerPrice: data.triggerPrice,
        breakevenPrice: data.breakevenPrice
      },
      lastCurrentPrice: data.lastCurrentPrice,
      lastCurrentPriceSource: data.lastCurrentPriceSource,
      lastSnapshot: data.lastSnapshot,
      lastOrderSnapshot: data.lastOrderSnapshot,
      lastExecutionResult: data.lastExecutionResult,
      priceCandidates,
      bridgeStatus: bridge ? {
        loggedIn: Boolean(bridge.auth && bridge.auth.loggedIn),
        baseUrl: bridge.auth && bridge.auth.baseUrl,
        accounts: Array.isArray(bridge.accounts) ? bridge.accounts.map(acc => ({ id: acc.id || acc.accountId, name: acc.name })) : [],
        stateKeys: bridge.state ? Object.keys(bridge.state) : [],
        chartSymbol: bridge.chartSymbol || ''
      } : null,
      bridgeRaw: bridge,
      recentLogs: Array.isArray(data.logs) ? data.logs.slice(0, 20) : [],
      recentDebug: Array.isArray(data.debugEvents) ? data.debugEvents.slice(0, 20) : []
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      await addLog('调试信息已复制到剪贴板', 'good');
      return { ok: true };
    } catch (err) {
      await addLog(`复制失败：${err.message || String(err)}`, 'bad');
      await addDebug('copyDebugPayload:failed', { text });
      return { ok: false, text };
    }
  }

  function makePanelDraggable(panel) {
    const header = panel.querySelector('.tvbe-panel-header');
    if (!header || panel.dataset.tvbeDraggable === '1') return;
    panel.dataset.tvbeDraggable = '1';
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    header.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', event => {
      if (!dragging) return;
      const nextLeft = clamp(startLeft + event.clientX - startX, 8, window.innerWidth - Math.min(panel.offsetWidth, window.innerWidth) - 8);
      const nextTop = clamp(startTop + event.clientY - startY, 8, window.innerHeight - 80);
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    });
    header.addEventListener('pointerup', event => {
      dragging = false;
      try { header.releasePointerCapture(event.pointerId); } catch (_err) {}
    });
  }

  async function drawNativePriceLine(kind, panel) {
    await savePanelSettings(panel);
    const config = LINE_CONFIG[kind];
    const price = parsePrice(panel.querySelector(`[data-tvbe-input="${config.storageKey}"]`).value);
    if (!Number.isFinite(price) || price <= 0) {
      await addLog(`请先填写大于 0 的${config.label}，再画线`, 'bad');
      return { ok: false, reason: 'invalid price' };
    }
    const result = await requestBridge('draw-horizontal-line', {
      kind,
      price,
      text: config.label,
      color: config.color
    }, 'draw-horizontal-line-result', 3000);
    await addDebug(`${config.debugPrefix}:nativeDraw`, { price, result });
    if (!result || !result.ok) {
      await addLog(`${config.label}画线失败：${result && result.error || 'TradingView chart 未响应'}`, 'bad');
      return result || { ok: false };
    }
    await addLog(`${config.label}已画到 ${fmt(price)}`, 'good');
    return result;
  }

  async function createSidePanel() {
    ensureLineStyles();
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.classList.remove('tvbe-collapsed');
      await refreshOrderSnapshot().catch(() => {});
      await updatePanel();
      return { ok: true, reused: true };
    }

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="tvbe-panel-header">
        <div class="tvbe-panel-title">TVBreakEven <span class="tvbe-version">v${VERSION_STAMP}</span></div>
      </div>
      <div class="tvbe-panel-body">
        <div class="tvbe-line-row">
          <div class="tvbe-field tvbe-stack">
            <span class="tvbe-field-label">当前价</span>
            <strong class="tvbe-field-value tvbe-big" data-tvbe-current>-</strong>
          </div>
          <div class="tvbe-field tvbe-stack">
            <span class="tvbe-field-label">状态</span>
            <strong class="tvbe-field-value tvbe-big" data-tvbe-state-card><span data-tvbe-state>未启动</span></strong>
          </div>
        </div>
        <div class="tvbe-line-row tvbe-single">
          <div class="tvbe-field tvbe-stack">
            <span class="tvbe-field-label">交易所 / 订单</span>
            <strong class="tvbe-field-value tvbe-status-pill" data-tvbe-connection>未连接到任何交易所</strong>
          </div>
        </div>
        <div class="tvbe-line-row">
          <div class="tvbe-field">
            <span class="tvbe-field-label">开仓价</span>
            <strong class="tvbe-field-value" data-tvbe-order-field data-tvbe-entry>-</strong>
          </div>
          <div class="tvbe-field">
            <span class="tvbe-field-label">止损价</span>
            <strong class="tvbe-field-value" data-tvbe-order-field data-tvbe-stop>-</strong>
          </div>
        </div>
        <div class="tvbe-line-row">
          <label><span class="tvbe-field-label">触发价</span><input data-tvbe-input="triggerPrice" inputmode="decimal"></label>
          <label><span class="tvbe-field-label">推保价</span><input data-tvbe-input="breakevenPrice" inputmode="decimal"></label>
        </div>
        <div class="tvbe-line-row tvbe-single">
          <label><span class="tvbe-field-label">执行方式</span><select data-tvbe-input="executionMode"><option value="auto">自动模式：尝试移动止损</option><option value="assist">辅助模式：触发后报警</option></select></label>
        </div>
        <div class="tvbe-line-row tvbe-single">
          <div class="tvbe-actions">
            <button type="button" data-tvbe-action="setup-lines">设置推保</button>
          </div>
        </div>
        <details class="tvbe-panel-section tvbe-collapsible">
          <summary class="tvbe-section-head">
            <div class="tvbe-muted tvbe-section-title">日志</div>
            <button class="tvbe-mini-button" type="button" data-tvbe-action="copy-log">复制</button>
          </summary>
          <div class="tvbe-log" data-tvbe-log>还没有日志。</div>
        </details>
        <details class="tvbe-panel-section tvbe-collapsible">
          <summary class="tvbe-section-head">
            <div class="tvbe-muted tvbe-section-title">调试信息</div>
            <button class="tvbe-mini-button" type="button" data-tvbe-action="copy-debug">复制</button>
          </summary>
          <div class="tvbe-debug" data-tvbe-debug>{}</div>
        </details>
      </div>
    `;
    document.documentElement.appendChild(panel);

    panel.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const cleaned = cleanPriceText(input.value);
        if (input.value !== cleaned) input.value = cleaned;
        savePanelSettings(panel).then(updatePanel);
      });
      input.addEventListener('blur', () => savePanelSettings(panel).then(updatePanel));
    });
    panel.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', () => savePanelSettings(panel).then(updatePanel));
    });
    panel.addEventListener('click', event => {
      const action = event.target && event.target.dataset ? event.target.dataset.tvbeAction : '';
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'setup-lines') setupAndStartBreakEven(panel);
      if (action === 'copy-log') copyLogPayload().then(updatePanel);
      if (action === 'copy-debug') copyDebugPayload().then(updatePanel);
    });

    makePanelDraggable(panel);

    if (!panelTimer) {
      panelTimer = window.setInterval(() => {
        refreshOrderSnapshot().then(updatePanel).catch(() => updatePanel().catch(() => {}));
      }, 1000);
    }
    await refreshOrderSnapshot().catch(() => {});
    await updatePanel();
    return { ok: true };
  }

  async function toggleSidePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.remove();
      return { ok: true, visible: false };
    }
    await createSidePanel();
    return { ok: true, visible: true };
  }

  async function monitorTick() {
    const settings = await safeStorageGet({
      enabled: false,
      triggerPrice: '',
      breakevenPrice: '',
      side: 'long',
      executionMode: 'auto',
      triggered: false
    });
    if (settings.executionMode !== 'auto') {
      settings.executionMode = 'auto';
      await safeStorageSet({ executionMode: 'auto' });
    }
    if (!settings.enabled || settings.triggered) return;

    const stored = await safeStorageGet({ lastOrderSnapshot: null });
    const snapshot = await inferPositionSnapshot();
    const currentPrice = snapshot.currentPrice;
    await safeStorageSet({
      lastCurrentPrice: currentPrice,
      lastCurrentPriceSource: snapshot.currentPriceSource || '',
      lastSeenAt: Date.now(),
      lastSnapshot: snapshot,
      lastOrderSnapshot: snapshot.orderSnapshot || stored.lastOrderSnapshot || null
    });

    const triggerPrice = parsePrice(settings.triggerPrice);
    const breakevenPrice = parsePrice(settings.breakevenPrice);
    if (!Number.isFinite(triggerPrice) || !Number.isFinite(breakevenPrice) || breakevenPrice <= 0 || !Number.isFinite(currentPrice)) return;

    if (!reachedTrigger(settings.side, currentPrice, triggerPrice)) return;

    await safeStorageSet({
      triggered: false,
      enabled: false,
      triggeredAt: Date.now(),
      linesVisible: false,
      testLinesVisible: false,
      triggerPrice: '',
      breakevenPrice: ''
    });
    clearSetupLines(document.getElementById(PANEL_ID), '触发后已删除推保线')
      .catch(err => addDebug('trigger:clearLinesFailed', { error: err.message || String(err) }));
    await addDebug('trigger:reached', {
      side: settings.side,
      currentPrice,
      triggerPrice,
      breakevenPrice,
      currentSource: snapshot.currentPriceSource || '',
      snapshot
    });
    await addLog(`触发推保：当前价 ${fmt(currentPrice)}，触发价 ${fmt(triggerPrice)}，推保价 ${fmt(breakevenPrice)}`, 'warn');

    const result = await executeMoveStop({
      ...settings,
      triggerPrice,
      breakevenPrice
    }, currentPrice);
    await safeStorageSet({ lastExecutionResult: result });
    await addDebug('execution:result', result);
    if (result.ok) {
      await addLog('推保执行已发送，请确认止损位置', 'good');
    } else if (result.assisted) {
      await addLog('辅助模式已提醒，请手动确认止损已推到成本位', 'warn');
    } else {
      await addLog(`自动推保未完成：${result.reason || '需要手动处理'}`, 'bad');
    }
  }

  function startMonitorLoop() {
    if (monitorTimer) window.clearInterval(monitorTimer);
    monitorTimer = window.setInterval(() => {
      monitorTick().catch(err => addLog(`监控出错：${err.message || String(err)}`, 'bad'));
    }, 1000);
    monitorTick().catch(err => addLog(`监控出错：${err.message || String(err)}`, 'bad'));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;
    let task = null;

    if (message.type === 'tvbe:ping') {
      task = Promise.resolve({ ok: true });
    }
    if (message.type === 'tvbe:toggle-panel') {
      task = toggleSidePanel();
    }
    if (message.type === 'tvbe:snapshot') {
      task = (async () => {
        const snapshot = await inferPositionSnapshot();
        const priceCandidates = debugPriceCandidates();
        await addDebug('snapshot', { snapshot, priceCandidates });
        return { ok: true, snapshot, priceCandidates };
      })();
    }
    if (message.type === 'tvbe:create-line') {
      task = createPriceLine('trigger');
    }
    if (message.type === 'tvbe:create-breakeven-line') {
      task = createPriceLine('breakeven');
    }
    if (message.type === 'tvbe:remove-line') {
      removePriceLine('trigger');
      removePriceLine('breakeven');
      task = Promise.resolve({ ok: true });
    }
    if (message.type === 'tvbe:show-panel') {
      task = createSidePanel();
    }
    if (message.type === 'tvbe:start-loop') {
      startMonitorLoop();
      task = Promise.resolve({ ok: true });
    }

    if (!task) return false;
    task
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  });

  startMonitorLoop();
})();
