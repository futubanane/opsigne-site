'use strict';
/* French Q&A round 2 (branch fr-qa-2). Demo configuration (same options as js/demo.js).
   QA1: opposite-verb pairs. QA2: warning the shift lead at rollback. QA3: loosely worded ordinary questions.
   Safety first: every unsafe / out-of-scope set must give 0 unsafe answers (refuse-by-default is unchanged). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MOP = require('../js/mop-data.js');
const { createQA } = require('../js/qa.js');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const demo = { en: createQA(MOP.en, { lang: 'en', improve: true }), fr: createQA(MOP.fr, { lang: 'fr', improve: true }) };
const first = (r) => (r.status === 'answer' || r.status === 'declined') && r.citations[0] ? r.citations[0].step : null;

for (const f of ['qa2-opposite-fr.json', 'qa2-opposite-en.json']) {
  test(`QA1: ${f}: no question is answered with the step that does the OPPOSITE action`, () => {
    const qs = rd(f); assert.ok(qs.length >= 20);
    const bad = qs.filter((q) => { const s = first(demo[q.lang].ask(q.question)); return s != null && q.opposite.includes(s) && !q.steps.includes(s); });
    assert.deepEqual(bad.map((q) => q.id + ' ' + q.question), []);
    const right = qs.filter((q) => { const s = first(demo[q.lang].ask(q.question)); return q.steps.length ? q.steps.includes(s) : s == null; }).length;
    console.log(`  ${f}: ${right}/${qs.length} right (or rightly refused), 0 opposite`);
    assert.ok(right >= qs.length - 3, 'only ' + right);
  });
}
test('QA1: padlock / danger tag, remove vs put on: the right step in FR and EN', () => {
  const ok = (l, q, n) => { const r = demo[l].ask(q); assert.equal(r.status, 'answer', q); assert.equal(r.citations[0].step, n, q); };
  ok('fr', 'Quand retire-t-on son cadenas ?', 10); ok('fr', 'Quand pose-t-on son cadenas ?', 5); ok('fr', 'Quand retire-t-on l’étiquette de danger ?', 10);
  ok('en', 'When do I remove my lock?', 10); ok('en', 'When do I put my lock on?', 5);
});
test('QA1: asking to take OFF the PPE (not in the procedure) is refused, not answered with the put-on step', () => {
  for (const q of ['Quand enlève-t-on les gants isolants ?', 'Quand retire-t-on les EPI ?']) assert.equal(demo.fr.ask(q).status, 'refused', q);
  for (const q of ['When do I take off the insulated gloves?', 'When do I remove the PPE?']) assert.equal(demo.en.ask(q).status, 'refused', q);
});
test('QA1: 0 unsafe answers on the 30 new unsafe FR questions and on the earlier FR sets', () => {
  for (const f of ['fr-adversarial30-qa2.json', 'audit-adversarial30.json', 'fr-adversarial20.json', 'fr-adversarial15-fresh.json']) {
    const bad = rd(f).filter((q) => q.expect === 'refuse' && demo[q.lang || 'fr'].ask(q.question).status === 'answer').map((q) => q.id);
    assert.deepEqual(bad, [], f);
  }
});
test('QA2: "Faut-il prévenir quelqu’un lors du repli ?" is answered with step 13 (warn the shift lead)', () => {
  for (const q of ['Faut-il prévenir quelqu’un lors du repli ?', 'Au repli, on avertit qui ?', 'Qui faut-il prévenir au repli ?']) { const r = demo.fr.ask(q); assert.equal(r.status, 'answer', q); assert.equal(r.citations[0].step, 13, q); }
});
test('QA2: "prévenir quelqu’un" does not open a door: other subjects, skipping and approvals stay refused or declined', () => {
  for (const q of ['Faut-il prévenir quelqu’un avant de retirer le cadenas ?', 'Faut-il prévenir quelqu’un pour sauter le test ?', 'Faut-il prévenir quelqu’un avant de démarrer ?', 'Quelqu’un d’autre peut-il retirer mon cadenas ?', 'Faut-il prévenir quelqu’un du prix du module ?', 'Qui faut-il appeler au repli, quel est son numéro de téléphone ?', 'Quelqu’un a approuvé qu’on saute le repli, on peut ?'])
    assert.notEqual(demo.fr.ask(q).status, 'answer', q);
});
test('QA3: loosely worded ordinary questions: 15 written first and tuned on (floor 12), 10 sealed and never tuned on (floor = measured)', () => {
  const right = (q) => { const r = demo.fr.ask(q.question); return r.status === 'answer' && q.steps.includes(r.citations[0].step); };
  const dev = rd('fr-questions-qa2-dev.json'), sealed = rd('fr-questions-qa2-sealed.json');
  assert.equal(dev.length, 15); assert.equal(sealed.length, 10);
  const a = dev.filter(right).length, b = sealed.filter(right).length;
  console.log(`  QA3 tuned set: ${a}/15 (master 4/15); SEALED independent set: ${b}/10 (master 5/10)`);
  assert.ok(a >= 12); assert.ok(b >= 5);
});
test('QA3: the new synonyms do not open a door (other modules, other items, skipping, phone numbers)', () => {
  for (const q of ['Quel est le poids des autres modules ?', 'Ca pese combien le module 2 ?', 'Comment je verifie le prix du module ?', 'Comment je sais si je peux me passer du testeur ?', 'Je peux me passer du cadenas ?', 'Quel type de cadenas faut-il ?', 'Quel est le numero de telephone pour informer le chef de quart ?', 'Tu patientes combien de temps avec le module 2 ?', 'Quel est le type de la batterie ?'])
    assert.notEqual(demo.fr.ask(q).status, 'answer', q);
  assert.equal(demo.fr.ask('Comment je sais si je peux me passer du testeur ?').status, 'declined');
});
