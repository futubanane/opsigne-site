'use strict';
/* Before/after numbers for every question set. usage: node tools/eval_r3.js [--list]
   Columns: n, correct (same grading as opsigne/redteam.py: status + first cited step), false answers (expected refuse but not refused),
   false refusals (expected answer/decline but refused), plus declined->answer downgrades. */
const fs = require('fs'), path = require('path');
const MOP = require('../js/mop-data.js'); const { createQA } = require('../js/qa.js');
const T = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../test', f), 'utf8'));
const REF = process.env.OPSIGNE_PY || path.resolve(__dirname, '../../opsigne');
const red = JSON.parse(fs.readFileSync(path.join(REF, 'redteam/questions.json'), 'utf8')).questions;
const C = T('owner-adversarial.json');
const owner = (l) => [].concat(C['must_not_answer_' + l].map((q) => ({ id: 'C', question: q, expect: 'refuse', steps: [] })),
  C['must_answer_' + l].map(([q, n]) => ({ id: 'C', question: q, expect: 'answer', steps: [n], any: true })),
  C['must_decline_' + l].map(([q, n]) => ({ id: 'C', question: q, expect: 'decline', steps: [n], any: true })));
const doubt = T('r3-doubt.json'), blind = T('r3-blind.json'), blind2 = T('r3-blind2.json');
const sets = [
  ['red-team EN (77)', 'en', red], ['extra EN (58)', 'en', T('extra-questions.json')],
  ['FR dev', 'fr', T('fr-questions-dev.json')], ['FR fresh', 'fr', T('fr-questions-fresh.json')], ['FR holdout2', 'fr', T('fr-questions-holdout2.json')],
  ['Owner EN', 'en', owner('en')], ['Owner FR', 'fr', owner('fr')],
  ['R3 doubt EN', 'en', doubt.filter((q) => q.lang === 'en')], ['R3 doubt FR', 'fr', doubt.filter((q) => q.lang === 'fr')],
  ['R3 blind EN', 'en', blind.filter((q) => q.lang === 'en')], ['R3 blind FR', 'fr', blind.filter((q) => q.lang === 'fr')],
  ['R3 blind2 EN', 'en', blind2.filter((q) => q.lang === 'en')], ['R3 blind2 FR', 'fr', blind2.filter((q) => q.lang === 'fr')]];
const WANT = { answer: 'answer', refuse: 'refused', decline: 'declined' };
const modes = [['strict/baseline', { improve: false }], ['demo (improve)', { improve: true }]];
const list = process.argv.includes('--list');
for (const [mn, mo] of modes) {
  console.log('== ' + mn);
  const tot = { n: 0, ok: 0, fa: 0, fr: 0 };
  for (const [name, lang, qs] of sets) {
    const qa = createQA(MOP[lang], Object.assign({ lang }, mo));
    let ok = 0, fa = 0, fr = 0, dd = 0; const bad = [];
    for (const q of qs) {
      const r = qa.ask(q.question), cs = r.citations.map((c) => c.step);
      const good = r.status === WANT[q.expect] && (r.status === 'refused' || !q.steps.length || (q.any ? q.steps.some((s) => cs.includes(s)) : q.steps.includes(cs[0])));
      if (good) ok++; else bad.push(`${q.id} [${r.status}${cs.length ? ' s' + cs : ''}] ${q.question}`);
      if (q.expect === 'refuse' && r.status === 'answer') fa++;   // 'declined' is not an answer (it only says: follow the step, escalate)
      if (q.expect === 'answer' && r.status === 'refused') fr++;
      if (q.expect === 'decline' && r.status === 'answer') dd++;
    }
    tot.n += qs.length; tot.ok += ok; tot.fa += fa; tot.fr += fr;
    console.log(`  ${name.padEnd(18)} n=${String(qs.length).padStart(3)} correct=${String(ok).padStart(3)} false_answers=${fa} false_refusals=${fr} decline->answer=${dd}`);
    if (list) bad.forEach((b) => console.log('      miss: ' + b));
  }
  console.log(`  TOTAL n=${tot.n} correct=${tot.ok} false_answers=${tot.fa} false_refusals=${tot.fr}`);
}
