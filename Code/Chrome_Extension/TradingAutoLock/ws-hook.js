(function () {
  const HOOK_FLAG = '__tradovateAutoLockWsHookInstalled';
  const MESSAGE_TYPE = 'tradovate-auto-lock:ws-capture';
  if (window[HOOK_FLAG]) return;
  window[HOOK_FLAG] = true;

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== 'function') {
    window.postMessage({
      source: MESSAGE_TYPE,
      kind: 'hook-error',
      error: 'WebSocket constructor unavailable',
      ts: Date.now()
    }, '*');
    return;
  }

  function redact(value) {
    return String(value || '')
      .replace(/(authorization|access[_-]?token|token|password|secret)"?\s*[:=]\s*"?[^",}\s]+/gi, '$1:[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, '[JWT_REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(String(url), location.href);
      return `${parsed.origin}${parsed.pathname}${parsed.search ? '?query=present' : ''}`;
    } catch (_) {
      return String(url || '').slice(0, 240);
    }
  }

  function keywordHits(text) {
    const value = String(text || '');
    const keywords = [
      'order',
      'fill',
      'position',
      'execution',
      'entityType',
      'eventType',
      'ordStatus',
      'Buy',
      'Sell',
      'Bought',
      'Sold'
    ];
    return keywords.filter(keyword => new RegExp(keyword, 'i').test(value));
  }

  function parseTradovatePayload(text) {
    const value = String(text || '').trim();
    const candidates = [value];
    if (/^[a-z]\s*[\[{]/i.test(value)) candidates.push(value.slice(1));
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (_) {
      }
    }
    return null;
  }

  function pickFields(entity) {
    if (!entity || typeof entity !== 'object') return entity;
    const fields = [
      'id',
      'name',
      'accountName',
      'displayName',
      'userId',
      'accountId',
      'contractId',
      'orderId',
      'positionId',
      'timestamp',
      'action',
      'orderQty',
      'filledQty',
      'qty',
      'price',
      'avgFillPrice',
      'ordStatus',
      'orderType',
      'buyQty',
      'sellQty',
      'netPos',
      'netPrice',
      'bought',
      'sold',
      'prevPos',
      'active'
    ];
    const out = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(entity, field)) out[field] = entity[field];
    }
    return out;
  }

  function extractEntitySummaries(parsed) {
    const summaries = [];
    const interestingArrays = new Set([
      'orders',
      'fills',
      'accounts',
      'positions',
      'executionReports',
      'fillPairs'
    ]);

    function visit(node, path = '') {
      if (!node || typeof node !== 'object' || summaries.length >= 30) return;

      if (node.entityType && node.eventType) {
        summaries.push({
          path,
          kind: 'event',
          entityType: node.entityType,
          eventType: node.eventType,
          entity: pickFields(node.entity)
        });
      }

      if (Array.isArray(node)) {
        node.forEach((item, index) => visit(item, `${path}[${index}]`));
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        const childPath = path ? `${path}.${key}` : key;
        if (Array.isArray(value) && interestingArrays.has(key)) {
          summaries.push({
            path: childPath,
            kind: 'array',
            entityType: key,
            count: value.length,
            firstItems: value.slice(0, 3).map(pickFields),
            lastItems: value.slice(-3).map(pickFields)
          });
        }
        if (value && typeof value === 'object') visit(value, childPath);
      }
    }

    visit(parsed);
    return summaries;
  }

  function pickTradeFact(kind, entity, extra = {}) {
    const fields = pickFields(entity);
    if (!fields || typeof fields !== 'object') return null;
    return {
      kind,
      ...extra,
      ...fields
    };
  }

  function extractTradeFacts(parsed) {
    const facts = [];
    const arrayKinds = {
      orders: 'order',
      fills: 'fill',
      accounts: 'account',
      positions: 'position',
      executionReports: 'executionReport',
      fillPairs: 'fillPair'
    };
    const eventKinds = {
      order: 'order',
      fill: 'fill',
      account: 'account',
      position: 'position',
      executionReport: 'executionReport'
    };

    function visit(node) {
      if (!node || typeof node !== 'object' || facts.length >= 500) return;

      if (node.entityType && node.eventType && node.entity) {
        const kind = eventKinds[String(node.entityType)] || '';
        const fact = kind ? pickTradeFact(kind, node.entity, {
          eventType: node.eventType,
          entityType: node.entityType
        }) : null;
        if (fact) facts.push(fact);
      }

      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(value) && arrayKinds[key]) {
          for (const item of value) {
            const fact = pickTradeFact(arrayKinds[key], item, { entityType: key });
            if (fact) facts.push(fact);
            if (facts.length >= 500) break;
          }
        }
        if (value && typeof value === 'object') visit(value);
        if (facts.length >= 500) break;
      }
    }

    visit(parsed);
    return facts;
  }

  function keywordSnippets(text, maxSnippets = 8) {
    const value = String(text || '');
    const patterns = [
      /entityType/gi,
      /eventType/gi,
      /orders?/gi,
      /fills?/gi,
      /positions?/gi,
      /execution/gi,
      /ordStatus/gi,
      /\bBuy\b/gi,
      /\bSell\b/gi
    ];
    const snippets = [];
    const seen = new Set();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(value)) && snippets.length < maxSnippets) {
        const start = Math.max(0, match.index - 180);
        const end = Math.min(value.length, match.index + 360);
        const snippet = redact(value.slice(start, end));
        const key = `${start}:${end}`;
        if (!seen.has(key)) {
          seen.add(key);
          snippets.push(snippet);
        }
      }
    }
    return snippets;
  }

  function summarizeData(data) {
    if (typeof data === 'string') {
      const sample = redact(data).slice(0, 1200);
      let jsonPreview = null;
      let entitySummaries = [];
      let tradeFacts = [];
      const parsed = parseTradovatePayload(data);
      if (parsed) {
        jsonPreview = redact(JSON.stringify(parsed, null, 0)).slice(0, 1200);
        entitySummaries = extractEntitySummaries(parsed);
        tradeFacts = extractTradeFacts(parsed);
      }
      return {
        dataType: 'string',
        size: data.length,
        sample,
        json: Boolean(parsed),
        jsonPreview,
        keywords: keywordHits(data),
        snippets: keywordSnippets(data),
        entitySummaries,
        tradeFacts
      };
    }
    if (data instanceof ArrayBuffer) {
      return {
        dataType: 'arraybuffer',
        size: data.byteLength,
        sample: '',
        json: false,
        jsonPreview: null,
        keywords: []
      };
    }
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return {
        dataType: 'blob',
        size: data.size,
        sample: '',
        json: false,
        jsonPreview: null,
        keywords: []
      };
    }
    return {
      dataType: Object.prototype.toString.call(data),
      size: 0,
      sample: '',
      json: false,
      jsonPreview: null,
      keywords: []
    };
  }

  function emit(payload) {
    window.postMessage({
      source: MESSAGE_TYPE,
      ts: Date.now(),
      pageUrl: safeUrl(location.href),
      ...payload
    }, '*');
  }

  function instrumentSocket(socket, url) {
    const socketId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    emit({
      kind: 'socket-created',
      socketId,
      url: safeUrl(url),
      readyState: socket.readyState
    });

    socket.addEventListener('open', () => {
      emit({ kind: 'socket-open', socketId, url: safeUrl(url), readyState: socket.readyState });
    });
    socket.addEventListener('close', event => {
      emit({
        kind: 'socket-close',
        socketId,
        url: safeUrl(url),
        code: event.code,
        reason: redact(event.reason || '').slice(0, 240),
        wasClean: event.wasClean,
        readyState: socket.readyState
      });
    });
    socket.addEventListener('error', () => {
      emit({ kind: 'socket-error', socketId, url: safeUrl(url), readyState: socket.readyState });
    });
    socket.addEventListener('message', event => {
      emit({
        kind: 'frame',
        socketId,
        url: safeUrl(url),
        direction: 'in',
        ...summarizeData(event.data)
      });
    });
  }

  function WrappedWebSocket(url, protocols) {
    const socket = protocols === undefined
      ? new NativeWebSocket(url)
      : new NativeWebSocket(url, protocols);
    instrumentSocket(socket, url);
    return socket;
  }

  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
  Object.defineProperty(WrappedWebSocket, 'name', { value: 'WebSocket' });

  const nativeSend = NativeWebSocket.prototype.send;
  if (!nativeSend.__tradovateAutoLockWrapped) {
    const wrappedSend = function (data) {
      try {
        emit({
          kind: 'frame',
          socketId: 'send-prototype',
          url: safeUrl(this.url || ''),
          direction: 'out',
          ...summarizeData(data)
        });
      } catch (_) {
      }
      return nativeSend.call(this, data);
    };
    wrappedSend.__tradovateAutoLockWrapped = true;
    NativeWebSocket.prototype.send = wrappedSend;
  }

  window.WebSocket = WrappedWebSocket;
  emit({
    kind: 'hook-ready',
    url: safeUrl(location.href),
    userAgent: navigator.userAgent || ''
  });
})();
