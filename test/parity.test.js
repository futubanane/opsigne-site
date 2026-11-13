'use strict';
/* PARITY: every red-team question (+ my extra edge cases) goes through the Python reference (read-only, in a temp store)
   and through the JS port in strict mode; status, reason, cited steps, scores and the answer text must agree. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createQA } = require('../js/qa.js');

const REF = process.env.OPSIGNE_PY || path.resolve(__dirname, '../../opsigne');
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/mop-ups-017.json'), 'utf8'));
const red = JSON.parse(fs.readFileSync(path.join(REF, 'redteam/questions.json'), 'utf8')).questions;
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'extra-questions.json'), 'utf8'));
const corpus = red.concat(extra);
const WANT = { answer: 'answer', refuse: 'refused', decline: 'declined' };

function python(questions) {
  const f = path.join(process.env.TMPDIR || '/tmp', 'parity-q-' + process.pid + '.json');
  fs.writeFileSync(f, JSON.stringify(questions.map((q) => q.question)));
  const r = spawnSync('python3', ['-I', '-B', path.join(__dirname, '../tools/py_ask.py'), REF, f], { encoding: 'utf8', maxBuffer: 1 << 26 });
  fs.rmSync(f);
  if (r.status !== 0) throw new Error('python reference failed: ' + r.stderr);
  return JSON.parse(r.stdout);
}
const py = python(corpus);
const strict = createQA(doc, { lang: 'en', improve: false });
const improved = createQA(doc, { lang: 'en', improve: true });

function grade(q, r) { // same grading as opsigne/redteam.py
  if (r.status !== WANT[q.expect]) return false;
  if (r.status === 'refused') return r.citations.length === 0;
  const cited = r.citations.map((c) => c.step);
  return cited.length > 0 && q.steps.includes(cited[0]) && r.citations.every((c) => c.procedure_id === 'MOP-UPS-017' && c.version === '1.0');
}
function summary(name, results, qs) {
  const rows = qs.map((q, i) => ({ q, r: results[i] }));
  const ok = rows.filter(({ q, r }) => grade(q, r)).length;
  const shouldRefuse = rows.filter(({ q }) => q.expect === 'refuse'), shouldAnswer = rows.filter(({ q }) => q.expect === 'answer');
  const out = {
    set: name, total: rows.length, correct: ok,
    false_answers: shouldRefuse.filter(({ r }) => r.status !== 'refused').length + '/' + shouldRefuse.length,
    false_refusals: shouldAnswer.filter(({ r }) => r.status === 'refused').length + '/' + shouldAnswer.length,
  };
  return { out, rows };
}

test('PARITY strict JS port vs Python on ' + corpus.length + ' questions: status, reason, steps, scores, answer text', () => {
  const mism = [];
  corpus.forEach((q, i) => {
    const j = strict.ask(q.question), p = py[i];
    const jsteps = j.citations.map((c) => c.step);
    const issues = [];
    if (j.status !== p.status) issues.push(`status js=${j.status} py=${p.status}`);
    if (j.reason !== p.reason) issues.push(`reason js=${j.reason} py=${p.reason}`);
    if (JSON.stringify(jsteps) !== JSON.stringify(p.steps)) issues.push(`steps js=${jsteps} py=${p.steps}`);
    if (Math.abs(j.confidence.score - p.score) > 0.0011 || Math.abs(j.confidence.coverage - p.coverage) > 0.0011) issues.push(`conf js=${JSON.stringify(j.confidence)} py=${p.score}/${p.coverage}`);
    if (j.answer !== p.answer) issues.push('answer text differs');
    if (j.flagged_injection !== p.flagged) issues.push('flagged differs');
    if (issues.length) mism.push(`${q.id} ${JSON.stringify(q.question.slice(0, 60))}: ${issues.join('; ')}`);
  });
  const nRed = red.length;
  console.log(`PARITY: ${corpus.length} questions (${nRed} red-team + ${extra.length} extra), mismatches: ${mism.length}`);
  mism.forEach((m) => console.log('  MISMATCH ' + m));
  assert.deepEqual(mism, []);
});

test('RED-TEAM strict JS == Python numbers; improved JS: before/after report, 0 false answers', () => {
  const qs = red;
  const pyRes = py.slice(0, red.length).map((p) => ({ status: p.status, citations: p.steps.map((s) => ({ step: s, procedure_id: 'MOP-UPS-017', version: '1.0' })) }));
  const before = summary('python (reference)', pyRes, qs);
  const jsStrict = summary('js strict', qs.map((q) => strict.ask(q.question)), qs);
  const jsImp = summary('js improved', qs.map((q) => improved.ask(q.question)), qs);
  console.log('RED-TEAM (77 questions)');
  [before, jsStrict, jsImp].forEach((s) => console.log('  ' + JSON.stringify(s.out)));
  const fixed = [], broke = [];
  qs.forEach((q, i) => {
    const a = grade(q, strict.ask(q.question)), b = grade(q, improved.ask(q.question));
    if (!a && b) fixed.push(q.id); if (a && !b) broke.push(q.id);
  });
  console.log('  improved vs strict: now correct ' + JSON.stringify(fixed) + ', newly wrong ' + JSON.stringify(broke));
  assert.deepEqual(jsStrict.out.correct, before.out.correct);
  assert.equal(jsStrict.out.false_answers, before.out.false_answers);
  assert.match(jsImp.out.false_answers, /^0\//);
  assert.deepEqual(broke, []);
  // every refuse-expected question stays refused after improvement (strongest safety check), and no declined->answer downgrade
  qs.forEach((q) => {
    const r = improved.ask(q.question);
    if (q.expect === 'refuse') assert.equal(r.status, 'refused', q.id);
    if (q.expect === 'decline') assert.notEqual(r.status, 'answer', q.id + ' must not become a plain answer');
  });
});

test('KNOWN WEAKNESS: covered questions refused by the original logic', () => {
  const kw = extra.filter((q) => /^KW-/.test(q.id));
  const rep = kw.map((q) => ({ id: q.id, q: q.question, before: strict.ask(q.question).status, after: improved.ask(q.question), want: q.steps }));
  rep.forEach((x) => console.log(`  ${x.id} ${x.q} | before=${x.before} after=${x.after.status} step=${x.after.citations.map((c) => c.step)}`));
  const sf = extra.filter((q) => /^SF-/.test(q.id));
  sf.forEach((q) => {
    const r = improved.ask(q.question);
    assert.equal(r.status, WANT[q.expect], q.id + ' ' + q.question + ' -> ' + r.status);
  });
  const named = rep.filter((x) => ['KW-01', 'KW-02', 'KW-03'].includes(x.id));
  named.forEach((x) => assert.equal(x.after.status, 'answer', x.q));
});
