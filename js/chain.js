/* OPSIGNE - tamper-evident, hash-chained event log (browser port of opsigne/chain.py).
   Each event's hash = SHA-256 over the canonical JSON of the event WITHOUT its hash, and the body contains the previous hash.
   The "anchor" ({count, hash}) is the in-memory counterpart of Python's head sidecar: it detects truncation and whole-log replacement.
   Nothing here touches the network or any storage. */
(function (root) {
  'use strict';
  var sha = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.OPSIGNE.sha;
  var GENESIS = new Array(65).join('0');
  var KEYS = ['run', 'seq', 'ts', 'type', 'actor', 'data', 'prev', 'hash'];

  /* Same output as Python json.dumps(obj, sort_keys=True, separators=(',',':'), ensure_ascii=True, allow_nan=False)
     for strings, ints, finite plain decimals, bools, null, arrays and objects. */
  function str(s) {
    return JSON.stringify(s).replace(/[\u0080-\uffff]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); });
  }
  function canonical(v) {
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'string') return str(v);
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'number') {
      if (!isFinite(v)) throw new Error('non-finite number');
      var s = String(v);
      if (/e/i.test(s)) throw new Error('number would need exponent notation: ' + s);
      return s;
    }
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (t === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) { return str(k) + ':' + canonical(v[k]); }).join(',') + '}';
    }
    throw new Error('not serializable: ' + t);
  }
  function isPlain(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function pad(n, w) { return ('0000' + n).slice(-w); }
  function tsOf(d) { /* Python format %Y-%m-%dT%H:%M:%S.%fZ (microseconds; we only have milliseconds) */
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2) + 'T' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ':' + pad(d.getUTCSeconds(), 2) + '.' + pad(d.getUTCMilliseconds(), 3) + '000Z';
  }
  function bodyOf(ev) { var b = {}; Object.keys(ev).forEach(function (k) { if (k !== 'hash') b[k] = ev[k]; }); return b; }
  function eventHash(ev) { return sha.sha256Hex(canonical(bodyOf(ev))); }

  var CODES = { 'event has unexpected fields': 'fields', 'sequence gap or reorder': 'seq', 'event belongs to another log': 'scope',
    'previous-hash link broken (event removed, inserted or reordered)': 'link', 'event content does not match its hash (edited or re-formatted)': 'hash' };
  function res(ok, count, head, bad, error) { return { ok: ok, count: count, head: head, first_bad_seq: bad, error: error || '', code: ok ? 'ok' : (CODES[error] || 'head') }; }

  /* Chain-only verification (no anchor). Same checks and messages as Chain.verify in chain.py. */
  async function verifyEvents(events, scope) {
    var prev = GENESIS, i, ev, n = 0;
    for (i = 1; i <= events.length; i++) {
      ev = events[i - 1];
      if (!isPlain(ev) || Object.keys(ev).length !== KEYS.length || !KEYS.every(function (k) { return Object.prototype.hasOwnProperty.call(ev, k); }))
        return res(false, n, prev, i, 'event has unexpected fields');
      if (ev.seq !== i) return res(false, n, prev, i, 'sequence gap or reorder');
      if (ev.run !== scope) return res(false, n, prev, i, 'event belongs to another log');
      if (ev.prev !== prev) return res(false, n, prev, i, 'previous-hash link broken (event removed, inserted or reordered)');
      var good;
      try { good = (await eventHash(ev)) === ev.hash; } catch (e) { good = false; }
      if (!good) return res(false, n, prev, i, 'event content does not match its hash (edited or re-formatted)');
      prev = ev.hash; n++;
    }
    return res(true, n, prev, null, '');
  }

  function Chain(scope) { this.scope = scope; this.events = []; this.anchor = { count: 0, hash: GENESIS }; }
  Chain.prototype.verify = async function () {
    var v = await verifyEvents(this.events, this.scope);
    if (!v.ok) return v;
    if (this.anchor.count !== v.count || this.anchor.hash !== v.head)
      return res(false, v.count, v.head, null, 'log truncated or replaced: saved head says ' + this.anchor.count + ' events, log has ' + v.count);
    return v;
  };
  Chain.prototype.append = async function (type, actor, data, now) {
    var v = await this.verify();
    if (!v.ok) throw new Error('refusing to append: log failed verification (' + v.error + ')');
    var ev = { run: this.scope, seq: v.count + 1, ts: tsOf(now || new Date()), type: type, actor: actor, data: data, prev: v.head };
    ev.hash = await eventHash(ev);       /* canonical() rejects NaN/inf */
    this.events.push(ev);
    this.anchor = { count: ev.seq, hash: ev.hash };
    return ev;
  };
  Chain.prototype.toJsonl = function () { return this.events.map(function (e) { return canonical(e); }).join('\n') + (this.events.length ? '\n' : ''); };

  var api = { GENESIS: GENESIS, KEYS: KEYS, canonical: canonical, eventHash: eventHash, verifyEvents: verifyEvents, Chain: Chain, tsOf: tsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.OPSIGNE = root.OPSIGNE || {}; root.OPSIGNE.chain = api; }
})(typeof window !== 'undefined' ? window : globalThis);
