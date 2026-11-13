/* OPSIGNE - guided execution engine (browser port of opsigne/engine.py). Run state is a pure fold over the run's hash-chained events.
   All state lives in memory (one Run object); nothing is stored, sent or persisted. */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var sha = isNode ? require('./sha256.js') : root.OPSIGNE.sha;
  var chainMod = isNode ? require('./chain.js') : root.OPSIGNE.chain;
  var reportMod = isNode ? require('./report.js') : root.OPSIGNE.report;

  function EngineError(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  /* same identity normalisation as procedure.ident(): NFKC, drop invisible chars, collapse spaces, casefold */
  function ident(name) {
    var n = String(name).normalize('NFKC').replace(/[\p{Cf}\p{Cc}]/gu, '');
    return n.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  }
  function cleanName(v, code) {
    if (typeof v !== 'string' || !v.trim() || v.length > 100) throw EngineError(code);
    return v.trim();
  }
  function reasonOf(v) {
    if (typeof v !== 'string' || v.trim().length < 5 || v.length > 500) throw EngineError('reason_required');
    return v.trim();
  }
  /* "58", "5,5", "-5" -> number; anything else -> null. No exponent, at most 4 decimals, so JSON stays identical in every language. */
  function parseReading(s) {
    if (typeof s !== 'string') return null;
    var t = s.trim().replace(',', '.');
    if (!/^[+-]?\d{1,9}(\.\d{1,4})?$/.test(t)) return null;
    return Number(t);
  }
  function newRunId() {
    var c = root.crypto, a = new Uint8Array(5), i, s = 'RUN-';
    if (c && c.getRandomValues) c.getRandomValues(a); else for (i = 0; i < 5; i++) a[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < 5; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s;
  }

  function Run(doc, chain, operator, now) { this.doc = doc; this.chain = chain; this.operator = operator; this.now = now || function () { return new Date(); }; this.runId = chain.scope; }

  async function startRun(doc, operator, opts) {
    opts = opts || {};
    operator = cleanName(operator, 'operator_required');
    var now = opts.now || function () { return new Date(); };
    var chain = new chainMod.Chain(opts.runId || newRunId());
    var contentHash = await sha.sha256Hex(chainMod.canonical(doc));
    var run = new Run(doc, chain, operator, now);
    run.contentHash = contentHash;
    await chain.append('run_started', operator, { procedure_id: doc.id, version: doc.version, content_hash: contentHash, operator: operator }, now());
    return run;
  }

  Run.prototype.state = async function () {
    var ver = await this.chain.verify(), evs = this.chain.events, doc = this.doc;
    var status = 'in_progress', done = {}, stop = null, devs = [], i, e, d;
    for (i = 1; i < evs.length; i++) {
      e = evs[i]; d = e && e.data;
      if (!d || typeof d !== 'object') continue;
      if (e.type === 'step_completed') { done[d.step] = Object.assign({}, d, { ts: e.ts, actor: e.actor }); if (d.rollback) status = 'rolled_back'; }
      else if (e.type === 'reading_out_of_range') { status = 'stopped'; stop = d; }
      else if (e.type === 'deviation') devs.push(Object.assign({}, d, { ts: e.ts, actor: e.actor }));
      else if (e.type === 'run_completed') status = 'completed';
    }
    var main = doc.steps.filter(function (s) { return !s.rollback; }), cur = null;
    if (status === 'in_progress') cur = main.find(function (s) { return !done[s.n]; }) || null;
    else if (status === 'stopped') cur = doc.steps[stop.on_fail - 1];
    if (!ver.ok) { status = 'tampered'; cur = null; }
    return { run_id: this.runId, status: status, current: cur, completed: done, deviations: devs, stop: stop, operator: this.operator,
             progress: { done: main.filter(function (s) { return done[s.n]; }).length, total: main.length }, verification: ver, events: evs.length };
  };

  Run.prototype._active = async function () {
    var st = await this.state();
    if (!st.verification.ok) throw EngineError('log_failed', 'run log failed verification: ' + st.verification.error);
    if (st.status !== 'in_progress' && st.status !== 'stopped') throw EngineError('run_closed', 'run is ' + st.status);
    return st;
  };

  Run.prototype.complete = async function (step, a) {
    a = a || {};
    var st = await this._active(), cur = st.current;
    if (step !== cur.n) throw EngineError('not_current', 'step ' + step + ' is not the current step (current: ' + cur.n + ')');
    var data = { step: cur.n };
    if (cur.warning && a.ack !== true) throw EngineError('ack_required');
    if (cur.warning) data.warning_acknowledged = true;
    if (cur.verify2) {
      var v = cleanName(a.verifier, 'verifier_required');
      if (ident(v) === ident(st.operator)) throw EngineError('verifier_same');
      data.verifier = v;
    }
    if (typeof a.note === 'string' && a.note.trim()) { if (a.note.length > 500) throw EngineError('note_too_long'); data.note = a.note.trim(); }
    var actor = this.operator, now = this.now;
    if (st.status === 'stopped') {       /* only the contingency step may be done */
      data.rollback = true;
      await this.chain.append('step_completed', actor, data, now());
      return { ok: true, status: 'rolled_back' };
    }
    if (cur.hold) {
      var r = cur.reading;
      if (typeof a.reading !== 'number' || !isFinite(a.reading)) throw EngineError('reading_required');
      if (!(r.min <= a.reading && a.reading <= r.max)) {
        await this.chain.append('reading_out_of_range', actor, { step: cur.n, reading: a.reading, min: r.min, max: r.max, unit: r.unit, on_fail: cur.on_fail }, now());
        return { ok: false, stopped: true, reason: 'reading out of tolerance', contingency: this.doc.steps[cur.on_fail - 1] };
      }
      data.reading = a.reading; data.in_range = true;
    }
    await this.chain.append('step_completed', actor, data, now());
    var doneAll = this.doc.steps.filter(function (m) { return !m.rollback; }).every(function (m) { return st.completed[m.n] || m.n === cur.n; });
    if (doneAll) { await this.chain.append('run_completed', actor, {}, now()); return { ok: true, status: 'completed' }; }
    return { ok: true, status: 'in_progress' };
  };

  Run.prototype.deviation = async function (step, reason) {
    var st = await this._active();
    reason = reasonOf(reason);
    if (step !== st.current.n) throw EngineError('not_current');
    await this.chain.append('deviation', this.operator, { step: step, reason: reason }, this.now());
  };

  /* Q&A is logged with status, reason and cited steps only (not the free text), so a question cannot smuggle text into the report. */
  Run.prototype.logQuestion = async function (q) {
    return this.chain.append('question', this.operator, { status: q.status, reason: q.reason, steps: q.steps || [] }, this.now());
  };

  /* Demo only: edit one PAST event in place, without recomputing any hash, like someone editing the stored log. */
  Run.prototype.simulateTamper = function () {
    var evs = this.chain.events, i, e;
    for (i = 0; i < evs.length; i++) if (evs[i].data && typeof evs[i].data.reading === 'number') {
      e = evs[i]; var before = e.data.reading; e.data.reading = before > 10 ? before - 10 : before + 10;
      return { seq: e.seq, field: 'reading', before: before, after: e.data.reading, type: e.type };
    }
    e = evs.length > 1 ? evs[1] : evs[0];
    var b = e.actor; e.actor = 'Mallory Example';
    return { seq: e.seq, field: 'actor', before: b, after: e.actor, type: e.type };
  };

  Run.prototype.report = async function (opts) {
    var st = await this.state();
    var data = { run_id: this.runId, doc: this.doc, operator: this.operator, content_hash: this.contentHash, state: st,
                 events: JSON.parse(JSON.stringify(this.chain.events)), anchor: this.chain.anchor, engine: (opts && opts.engine) || '', generated: this.now().toISOString() };
    return reportMod.build(data, (opts && opts.lang) || 'en');
  };

  var api = { startRun: startRun, parseReading: parseReading, ident: ident, EngineError: EngineError };
  if (isNode) module.exports = api; else { root.OPSIGNE = root.OPSIGNE || {}; root.OPSIGNE.engine = api; }
})(typeof window !== 'undefined' ? window : globalThis);
