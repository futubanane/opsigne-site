'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const C = require('../js/chain.js');
const S = require('../js/sha256.js');

async function build(n) {
  const ch = new C.Chain('RUN-0123456789');
  let t = Date.UTC(2026, 9, 28, 8, 0, 0);
  for (let i = 0; i < n; i++) await ch.append(i === 0 ? 'run_started' : 'step_completed', 'Alice Example', { step: i, reading: i * 2.5 }, new Date(t += 1000));
  return ch;
}

test('canonical JSON: sorted keys, compact, ASCII-escaped like Python json.dumps(sort_keys, separators, ensure_ascii)', () => {
  assert.equal(C.canonical({ b: 1, a: [true, null, 'x'] }), '{"a":[true,null,"x"],"b":1}');
  assert.equal(C.canonical({ n: 'é€😀' }), '{"n":"\\u00e9\\u20ac\\ud83d\\ude00"}');
  assert.equal(C.canonical({ s: 'a"b\\c\n\t\u0001\u007f' }), '{"s":"a\\"b\\\\c\\n\\t\\u0001\u007f"}');
  assert.throws(() => C.canonical({ x: NaN }));
  assert.throws(() => C.canonical({ x: Infinity }));
  assert.throws(() => C.canonical({ x: 1e-9 }), /exponent/);
});

test('genesis, linking and head', async () => {
  const ch = await build(4);
  assert.equal(ch.events[0].prev, C.GENESIS);
  for (let i = 1; i < 4; i++) assert.equal(ch.events[i].prev, ch.events[i - 1].hash);
  const v = await ch.verify();
  assert.deepEqual([v.ok, v.count, v.head], [true, 4, ch.events[3].hash]);
  assert.match(ch.events[0].ts, /^2026-10-28T08:00:01\.000000Z$/);
});

test('empty chain verifies, head is genesis', async () => {
  const v = await new C.Chain('RUN-x').verify();
  assert.deepEqual([v.ok, v.count, v.head], [true, 0, C.GENESIS]);
});

test('tamper: edit a past event content -> first bad is that event', async () => {
  const ch = await build(8);
  ch.events[3].data.reading = 1;
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, 4); assert.match(v.error, /does not match its hash/);
});

test('tamper: edit AND recompute that event hash -> next link breaks (first bad = following event)', async () => {
  const ch = await build(8);
  const e = ch.events[3]; e.data.reading = 1;
  const { hash, ...body } = e; e.hash = await S.sha256Hex(C.canonical(body));
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, 5); assert.match(v.error, /link/);
});

test('tamper: attacker recomputes the whole chain after the edit -> only the saved head (anchor) catches it', async () => {
  const ch = await build(6);
  ch.events[1].data.reading = 99;
  let prev = C.GENESIS;
  for (const e of ch.events) { e.prev = prev; const { hash, ...b } = e; e.hash = await S.sha256Hex(C.canonical(b)); prev = e.hash; }
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, null); assert.match(v.error, /head/i);
  const ok = await C.verifyEvents(ch.events, 'RUN-0123456789');   // chain alone, without the anchor, is self-consistent
  assert.equal(ok.ok, true);
});

test('tamper: delete a middle event', async () => {
  const ch = await build(8);
  ch.events.splice(3, 1);
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, 4);
});

test('tamper: reorder two events', async () => {
  const ch = await build(8);
  [ch.events[2], ch.events[5]] = [ch.events[5], ch.events[2]];
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.equal(v.first_bad_seq, 3);
});

test('tamper: delete the last event (truncation) -> caught by head', async () => {
  const ch = await build(5);
  ch.events.pop();
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.match(v.error, /truncated|head/i);
});

test('tamper: append garbage (several shapes)', async () => {
  for (const junk of [
    { hello: 'world' },
    'not an event',
    null,
    { run: 'RUN-0123456789', seq: 6, ts: 'x', type: 'step_completed', actor: 'm', data: {}, prev: 'f'.repeat(64), hash: 'a'.repeat(64) },
  ]) {
    const ch = await build(5);
    ch.events.push(junk);
    const v = await ch.verify();
    assert.equal(v.ok, false, JSON.stringify(junk)); assert.equal(v.first_bad_seq, 6);
  }
});

