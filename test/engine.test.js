'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../js/engine.js');
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/mop-ups-017.json'), 'utf8'));
const docFr = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/mop-ups-017.fr.json'), 'utf8'));

const GOOD = { 2: 58, 6: 0.4, 10: 400, 11: 400.2, 12: 1.5 };
async function newRun(op = 'Alice Example') { return E.startRun(doc, op, { now: () => new Date(Date.UTC(2026, 9, 28, 8, 0, 0)) }); }
async function doStep(run, n, extra = {}) {
  const s = doc.steps[n - 1], a = { ...extra };
  if (s.warning) a.ack = true;
  if (s.verify2) a.verifier = 'Bob Example';
  if (s.hold) a.reading = GOOD[n];
  return run.complete(n, a);
}

test('fictional procedure has 13 steps, 12 main + 1 rollback; FR rendering has identical structure', () => {
  assert.equal(doc.steps.length, 13); assert.equal(doc.synthetic, true);
  assert.equal(doc.steps.filter((s) => s.rollback).length, 1);
  assert.deepEqual(docFr.steps.map((s) => [s.n, !!s.hold, !!s.verify2, !!s.rollback, !!s.warning, s.on_fail, s.reading && [s.reading.min, s.reading.max]]),
                   doc.steps.map((s) => [s.n, !!s.hold, !!s.verify2, !!s.rollback, !!s.warning, s.on_fail, s.reading && [s.reading.min, s.reading.max]]));
});

test('happy path: 12 steps in order -> completed; chain verifies; readings and verifier recorded', async () => {
  const run = await newRun();
  assert.equal((await run.state()).current.n, 1);
  for (let n = 1; n <= 12; n++) { const r = await doStep(run, n); assert.equal(r.ok, true, 'step ' + n); }
  const st = await run.state();
  assert.equal(st.status, 'completed'); assert.deepEqual(st.progress, { done: 12, total: 12 });
  assert.equal(st.completed[5].verifier, 'Bob Example'); assert.equal(st.completed[2].reading, 58);
  assert.equal(st.verification.ok, true);
  assert.equal(run.chain.events.at(-1).type, 'run_completed');
  assert.equal(run.chain.events.length, 1 + 12 + 1);
});

test('warning must be acknowledged (steps 3 and 5)', async () => {
  const run = await newRun();
  await doStep(run, 1); await doStep(run, 2);
  await assert.rejects(() => run.complete(3, {}), (e) => e.code === 'ack_required');
  assert.equal((await run.state()).current.n, 3);
  assert.equal((await run.complete(3, { ack: true })).ok, true);
});

test('hold point needs a numeric reading; garbage is rejected and nothing is logged', async () => {
  const run = await newRun(); await doStep(run, 1);
  const before = run.chain.events.length;
  for (const bad of [undefined, null, NaN, Infinity, '58', true]) {
    await assert.rejects(() => run.complete(2, { reading: bad }), (e) => e.code === 'reading_required', String(bad));
  }
  assert.equal(run.chain.events.length, before);
});

test('reading 70 against max 65 STOPS the run, logs the event, shows rollback step 13; completing it ends rolled_back', async () => {
  const run = await newRun(); await doStep(run, 1);
  const r = await run.complete(2, { reading: 70 });
  assert.equal(r.ok, false); assert.equal(r.stopped, true); assert.equal(r.contingency.n, 13);
  let st = await run.state();
  assert.equal(st.status, 'stopped'); assert.equal(st.current.n, 13); assert.deepEqual([st.stop.reading, st.stop.max], [70, 65]);
  assert.equal(run.chain.events.at(-1).type, 'reading_out_of_range');
  await assert.rejects(() => run.complete(3, { ack: true }), (e) => e.code === 'not_current');
  assert.equal((await run.complete(13, {})).status, 'rolled_back');
  st = await run.state();
  assert.equal(st.status, 'rolled_back'); assert.equal(st.current, null);
  await assert.rejects(() => run.complete(13, {}), (e) => e.code === 'run_closed');
});

test('boundaries are inclusive: 65 passes at step 2, 5 passes at step 6, -5 and 5 pass at step 12; 65.01 stops', async () => {
  let run = await newRun(); await doStep(run, 1);
  assert.equal((await run.complete(2, { reading: 65 })).ok, true);
  run = await newRun(); await doStep(run, 1);
  assert.equal((await run.complete(2, { reading: 65.01 })).stopped, true);
  run = await newRun();
  for (let n = 1; n <= 11; n++) await doStep(run, n);
  assert.equal((await run.complete(12, { reading: -5 })).ok, true);
  run = await newRun();
  for (let n = 1; n <= 11; n++) await doStep(run, n);
  assert.equal((await run.complete(12, { reading: 5.1 })).stopped, true);
});

