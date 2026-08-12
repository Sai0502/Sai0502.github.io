(() => {
  'use strict';
  if (window.__tvbeTradovateBridgeLoaded) return;
  window.__tvbeTradovateBridgeLoaded = true;

  const liveState = {};
  const nativeLineIds = {};
  const LINE_LABELS = {
    trigger: '触发价',
    breakeven: '推保价'
  };
  let accounts = null;
  let lastRefreshAt = 0;
  let auth = {
    jwt: null,
    baseUrl: null,
    isDemo: null,
    capturedAt: null
  };

  function parseBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      try { return JSON.parse(body); } catch (_err) {}
      return body;
    }
    try {
      if (body instanceof URLSearchParams) {
        const out = {};
        for (const [key, value] of body.entries()) out[key] = value;
        return out;
      }
      if (body instanceof FormData) {
        const out = {};
        for (const [key, value] of body.entries()) out[key] = typeof value === 'string' ? value : '[file]';
        return out;
      }
    } catch (_err) {}
    return body;
  }

  function normalizeHeaders(headers) {
    const out = {};
    if (!headers) return out;
    try {
      if (headers instanceof Headers) {
        for (const [key, value] of headers.entries()) out[key.toLowerCase()] = value;
        return out;
      }
    } catch (_err) {}
    if (typeof headers === 'object') {
      for (const key of Object.keys(headers)) out[key.toLowerCase()] = String(headers[key]);
    }
    return out;
  }

  function captureAuth(url, headers) {
    if (typeof url !== 'string' || !url.includes('tradovateapi.com')) return;
    const authorization = headers.authorization || headers.Authorization;
    const match = authorization && String(authorization).match(/^Bearer\s+(.+)$/i);
    if (!match) return;
    const baseMatch = url.match(/^(https?:\/\/[^/]+)/);
    const baseUrl = baseMatch ? baseMatch[1] : null;
    auth = {
      jwt: match[1],
      baseUrl,
      isDemo: baseUrl ? /demo/i.test(baseUrl) : null,
      capturedAt: Date.now()
    };
  }

  function updateFromResponse(url, method, parsed) {
    if (!parsed || !parsed.d) return;
    if (/\/accounts(\?|$)/.test(url) && method === 'GET') {
      accounts = parsed.d;
      return;
    }
    const match = String(url).match(/\/accounts\/([^/?]+)\/(state|positions|orders|executions)/);
    if (!match || method !== 'GET') return;
    const accountId = match[1];
    const kind = match[2];
    if (!liveState[accountId]) liveState[accountId] = {};
    liveState[accountId][kind] = parsed.d;
    liveState[accountId].lastUpdate = Date.now();
  }

  function getChart() {
    let chart = null;
    const seen = new WeakSet();
    const hasCreate = obj => {
      try { return obj && (typeof obj.createMultipointShape === 'function' || typeof obj.createShape === 'function'); }
      catch (_err) { return false; }
    };
    const resolve = obj => {
      if (!obj) return null;
      if (hasCreate(obj)) return obj;
      try {
        if (typeof obj.activeChart === 'function') {
          const c = obj.activeChart();
          if (hasCreate(c)) return c;
        }
      } catch (_err) {}
      try {
        if (typeof obj.chart === 'function') {
          const c = obj.chart();
          if (hasCreate(c)) return c;
        }
      } catch (_err) {}
      return null;
    };
    const walk = (obj, depth) => {
      if (chart || !obj || depth <= 0) return;
      const type = typeof obj;
      if (type !== 'object' && type !== 'function') return;
      try {
        if (seen.has(obj)) return;
        seen.add(obj);
      } catch (_err) {
        return;
      }
      const resolved = resolve(obj);
      if (resolved) {
        chart = resolved;
        return;
      }
      const keys = ['stateNode', 'memoizedProps', 'memoizedState', 'pendingProps', 'child', 'sibling', 'return', 'alternate', '_model', '_widget', '_chart', 'model', 'widget', 'chart', 'context', 'owner', 'props', 'state'];
      for (const key of keys) {
        if (chart) return;
        try { if (obj[key]) walk(obj[key], depth - 1); } catch (_err) {}
      }
    };

    try {
      if (window.__TV_LAST_CHART__ && hasCreate(window.__TV_LAST_CHART__)) chart = window.__TV_LAST_CHART__;
    } catch (_err) {}
    if (!chart) {
      for (const name of Object.getOwnPropertyNames(window)) {
        try {
          const resolved = resolve(window[name]);
          if (resolved) {
            chart = resolved;
            break;
          }
        } catch (_err) {}
      }
    }
    if (!chart) {
      const canvases = Array.from(document.querySelectorAll('canvas')).sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });
      for (const canvas of canvases.slice(0, 3)) {
        if (chart) break;
        for (const key of Object.keys(canvas)) {
          if (chart) break;
          if (key.indexOf('__reactFiber') === 0 || key.indexOf('__reactProps') === 0 ||
              key.indexOf('__reactInternalInstance') === 0 || key[0] === '_' || key[0] === '$') {
            walk(canvas[key], 40);
          }
        }
      }
    }
    try { if (chart) window.__TV_LAST_CHART__ = chart; } catch (_err) {}
    return chart;
  }

  async function getChartSymbol() {
    const chart = getChart();
    if (!chart) return null;
    try {
      if (typeof chart.symbolExt === 'function') {
        const ext = await chart.symbolExt();
        if (ext) return ext.symbol || ext.name || String(ext);
      }
    } catch (_err) {}
    try {
      if (typeof chart.symbol === 'function') {
        const sym = await chart.symbol();
        if (sym != null) return String(sym);
      }
    } catch (_err) {}
    return null;
  }

  function removeKnownLine(kind, chart) {
    const id = nativeLineIds[kind];
    if (!id || !chart || typeof chart.removeEntity !== 'function') return false;
    try {
      chart.removeEntity(id);
      delete nativeLineIds[kind];
      return true;
    } catch (_err) {
      delete nativeLineIds[kind];
      return false;
    }
  }

  function setShapeText(shape, text) {
    if (!shape || !text) return false;
    const attempts = [
      () => typeof shape.setText === 'function' && shape.setText(text),
      () => typeof shape.setProperties === 'function' && shape.setProperties({ text }),
      () => typeof shape.setProperty === 'function' && shape.setProperty('text', text),
      () => shape._source && typeof shape._source.setProperty === 'function' && shape._source.setProperty('text', text)
    ];
    for (const attempt of attempts) {
      try {
        if (attempt()) return true;
      } catch (_err) {}
    }
    return false;
  }

  async function drawHorizontalLine(kind, price, text, color) {
    const chart = getChart();
    if (!chart) return { ok: false, error: 'no TradingView chart object' };
    const number = Number(price);
    if (!Number.isFinite(number) || number <= 0) return { ok: false, error: 'invalid price' };
    try {
      removeKnownLine(kind, chart);
      const label = text || LINE_LABELS[kind] || kind;
      const id = await chart.createShape(
        { time: Math.floor(Date.now() / 1000), price: number },
        {
          shape: 'horizontal_line',
          lock: false,
          disableSelection: false,
          disableSave: false,
          disableUndo: false,
          text: label,
          overrides: {
            linecolor: color || '#f6c34a',
            linewidth: 2,
            linestyle: 2,
            showLabel: true,
            textcolor: color || '#f6c34a',
            horzLabelsAlign: 'right',
            vertLabelsAlign: 'middle'
          }
        }
      );
      nativeLineIds[kind] = id == null ? '' : String(id);
      let textUpdated = false;
      try {
        if (nativeLineIds[kind] && typeof chart.getShapeById === 'function') {
          textUpdated = setShapeText(chart.getShapeById(nativeLineIds[kind]), label);
        }
      } catch (_err) {}
      return { ok: true, id: nativeLineIds[kind], price: number, text: label, textUpdated };
    } catch (err) {
      return { ok: false, error: err && err.message || String(err) };
    }
  }

  function removeHorizontalLines() {
    const chart = getChart();
    if (!chart) return { ok: false, error: 'no TradingView chart object' };
    const removed = {};
    for (const kind of Object.keys(nativeLineIds)) {
      removed[kind] = removeKnownLine(kind, chart);
    }
    return { ok: true, removed };
  }

  function readLinePriceFromShape(shape) {
    if (!shape) return { price: null, method: 'no-shape' };
    const tryExtract = (value, method) => {
      if (!value) return null;
      const points = Array.isArray(value) ? value : [value];
      for (const point of points) {
        if (!point) continue;
        const candidates = [
          point.price,
          point.value,
          point._price,
          point._value,
          point.y,
          point[1]
        ];
        for (const candidate of candidates) {
          const number = Number(candidate);
          if (Number.isFinite(number) && number > 0) return { price: number, method };
        }
      }
      return null;
    };
    const attempts = [
      ['getPoints()', () => typeof shape.getPoints === 'function' ? shape.getPoints() : null],
      ['points()', () => typeof shape.points === 'function' ? shape.points() : null],
      ['points', () => shape.points],
      ['_points', () => shape._points],
      ['state.points', () => shape.state && shape.state.points],
      ['_source.points()', () => shape._source && typeof shape._source.points === 'function' ? shape._source.points() : null],
      ['_source._points', () => shape._source && shape._source._points]
    ];
    for (const [method, getter] of attempts) {
      try {
        const found = tryExtract(getter(), method);
        if (found) return found;
      } catch (_err) {}
    }
    return { price: null, method: 'unreadable-shape-points' };
  }

  function getHorizontalLinePrices() {
    const chart = getChart();
    if (!chart) return { ok: false, error: 'no TradingView chart object', lines: {} };
    const lines = {};
    for (const kind of Object.keys(nativeLineIds)) {
      const id = nativeLineIds[kind];
      let shape = null;
      try {
        if (id && typeof chart.getShapeById === 'function') shape = chart.getShapeById(id);
      } catch (_err) {}
      lines[kind] = { id, ...readLinePriceFromShape(shape) };
    }
    return { ok: true, lines };
  }

  function buildModifyBody(rawOrder, stopPrice) {
    const order = rawOrder || {};
    const body = new URLSearchParams();
    const put = (key, value) => {
      if (value === null || value === undefined || value === '') return;
      body.set(key, String(value));
    };
    const duration = order.durationType ||
      order.timeInForce ||
      (order.duration && (order.duration.type || order.duration.durationType || order.duration.name)) ||
      'GTC';
    put('durationType', duration);
    put('instrument', order.instrument || order.contract || order.symbol);
    put('qty', order.qty || order.quantity || order.leavesQty || order.remainingQty || 1);
    put('side', order.side || order.action);
    put('type', order.type || order.ordType || order.orderType || 'stop');
    put('stopPrice', stopPrice);
    if (order.limitPrice != null) put('limitPrice', order.limitPrice);
    if (order.price != null && order.stopPrice == null) put('price', stopPrice);
    return body;
  }

  async function refreshTradovateState(force) {
    if (!auth.jwt || !auth.baseUrl) return { ok: false, error: 'no auth' };
    const now = Date.now();
    if (!force && now - lastRefreshAt < 1500) return { ok: true, throttled: true };
    lastRefreshAt = now;
    const headers = { Authorization: `Bearer ${auth.jwt}`, Accept: 'application/json' };
    try {
      if (!Array.isArray(accounts)) {
        const accountsResp = await fetch(`${auth.baseUrl}/accounts?locale=en&requestId=tvbe_accounts_${now}`, { headers });
        const accountsJson = await accountsResp.json();
        if (accountsJson && accountsJson.d) accounts = accountsJson.d;
      }
      const list = Array.isArray(accounts) ? accounts : [];
      await Promise.all(list.map(async account => {
        const accountId = account.id || account.accountId;
        if (!accountId) return;
        const base = `${auth.baseUrl}/accounts/${accountId}`;
        const [stateResp, positionsResp, ordersResp] = await Promise.all([
          fetch(`${base}/state?locale=en&requestId=tvbe_state_${now}`, { headers }),
          fetch(`${base}/positions?locale=en&requestId=tvbe_positions_${now}`, { headers }),
          fetch(`${base}/orders?locale=en&requestId=tvbe_orders_${now}`, { headers })
        ]);
        const [stateJson, positionsJson, ordersJson] = await Promise.all([
          stateResp.json().catch(() => null),
          positionsResp.json().catch(() => null),
          ordersResp.json().catch(() => null)
        ]);
        if (!liveState[accountId]) liveState[accountId] = {};
        if (stateJson && stateJson.d) liveState[accountId].state = stateJson.d;
        if (positionsJson && positionsJson.d) liveState[accountId].positions = positionsJson.d;
        if (ordersJson && ordersJson.d) liveState[accountId].orders = ordersJson.d;
        liveState[accountId].lastUpdate = Date.now();
      }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message || String(err) };
    }
  }

  async function modifyStopOrder(accountId, orderId, stopPrice, rawOrder) {
    if (!auth.jwt || !auth.baseUrl) return { ok: false, error: 'no auth' };
    if (!accountId || !orderId) return { ok: false, error: 'missing account/order id' };
    const price = Number(stopPrice);
    if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'invalid stop price' };
    const body = buildModifyBody(rawOrder, price);
    const url = `${auth.baseUrl}/accounts/${accountId}/orders/${orderId}?locale=en&requestId=tvbe_${Date.now()}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auth.jwt}`,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_err) {}
      await refreshTradovateState(true);
      if (!response.ok) return { ok: false, error: `HTTP ${response.status}`, raw: text };
      if (json && json.s && json.s !== 'ok') {
        return { ok: false, error: json.errmsg || json.errorText || 'Tradovate returned error', response: json, body: body.toString() };
      }
      return { ok: true, response: json || { raw: text }, body: body.toString() };
    } catch (err) {
      return { ok: false, error: err && err.message || String(err), body: body.toString() };
    }
  }

  window.__tvbeGetTradovateState = function() {
    return {
      accounts,
      state: liveState,
      auth: auth.jwt ? { ...auth, loggedIn: true } : { loggedIn: false },
      ts: Date.now()
    };
  };

  window.addEventListener('message', event => {
    if (!event.data || event.data.source !== 'tvbe-content') return;
    const requestId = event.data.requestId;
    const respond = (type, payload) => {
      window.postMessage({ source: 'tvbe-bridge', type, requestId, payload }, '*');
    };
    if (event.data.type === 'get-tradovate-state') {
      (async () => {
        if (event.data.refresh) await refreshTradovateState(false);
        const payload = window.__tvbeGetTradovateState();
        payload.chartSymbol = await getChartSymbol();
        respond('tradovate-state', payload);
      })().catch(err => respond('tradovate-state', { error: err && err.message || String(err) }));
    }
    if (event.data.type === 'draw-horizontal-line') {
      drawHorizontalLine(event.data.kind, event.data.price, event.data.text, event.data.color)
        .then(payload => respond('draw-horizontal-line-result', payload))
        .catch(err => respond('draw-horizontal-line-result', { ok: false, error: err && err.message || String(err) }));
    }
    if (event.data.type === 'remove-horizontal-lines') {
      try { respond('remove-horizontal-lines-result', removeHorizontalLines()); }
      catch (err) { respond('remove-horizontal-lines-result', { ok: false, error: err && err.message || String(err) }); }
    }
    if (event.data.type === 'get-line-prices') {
      try { respond('get-line-prices-result', getHorizontalLinePrices()); }
      catch (err) { respond('get-line-prices-result', { ok: false, error: err && err.message || String(err) }); }
    }
    if (event.data.type === 'modify-stop-order') {
      modifyStopOrder(event.data.accountId, event.data.orderId, event.data.stopPrice, event.data.rawOrder)
        .then(payload => respond('modify-stop-order-result', payload))
        .catch(err => respond('modify-stop-order-result', { ok: false, error: err && err.message || String(err) }));
    }
  });

  const AUTH_PASSTHROUGH = /\/auth\/|\/oauthtoken|\/restoresession|\/me\/sessions|\/auth$|\/v1\/auth/i;

  try {
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const url = input && input.url ? input.url : String(input);
      if (AUTH_PASSTHROUGH.test(url)) return originalFetch.apply(this, arguments);
      const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      try {
        captureAuth(url, normalizeHeaders((init && init.headers) || (input && input.headers)));
      } catch (_err) {}
      const response = await originalFetch.apply(this, arguments);
      if (url.includes('tradovateapi.com') && response.ok) {
        try {
          const cloned = response.clone();
          const contentType = cloned.headers.get('content-type') || '';
          if (contentType.includes('json')) {
            cloned.text().then(text => {
              try { updateFromResponse(url, method, JSON.parse(text)); } catch (_err) {}
            }).catch(() => {});
          }
        } catch (_err) {}
      }
      return response;
    };
  } catch (_err) {}

  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__tvbeMethod = String(method || 'GET').toUpperCase();
      this.__tvbeUrl = String(url || '');
      this.__tvbeHeaders = {};
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      if (this.__tvbeHeaders) this.__tvbeHeaders[String(name).toLowerCase()] = String(value);
      return originalSetRequestHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const url = this.__tvbeUrl || '';
      if (AUTH_PASSTHROUGH.test(url)) return originalSend.apply(this, arguments);
      try {
        captureAuth(url, this.__tvbeHeaders || {});
        parseBody(body);
      } catch (_err) {}
      if (url.includes('tradovateapi.com')) {
        this.addEventListener('load', function() {
          if (this.status < 200 || this.status >= 300) return;
          try { updateFromResponse(url, this.__tvbeMethod || 'GET', JSON.parse(this.responseText)); } catch (_err) {}
        });
      }
      return originalSend.apply(this, arguments);
    };
  } catch (_err) {}
})();