test('tamper: valid-looking appended event with correct link but head not updated -> caught by head', async () => {
  const ch = await build(5);
  const last = ch.events[4];
  const e = { run: ch.scope, seq: 6, ts: '2026-10-28T09:00:00.000000Z', type: 'step_completed', actor: 'x', data: {}, prev: last.hash };
  e.hash = await S.sha256Hex(C.canonical(e));
  ch.events.push(e);
  const v = await ch.verify();
  assert.equal(v.ok, false); assert.match(v.error, /head/i);
});

test('tamper: extra field, wrong run scope, bad seq, non-object', async () => {
  let ch = await build(3); ch.events[1].extra = 1;
  assert.match((await ch.verify()).error, /unexpected fields/);
  ch = await build(3); ch.events[1].run = 'RUN-other';
  assert.match((await ch.verify()).error, /another log/);
  ch = await build(3); ch.events[2].seq = 7;
  assert.match((await ch.verify()).error, /sequence/);
});

test('append refuses once the log fails verification (same rule as the Python engine)', async () => {
  const ch = await build(3);
  ch.events[1].data.step = 42;
  await assert.rejects(() => ch.append('step_completed', 'a', {}), /failed verification/);
});

test('same results with the pure-JS SHA-256 fallback', async () => {
  S.forceFallback(true);
  try {
    const ch = await build(6);
    assert.equal((await ch.verify()).ok, true);
    ch.events[2].data.reading = 6;
    const v = await ch.verify();
    assert.equal(v.ok, false); assert.equal(v.first_bad_seq, 3);
  } finally { S.forceFallback(false); }
});

test('JS-written log verifies with the Python reference chain (cross-implementation hash compatibility)', async (t) => {
  const py = process.env.OPSIGNE_PY || path.resolve(__dirname, '../../opsigne');
  if (!fs.existsSync(path.join(py, 'opsigne', 'chain.py'))) return t.skip('python reference not found');
  const ch = new C.Chain('RUN-0123456789');
  await ch.append('run_started', 'Zoë Müller 日本', { procedure_id: 'MOP-UPS-017', version: '1.0', content_hash: 'ab', operator: 'Zoë Müller 日本' }, new Date(Date.UTC(2026, 9, 28, 8, 0, 0, 123)));
  await ch.append('step_completed', 'Zoë Müller 日本', { step: 1, warning_acknowledged: true, note: 'quote " \\ \n é' }, new Date(Date.UTC(2026, 9, 28, 8, 0, 5, 7)));
  await ch.append('step_completed', 'Zoë Müller 日本', { step: 2, reading: 58, in_range: true }, new Date(Date.UTC(2026, 9, 28, 8, 1, 0)));
  await ch.append('reading_out_of_range', 'Zoë Müller 日本', { step: 6, reading: 7.5, min: 0, max: 5, unit: 'V AC', on_fail: 13 }, new Date(Date.UTC(2026, 9, 28, 8, 2, 0)));
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'chain-'));
  const f = path.join(dir, 'RUN-0123456789.jsonl');
  fs.writeFileSync(f, ch.toJsonl(), 'utf8');
  fs.writeFileSync(f + '.head', JSON.stringify({ count: ch.events.length, hash: ch.events.at(-1).hash }));
  const code = 'import sys; sys.path.insert(0, sys.argv[1]); from opsigne.chain import Chain; v = Chain(sys.argv[2], scope="RUN-0123456789").verify(); print(v.as_dict()); sys.exit(0 if v.ok else 1)';
  const r = spawnSync('python3', ['-I', '-B', '-c', code, py, f], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // and the Python verifier rejects the tampered JS log
  const tampered = fs.readFileSync(f, 'utf8').replace('"reading":58', '"reading":48');
  fs.writeFileSync(f, tampered);
  const r2 = spawnSync('python3', ['-I', '-B', '-c', code, py, f], { encoding: 'utf8' });
  assert.equal(r2.status, 1, r2.stdout);
  fs.rmSync(dir, { recursive: true });
});