test('step 5 needs a second person: different name, case/space/unicode-insensitive; same name rejected', async () => {
  const run = await newRun('Alice Example');
  for (let n = 1; n <= 4; n++) await doStep(run, n);
  await assert.rejects(() => run.complete(5, { ack: true }), (e) => e.code === 'verifier_required');
  for (const same of ['Alice Example', 'alice   example', ' ALICE EXAMPLE ', 'Ａlice Example', 'Alice\u200b Example']) {
    await assert.rejects(() => run.complete(5, { ack: true, verifier: same }), (e) => e.code === 'verifier_same', same);
  }
  assert.equal((await run.complete(5, { ack: true, verifier: 'Bob Example' })).ok, true);
});

test('deviation needs a reason (>=5 chars) and is bound to the current step', async () => {
  const run = await newRun(); await doStep(run, 1);
  await assert.rejects(() => run.deviation(2, 'ok'), (e) => e.code === 'reason_required');
  await assert.rejects(() => run.deviation(2, '     '), (e) => e.code === 'reason_required');
  await assert.rejects(() => run.deviation(5, 'valid reason here'), (e) => e.code === 'not_current');
  await run.deviation(2, '  Panel display frozen, re-read after reset ');
  const st = await run.state();
  assert.equal(st.deviations.length, 1); assert.equal(st.deviations[0].reason, 'Panel display frozen, re-read after reset');
});

test('steps cannot be skipped or done out of order', async () => {
  const run = await newRun();
  await assert.rejects(() => run.complete(2, { reading: 10 }), (e) => e.code === 'not_current');
  await assert.rejects(() => run.complete(13, {}), (e) => e.code === 'not_current');
});

test('operator name required', async () => {
  for (const bad of ['', '   ', null, 'x'.repeat(101)]) await assert.rejects(() => E.startRun(doc, bad), (e) => e.code === 'operator_required');
});

test('after tampering the run is "tampered", shows no current step, and refuses further actions', async () => {
  const run = await newRun(); await doStep(run, 1); await doStep(run, 2);
  run.chain.events[2].data.reading = 10;
  const st = await run.state();
  assert.equal(st.status, 'tampered'); assert.equal(st.current, null); assert.equal(st.verification.first_bad_seq, 3);
  await assert.rejects(() => doStep(run, 3), (e) => e.code === 'log_failed');
});

test('simulateTamper edits one past event so verification fails at exactly that event', async () => {
  const run = await newRun(); await doStep(run, 1); await doStep(run, 2); await doStep(run, 3);
  const info = run.simulateTamper();
  assert.equal(info.seq, 3); // the recorded reading
  const v = await run.chain.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, info.seq);
  assert.notEqual(info.before, info.after);
  const tiny = await newRun();
  assert.equal(tiny.simulateTamper().seq, 1);   // only run_started exists: edits the operator field
  assert.equal((await tiny.chain.verify()).first_bad_seq, 1);
});

test('Q&A events are logged in the chain, and do not change the run state', async () => {
  const run = await newRun(); await doStep(run, 1);
  await run.logQuestion({ status: 'refused', reason: 'low_confidence', steps: [], question: 'tire pressure?' });
  const st = await run.state();
  assert.equal(st.current.n, 2); assert.equal(run.chain.events.at(-1).type, 'question'); assert.equal(st.verification.ok, true);
});

test('parseReading accepts 5, -5, 5.5, 5,5 and rejects exponent, text, empty, too many decimals', () => {
  assert.equal(E.parseReading('5'), 5); assert.equal(E.parseReading(' -5 '), -5); assert.equal(E.parseReading('5.5'), 5.5); assert.equal(E.parseReading('5,5'), 5.5);
  assert.equal(E.parseReading('70'), 70); assert.equal(E.parseReading('+3'), 3);
  for (const bad of ['', ' ', 'abc', '1e3', '5.', '.5', '1,000.5', '0.00001', '12345678901', '--5', null, undefined]) assert.equal(E.parseReading(bad), null, String(bad));
});

test('report: JSON and HTML contain verification, head hash, readings; HTML escapes user text and has no script', async () => {
  const run = await newRun('<img src=x onerror=alert(1)>');
  await doStep(run, 1);
  await run.deviation(2, '<script>alert(1)</script> reason');
  const rep = await run.report({ lang: 'en', engine: 'webcrypto' });
  assert.equal(rep.json.verification.ok, true); assert.equal(rep.json.head, run.chain.events.at(-1).hash);
  assert.equal(rep.json.events.length, run.chain.events.length);
  assert.match(rep.html, /Not a safety system/); assert.match(rep.html, new RegExp(run.chain.events.at(-1).hash));
  assert.doesNotMatch(rep.html, /<script|<img/i); assert.match(rep.html, /&lt;script&gt;/);
  run.simulateTamper();
  const bad = await run.report({ lang: 'fr', engine: 'js-fallback' });
  assert.equal(bad.json.verification.ok, false); assert.match(bad.html, /ÉCHEC|NON VALIDE/);
  assert.match(bad.html, /Démo à données fictives/);
});
