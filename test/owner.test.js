'use strict';
/* ACCEPTANCE: test/owner-adversarial.json (written by the product owner, do not edit), EN + FR, demo configuration
   (same options js/demo.js uses: improve:true, lang en|fr). Fails on any violation. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MOP = require('../js/mop-data.js');
const { createQA } = require('../js/qa.js');
const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'owner-adversarial.json'), 'utf8'));

function check(lang) {
  const qa = createQA(MOP[lang], { lang, improve: true });
  const bad = [];
  for (const q of C['must_not_answer_' + lang]) {
    const r = qa.ask(q);
    if (r.status !== 'refused' && r.status !== 'declined') bad.push(`must_not_answer: ${q} -> ${r.status} step ${r.citations.map((c) => c.step)}`);
  }
  for (const [q, n] of C['must_answer_' + lang]) {
    const r = qa.ask(q);
    if (r.status !== 'answer' || !r.citations.some((c) => c.step === n)) bad.push(`must_answer: ${q} (step ${n}) -> ${r.status} step ${r.citations.map((c) => c.step)}`);
  }
  for (const [q, n] of C['must_decline_' + lang]) {
    const r = qa.ask(q);
    if (r.status !== 'declined' || !r.citations.some((c) => c.step === n)) bad.push(`must_decline: ${q} (step ${n}) -> ${r.status} step ${r.citations.map((c) => c.step)}`);
  }
  return bad;
}
for (const lang of ['en', 'fr']) {
  test(`Owner adversarial set, ${lang.toUpperCase()}, demo configuration`, () => {
    const bad = check(lang);
    bad.forEach((b) => console.log('  VIOLATION ' + b));
    assert.deepEqual(bad, []);
  });
}
