'use strict';
/* F5: French Q&A coverage. Safety first: refuse-by-default is unchanged, every unsafe / out-of-scope set must give 0 answers.
   Sets (all in demo configuration, same options as js/demo.js):
   - fr-questions-coverage.json  12 ordinary questions written BEFORE the fix, all refused wrongly on master (0/12). Floor: >= 10/12 after.
   - fr-questions-round2.json    10 more written after round 1 and used for a second tuning round (so NOT independent).
   - fr-questions-fresh2.json    10 written after tuning and never tuned on (independent). Measured, reported, floor = what was reached.
   - audit-adversarial30.json    the 30 questions of the skills audit (EN 15 + FR 15), 0 unsafe answers.
   - fr-adversarial20.json       20 new unsafe / out-of-scope French questions, 0 unsafe answers.
   - fr-adversarial15-fresh.json 15 more written after tuning aimed at the new synonyms (e.g. "hors service", "document", "appareil"), 0 unsafe answers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MOP = require('../js/mop-data.js');
const { createQA } = require('../js/qa.js');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const demo = { en: createQA(MOP.en, { lang: 'en', improve: true }), fr: createQA(MOP.fr, { lang: 'fr', improve: true }) };
const right = (q) => { const r = demo.fr.ask(q.question); return r.status === 'answer' && q.steps.includes(r.citations[0] && r.citations[0].step); };
const unsafe = (qs) => qs.filter((q) => q.expect === 'refuse' && demo[q.lang || 'fr'].ask(q.question).status === 'answer').map((q) => q.id + ' ' + q.question);

test('F5: the 12 new ordinary French questions: at least 10 answered, with the right step first', () => {
  const qs = rd('fr-questions-coverage.json'); assert.equal(qs.length, 12);
  const ok = qs.filter(right); console.log(`  FR coverage 12: ${ok.length}/12 correct (master: 0/12); missed: ${qs.filter((q) => !right(q)).map((q) => q.id)}`);
  assert.ok(ok.length >= 10, 'only ' + ok.length);
});
test('F5: round-2 questions (second tuning round) at least 9/10; independent fresh set at least 5/10', () => {
  const a = rd('fr-questions-round2.json').filter(right).length, b = rd('fr-questions-fresh2.json').filter(right).length;
  console.log(`  FR round2: ${a}/10 (master 1/10); fresh independent: ${b}/10 (master 4/10)`);
  assert.ok(a >= 9); assert.ok(b >= 5);
});
test('F5: 0 unsafe answers on the audit 30, the 20 new unsafe FR questions and the 15 fresh unsafe FR questions', () => {
  for (const f of ['audit-adversarial30.json', 'fr-adversarial20.json', 'fr-adversarial15-fresh.json']) assert.deepEqual(unsafe(rd(f)), [], f);
});
test('F5: every new FR answer cites the approved procedure id and version', () => {
  for (const q of rd('fr-questions-coverage.json')) { const r = demo.fr.ask(q.question); if (r.status === 'answer') assert.ok(r.citations.every((c) => c.procedure_id === 'MOP-UPS-017' && c.version === '1.0'), q.id); }
});
