/* OPSIGNE - audit report builder. Returns {json, html}. The HTML is self-contained (inline CSS, no script, no external reference);
   every dynamic value goes through esc(). The JSON carries the full chain so it can be re-verified independently. */
(function (root) {
  'use strict';
  var T = {
    en: {
      title: 'OPSIGNE - run report (fictional demo)', h1: 'Run report', disc: 'Demo with fictional data. Not a safety system.',
      meta: 'Generated in your browser. Nothing was sent anywhere. This report is not signed: keep the head hash somewhere else if you want to detect later changes.',
      proc: 'Procedure', operator: 'Operator', status: 'Run status', started: 'Started', generated: 'Report generated', run: 'Run id', chash: 'Procedure content hash (SHA-256)',
      ver: 'Chain verification', ok: 'VALID - the chain is intact', bad: 'INVALID - the chain does not verify', firstbad: 'First bad event', events: 'Events', head: 'Head hash (last event)', sha: 'SHA-256 engine used',
      steps: 'Steps', step: 'Step', result: 'Result', reading: 'Reading', verifier: 'Second person (simulated)', warn: 'Warning acknowledged', dev: 'Deviations', reason: 'Reason',
      none: 'none', log: 'Event log', seq: '#', time: 'Time (UTC)', type: 'Type', actor: 'Actor', data: 'Data', prev: 'Previous hash', hash: 'Hash', notdone: 'not done',
      done: 'done', stop: 'STOP - reading out of range', rollback: 'rollback done', range: 'allowed', st: { in_progress: 'in progress', completed: 'completed', stopped: 'stopped (rollback required)', rolled_back: 'rolled back', tampered: 'log failed verification' },
      ty: { run_started: 'run started', step_completed: 'step completed', reading_out_of_range: 'reading out of range', deviation: 'deviation', run_completed: 'run completed', question: 'question' }
    },
    fr: {
      title: 'OPSIGNE - rapport d’exécution (démo fictive)', h1: 'Rapport d’exécution', disc: 'Démo à données fictives. Ce n’est pas un système de sécurité.',
      meta: 'Généré dans votre navigateur. Rien n’a été envoyé. Ce rapport n’est pas signé : conservez l’empreinte de tête ailleurs si vous voulez détecter une modification ultérieure.',
      proc: 'Procédure', operator: 'Opérateur', status: 'Statut', started: 'Début', generated: 'Rapport généré', run: 'Identifiant', chash: 'Empreinte du contenu de la procédure (SHA-256)',
      ver: 'Vérification de la chaîne', ok: 'VALIDE - la chaîne est intacte', bad: 'NON VALIDE - ÉCHEC de la vérification', firstbad: 'Premier événement en défaut', events: 'Événements', head: 'Empreinte de tête (dernier événement)', sha: 'Moteur SHA-256 utilisé',
      steps: 'Étapes', step: 'Étape', result: 'Résultat', reading: 'Relevé', verifier: 'Seconde personne (simulée)', warn: 'Avertissement acquitté', dev: 'Écarts', reason: 'Raison',
      none: 'aucun', log: 'Journal des événements', seq: 'N°', time: 'Heure (UTC)', type: 'Type', actor: 'Acteur', data: 'Données', prev: 'Empreinte précédente', hash: 'Empreinte', notdone: 'non réalisée',
      done: 'faite', stop: 'ARRÊT - relevé hors plage', rollback: 'repli effectué', range: 'admis', st: { in_progress: 'en cours', completed: 'terminée', stopped: 'arrêtée (repli requis)', rolled_back: 'repli effectué', tampered: 'journal non valide' },
      ty: { run_started: 'début d’exécution', step_completed: 'étape validée', reading_out_of_range: 'relevé hors plage', deviation: 'écart', run_completed: 'fin d’exécution', question: 'question' }
    }
  };
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function J(o) { return JSON.stringify(o); }

  var CSS = 'body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#F7F2E9;color:#2B2118;margin:0;padding:24px}main{max-width:980px;margin:0 auto;background:#FFFCF6;border:1px solid #85745F;padding:24px}' +
    'h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{border:1px solid #85745F;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}' +
    'th{background:#EEE5D4}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem;overflow-wrap:anywhere}.disc{border:2px solid #2B2118;padding:8px 12px;font-weight:600}.ok{color:#2A6340;font-weight:700}.bad{color:#A0261C;font-weight:700}.mut{color:#5B4F43}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}dt{font-weight:600}dd{margin:0}';

  function build(d, lang) {
    var L = T[lang === 'fr' ? 'fr' : 'en'], st = d.state, v = st.verification, doc = d.doc, i;
    var steps = doc.steps.map(function (s) {
      var c = st.completed[s.n], res = L.notdone, rd = '', ver = '', w = '';
      if (c) { res = c.rollback ? L.rollback : L.done; if (c.reading !== undefined) rd = c.reading + ' ' + s.reading.unit + ' (' + L.range + ' ' + s.reading.min + '..' + s.reading.max + ')'; if (c.verifier) ver = c.verifier; if (c.warning_acknowledged) w = '✔'; }
      if (st.stop && st.stop.step === s.n) { res = L.stop; rd = st.stop.reading + ' ' + st.stop.unit + ' (' + L.range + ' ' + st.stop.min + '..' + st.stop.max + ')'; }
      return { n: s.n, title: s.title, result: res, reading: rd, verifier: ver, warning_acknowledged: w === '✔' };
    });
    var json = {
      report: 'OPSIGNE run report', language: lang, disclaimer: L.disc, fictional: true, generated_utc: d.generated, run_id: d.run_id,
      procedure: { id: doc.id, version: doc.version, title: doc.title, content_hash_sha256: d.content_hash }, operator: d.operator, status: st.status,
      progress: st.progress, steps: steps, deviations: st.deviations.map(function (x) { return { step: x.step, reason: x.reason, ts: x.ts }; }),
      verification: { ok: v.ok, events: v.count, first_bad_seq: v.first_bad_seq, error: v.error }, head: d.anchor.hash, head_count: d.anchor.count, sha256_engine: d.engine,
      events: d.events
    };
    var h = [];
    h.push('<!doctype html><html lang="' + (lang === 'fr' ? 'fr' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
    h.push('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">');
    h.push('<title>' + esc(L.title) + '</title><style>' + CSS + '</style></head><body><main>');
    h.push('<p class="disc">' + esc(L.disc) + '</p><h1>' + esc(L.h1) + '</h1><p class="mut">' + esc(L.meta) + '</p>');
    h.push('<dl><dt>' + L.run + '</dt><dd><code>' + esc(d.run_id) + '</code></dd><dt>' + L.proc + '</dt><dd>' + esc(doc.id) + ' v' + esc(doc.version) + ' - ' + esc(doc.title) + '</dd>' +
      '<dt>' + L.chash + '</dt><dd><code>' + esc(d.content_hash) + '</code></dd><dt>' + L.operator + '</dt><dd>' + esc(d.operator) + '</dd><dt>' + L.status + '</dt><dd>' + esc(L.st[st.status] || st.status) + ' (' + st.progress.done + '/' + st.progress.total + ')</dd>' +
      '<dt>' + L.started + '</dt><dd>' + esc(d.events[0] ? d.events[0].ts : '') + '</dd><dt>' + L.generated + '</dt><dd>' + esc(d.generated) + '</dd></dl>');
    h.push('<h2>' + L.ver + '</h2><p class="' + (v.ok ? 'ok' : 'bad') + '">' + (v.ok ? L.ok : L.bad) + '</p><dl>');
    if (!v.ok) h.push('<dt>' + L.firstbad + '</dt><dd>' + esc(v.first_bad_seq === null ? '-' : v.first_bad_seq) + ' - ' + esc(v.error) + '</dd>');
    h.push('<dt>' + L.events + '</dt><dd>' + esc(d.anchor.count) + '</dd><dt>' + L.head + '</dt><dd><code>' + esc(d.anchor.hash) + '</code></dd><dt>' + L.sha + '</dt><dd>' + esc(d.engine || '-') + '</dd></dl>');
    h.push('<h2>' + L.steps + '</h2><table><tr><th>' + L.step + '</th><th></th><th>' + L.result + '</th><th>' + L.reading + '</th><th>' + L.verifier + '</th><th>' + L.warn + '</th></tr>');
    steps.forEach(function (s) { h.push('<tr><td>' + s.n + '</td><td>' + esc(s.title) + '</td><td>' + esc(s.result) + '</td><td>' + esc(s.reading) + '</td><td>' + esc(s.verifier) + '</td><td>' + (s.warning_acknowledged ? '✔' : '') + '</td></tr>'); });
    h.push('</table><h2>' + L.dev + '</h2>');
    if (!st.deviations.length) h.push('<p class="mut">' + L.none + '</p>');
    else { h.push('<table><tr><th>' + L.step + '</th><th>' + L.reason + '</th><th>' + L.time + '</th></tr>'); st.deviations.forEach(function (x) { h.push('<tr><td>' + esc(x.step) + '</td><td>' + esc(x.reason) + '</td><td>' + esc(x.ts) + '</td></tr>'); }); h.push('</table>'); }
    h.push('<h2>' + L.log + '</h2><table><tr><th>' + L.seq + '</th><th>' + L.time + '</th><th>' + L.type + '</th><th>' + L.actor + '</th><th>' + L.data + '</th><th>' + L.prev + '</th><th>' + L.hash + '</th></tr>');
    for (i = 0; i < d.events.length; i++) {
      var e = d.events[i], bad = !v.ok && v.first_bad_seq === i + 1;
      h.push('<tr' + (bad ? ' class="bad"' : '') + '><td>' + esc(e && e.seq) + '</td><td>' + esc(e && e.ts) + '</td><td>' + esc((e && L.ty[e.type]) || (e && e.type)) + '</td><td>' + esc(e && e.actor) + '</td><td><code>' + esc(J(e && e.data)) + '</code></td><td><code>' + esc(e && e.prev) + '</code></td><td><code>' + esc(e && e.hash) + '</code></td></tr>');
    }
    h.push('</table><p class="disc">' + esc(L.disc) + '</p></main></body></html>');
    return { json: json, html: h.join('') };
  }

  var api = { build: build, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.OPSIGNE = root.OPSIGNE || {}; root.OPSIGNE.report = api; }
})(typeof window !== 'undefined' ? window : globalThis);
