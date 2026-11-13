'use strict';
/* Round 3: refuse-by-default mechanism (question-intent support check), demo configuration (improve:true), EN + FR. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MOP = require('../js/mop-data.js');
const { createQA } = require('../js/qa.js');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const REF = process.env.OPSIGNE_PY || path.resolve(__dirname, '../../opsigne');
const red = JSON.parse(fs.readFileSync(path.join(REF, 'redteam/questions.json'), 'utf8')).questions;
const demo = { en: createQA(MOP.en, { lang: 'en', improve: true }), fr: createQA(MOP.fr, { lang: 'fr', improve: true }) };

function falseAnswers(lang, qs) { return qs.filter((q) => q.expect === 'refuse' && demo[lang].ask(q.question).status === 'answer').map((q) => q.id + ' ' + q.question); }

test('0 false answers in demo configuration: red-team 77, extra 58, FR dev/fresh/holdout2', () => {
  const sets = [['en', red], ['en', rd('extra-questions.json')], ['fr', rd('fr-questions-dev.json')], ['fr', rd('fr-questions-fresh.json')], ['fr', rd('fr-questions-holdout2.json')]];
  sets.forEach(([lang, qs]) => assert.deepEqual(falseAnswers(lang, qs), []));
});
test('my own adversarial questions (round 3 doubt set + two later sets): no false answer, except the one documented limit', () => {
  const all = [].concat(rd('r3-doubt.json'), rd('r3-blind.json'), rd('r3-blind2.json'));
  const fa = ['en', 'fr'].flatMap((l) => falseAnswers(l, all.filter((q) => q.lang === l)));
  assert.equal(fa.length, 1, JSON.stringify(fa));
  assert.match(fa[0], /^B-14 /, 'KNOWN LIMIT: two covered words that never relate ("voltage of the lock") can both appear in one step');
});
test('covered questions stay answerable (protective equipment, rollback, max load, weight, torque of the retaining screws)', () => {
  const ok = (l, q, n) => { const r = demo[l].ask(q); assert.equal(r.status, 'answer', q); assert.ok(r.citations.some((c) => c.step === n), q + ' -> ' + r.citations.map((c) => c.step)); };
  ok('en', 'What protective equipment is required?', 3); ok('en', 'How do I roll back?', 13); ok('en', 'What is the max load percent before starting?', 2);
  ok('en', 'How heavy is module 3?', 7); ok('en', 'What is the torque for the retaining screws?', 9); ok('en', 'How long do I wait after closing Q1?', 10);
  ok('fr', 'Quel couple de serrage pour les vis de maintien ?', 9); ok('fr', 'Combien pèse le module ?', 7);
});
test('attribute questions are refused whatever the object words are, also with an explicit step number', () => {
  for (const q of ['What is the torque in step 8?', 'How do I clean step 8?', 'What does step 9 cost?', 'Who manufactures the module in step 7?', 'How long does the whole procedure take?', 'How long does module 3 take?']) assert.equal(demo.en.ask(q).status, 'refused', q);
  for (const q of ['Quel est le couple à l’étape 8 ?', 'Combien coûte l’étape 9 ?', 'Combien de temps dure toute la procédure ?']) assert.equal(demo.fr.ask(q).status, 'refused', q);
  assert.equal(demo.en.ask('What does step 12 say?').status, 'answer');
});
test('a question about a rationale or an identifier value is refused unless the step writes it', () => {
  for (const q of ['Why is the module heavy?', 'What is the serial number of module 3?', 'What is the part number?']) assert.equal(demo.en.ask(q).status, 'refused', q);
  assert.equal(demo.fr.ask('Pourquoi faut-il deux personnes ?').status, 'refused');
});
test('shortcut questions are still declined with the cited step (not turned into refusals by the new check)', () => {
  for (const [q, n] of [['Can I skip the lockout to save time?', 5], ['Is it ok to work on module 3 without the arc-flash gloves?', 3]]) { const r = demo.en.ask(q); assert.equal(r.status, 'declined'); assert.equal(r.citations[0].step, n); }
});
test('strict mode is untouched by the mechanism (no support check, same reasons as the Python reference)', () => {
  const strict = createQA(MOP.en, { lang: 'en', improve: false });
  assert.equal(strict.keyWords, null);
  assert.equal(strict.ask('How do I clean the backplane connector?').status, 'answer', 'faithful port keeps the original weakness; only the demo configuration is hardened');
});
test('hostile inputs stay fast (no catastrophic regex backtracking) and never throw', () => {
  const evil = ['a '.repeat(250), 'how long '.repeat(55), 'what is the '.repeat(40), 'qui '.repeat(120), '\u0000'.repeat(400), 'é'.repeat(500), 'who who who ' + 'x'.repeat(480), 'quelle est la '.repeat(35)];
  for (const l of ['en', 'fr']) for (const q of evil) { const t = Date.now(); const r = demo[l].ask(q); assert.ok(Date.now() - t < 300, 'slow: ' + q.slice(0, 20)); assert.notEqual(r.status, 'answer', q.slice(0, 30)); }
});
