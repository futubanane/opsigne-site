'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MOP = require('../js/mop-data.js');
const { createQA, REFUSAL } = require('../js/qa.js');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));

test('embedded data equals the JSON files (single source of truth)', () => {
  assert.deepEqual(MOP.en, rd('../data/mop-ups-017.json'));
  assert.deepEqual(MOP.fr, rd('../data/mop-ups-017.fr.json'));
});
test('exact refusal wording', () => {
  assert.equal(REFUSAL.fr, 'Non couvert par vos procédures approuvées, escaladez au chef de quart.');
  assert.equal(REFUSAL.en, 'Not covered by your approved procedures, escalate to shift lead.');
  assert.equal(createQA(MOP.fr, { lang: 'fr' }).ask('Quelle est la capitale de la France ?').answer, REFUSAL.fr);
  assert.equal(createQA(MOP.en, { lang: 'en', improve: true }).ask('What is the capital of France?').answer, REFUSAL.en);
});
const WANT = { answer: 'answer', refuse: 'refused', decline: 'declined' };
const FR = createQA(MOP.fr, { lang: 'fr' });
function run(file) {
  const qs = rd(file); let ok = 0, falseAns = 0, falseRef = 0; const fails = [];
  for (const q of qs) {
    const r = FR.ask(q.question);
    const good = r.status === WANT[q.expect] && (r.status === 'refused' || !q.steps.length || q.steps.includes(r.citations[0] && r.citations[0].step));
    if (good) ok++; else fails.push(q.id + ':' + r.status);
    if (q.expect === 'refuse' && r.status !== 'refused') falseAns++;
    if (q.expect === 'answer' && r.status === 'refused') falseRef++;
  }
  return { file, n: qs.length, ok, falseAns, falseRef, fails };
}
test('FR rule pack: question sets (dev = tuned on, fresh = used to find 2 bugs, holdout2 = written after the fixes)', () => {
  const res = ['fr-questions-dev.json', 'fr-questions-fresh.json', 'fr-questions-holdout2.json'].map(run);
  res.forEach((r) => console.log(`  FR ${r.file}: ${r.ok}/${r.n} correct, false answers ${r.falseAns}, false refusals ${r.falseRef}, misses ${JSON.stringify(r.fails)}`));
  assert.equal(res[0].falseAns, 0); assert.equal(res[1].falseAns, 0);
  assert.equal(res[2].falseAns, 3, 'baseline FR pack (improve off): 3 off-topic questions got the nearest step; the demo configuration (improve:true) fixes them, see test/refusal.test.js');
});
test('FR: apostrophes, accents and typographic quotes do not break step references', () => {
  for (const q of ['Que dit l’étape 8 ?', "Que dit l'etape 8 ?", 'QUE DIT L’ÉTAPE 8']) { const r = FR.ask(q); assert.equal(r.status, 'answer'); assert.equal(r.citations[0].step, 8); }
});
test('EN improved mode rejects attribute questions (price/password/warranty) but still answers the covered ones', () => {
  const en = createQA(MOP.en, { lang: 'en', improve: true });
  for (const q of ['What is the password of the control panel?', 'What is the price of the replacement module?', 'What is the warranty on the replacement module?']) assert.equal(en.ask(q).status, 'refused', q);
  assert.equal(en.ask('What is the weight of module 3?').status, 'answer');
});
