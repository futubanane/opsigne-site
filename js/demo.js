/* OPSIGNE - interactive demo UI. Runs entirely in this tab: no network, no cookies, no storage. All user text goes through textContent
   (never innerHTML). Language follows <html lang>. Depends on: sha256.js, chain.js, qa.js, report.js, engine.js, mop-data.js. */
(function () {
  'use strict';
  var O = window.OPSIGNE, root = document.getElementById('demo-app');
  if (!root || !O || !O.engine) return;

  var lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  var DOC = O.MOP[lang];
  var qa = O.qa.createQA(DOC, { lang: lang, improve: true });
  if (/[?&]sha=js\b/.test(location.search)) O.sha.forceFallback(true);   // test hook: force the pure-JS SHA-256

  var T = {
    en: {
      stepOf: 'Step {n} of {t}', hold: 'Hold point', second: 'Second person', warning: 'Warning', ack: 'I have read this warning and acknowledge it.',
      readingLbl: 'Reading: {label}', range: 'allowed {min} to {max} {unit}', readingHint: 'Type the value you read (for example 58). Decimal comma or point both work.',
      try70: 'Try 70 here to see the stop.', simTitle: 'Simulation', simBody: 'In a real deployment the second person would sign in on their own device and be authenticated. Here you just type a second name, different from the operator\u2019s. Nothing is checked beyond that the names differ.',
      verifierLbl: 'Second person name (fictional)', confirm: 'Confirm step', dev: 'Record a deviation', devLbl: 'Reason for the deviation (at least 5 characters)', devSave: 'Save deviation', devOk: 'Deviation recorded in the log.',
      stopH: 'STOP - reading out of range', stopBody: 'You read {r} {u}; the allowed range is {min} to {max} {u}. Do not continue. Go to the rollback step defined by the approved procedure.',
      rbH: 'Rollback step {n}', rbConfirm: 'Confirm rollback done', doneH: 'Run completed', doneBody: '{n} steps confirmed, {e} events in the log. Verify the log or download the report.',
      rbDoneH: 'Run closed after rollback', rbDoneBody: 'The run stopped on an out-of-range reading and the rollback was confirmed. {e} events in the log.',
      tampH: 'Log does not verify', tampBody: 'The run is blocked: a log that fails verification is never used as the truth. Press Reset to start again.',
      err: { operator_required: 'Enter an operator name first.', ack_required: 'Tick the box to acknowledge the warning first.', verifier_required: 'A second person\u2019s name is required for this step.',
             verifier_same: 'The second person must be a different person from the operator.', reading_required: 'Enter a number (for example 58) for this hold point.', reason_required: 'Give a reason of at least 5 characters.',
             not_current: 'That is not the current step.', run_closed: 'This run is closed.', log_failed: 'The log failed verification, so nothing more can be recorded.', note_too_long: 'Note too long.' },
      types: { run_started: 'Run started', step_completed: 'Step confirmed', reading_out_of_range: 'Reading out of range', deviation: 'Deviation', run_completed: 'Run completed', question: 'Question' },
      ev: { operator: 'operator {x}', step: 'step {n}', reading: 'reading {r} {u}', second: 'second person {x}', ack: 'warning acknowledged', over: '{r} above max {m}', under: '{r} below min {m}', rollback: 'rollback' },
      logAll: 'Show all ({n})', logLast: 'Last 4 only', logHid: '{n} earlier events hidden.',
      empty: 'No event yet. Start a run: every action then appends one event here.', unverified: 'Not verified yet',
      vOk: 'Chain valid', vOkBody: '{n} events, each linked to the previous one. Head hash:', vBad: 'Chain NOT valid', vBadBody: 'First bad event: #{n}.',
      vErr: { fields: 'the event has unexpected fields', seq: 'sequence gap or reorder', scope: 'the event belongs to another log', link: 'the link to the previous hash is broken (an event was removed, inserted or reordered)',
              hash: 'the event content no longer matches its hash (it was edited)', head: 'the log no longer matches the saved head hash (truncated or replaced)' },
      vBadNo: 'The chain links are fine but the log is shorter or different from the saved head: {e}', markOk: 'valid', markBad: 'FIRST BAD EVENT', markAfter: 'after the break',
      tampDone: 'Simulation: event #{n} edited ({f}: {b} \u2192 {a}), no hash recomputed. Now press Verify.', noRun: 'Start a run first.',
      engineWc: 'SHA-256 via WebCrypto', engineJs: 'SHA-256 via the built-in JavaScript fallback', shown: 'Hashes shortened ({k} of 64 characters); the report has them in full.',
      qEmpty: 'Type a question first.', qAnswer: 'Answer from the approved procedure', qDeclined: 'Declined: the approved procedure does not allow this', qRefused: 'Refused: not covered',
      qNote: 'This is the closest approved step, not a judgement that it answers your question. Read it before acting.', qLogged: 'Logged in the chain as event #{n}.', qNotLogged: 'Not logged (no run in progress, or the log does not verify).',
      cite: 'Citation', repNone: 'Start a run to enable the report.', repReady: 'Report ready. The head hash it contains is {h}\u2026', dl: 'Download report (HTML)', dlj: 'Download report (JSON)'
    },
    fr: {
      stepOf: '\u00c9tape {n} sur {t}', hold: 'Point d\u2019arr\u00eat', second: 'Seconde personne', warning: 'Avertissement', ack: 'J\u2019ai lu cet avertissement et je l\u2019acquitte.',
      readingLbl: 'Relev\u00e9 : {label}', range: 'admis de {min} \u00e0 {max} {unit}', readingHint: 'Saisissez la valeur lue (par exemple 58). Virgule ou point d\u00e9cimal accept\u00e9s.',
      try70: 'Essayez 70 ici pour voir l\u2019arr\u00eat.', simTitle: 'Simulation', simBody: 'Dans un vrai d\u00e9ploiement, la seconde personne se connecterait sur son propre appareil et serait authentifi\u00e9e. Ici, saisissez simplement un second nom, diff\u00e9rent de celui de l\u2019op\u00e9rateur. Rien d\u2019autre n\u2019est v\u00e9rifi\u00e9 que la diff\u00e9rence des noms.',
      verifierLbl: 'Nom de la seconde personne (fictif)', confirm: 'Valider l\u2019\u00e9tape', dev: 'Signaler un \u00e9cart', devLbl: 'Raison de l\u2019\u00e9cart (5 caract\u00e8res minimum)', devSave: 'Enregistrer l\u2019\u00e9cart', devOk: '\u00c9cart enregistr\u00e9 dans le journal.',
      stopH: 'ARR\u00caT - relev\u00e9 hors plage', stopBody: 'Vous avez relev\u00e9 {r} {u} ; la plage admise est de {min} \u00e0 {max} {u}. Ne poursuivez pas. Passez \u00e0 l\u2019\u00e9tape de repli pr\u00e9vue par la proc\u00e9dure approuv\u00e9e.',
      rbH: '\u00c9tape de repli {n}', rbConfirm: 'Confirmer que le repli est effectu\u00e9', doneH: 'Ex\u00e9cution termin\u00e9e', doneBody: '{n} \u00e9tapes valid\u00e9es, {e} \u00e9v\u00e9nements dans le journal. V\u00e9rifiez le journal ou t\u00e9l\u00e9chargez le rapport.',
      rbDoneH: 'Ex\u00e9cution close apr\u00e8s repli', rbDoneBody: 'L\u2019ex\u00e9cution s\u2019est arr\u00eat\u00e9e sur un relev\u00e9 hors plage et le repli a \u00e9t\u00e9 confirm\u00e9. {e} \u00e9v\u00e9nements dans le journal.',
      tampH: 'Le journal ne se v\u00e9rifie pas', tampBody: 'L\u2019ex\u00e9cution est bloqu\u00e9e : un journal qui \u00e9choue \u00e0 la v\u00e9rification n\u2019est jamais pris pour la v\u00e9rit\u00e9. Appuyez sur R\u00e9initialiser pour recommencer.',
      err: { operator_required: 'Saisissez d\u2019abord un nom d\u2019op\u00e9rateur.', ack_required: 'Cochez la case pour acquitter l\u2019avertissement.', verifier_required: 'Le nom d\u2019une seconde personne est requis pour cette \u00e9tape.',
             verifier_same: 'La seconde personne doit \u00eatre diff\u00e9rente de l\u2019op\u00e9rateur.', reading_required: 'Saisissez un nombre (par exemple 58) pour ce point d\u2019arr\u00eat.', reason_required: 'Indiquez une raison d\u2019au moins 5 caract\u00e8res.',
             not_current: 'Ce n\u2019est pas l\u2019\u00e9tape en cours.', run_closed: 'Cette ex\u00e9cution est close.', log_failed: 'Le journal \u00e9choue \u00e0 la v\u00e9rification : plus rien ne peut \u00eatre enregistr\u00e9.', note_too_long: 'Note trop longue.' },
      types: { run_started: 'D\u00e9but d\u2019ex\u00e9cution', step_completed: '\u00c9tape valid\u00e9e', reading_out_of_range: 'Relev\u00e9 hors plage', deviation: '\u00c9cart', run_completed: 'Fin d\u2019ex\u00e9cution', question: 'Question' },
      ev: { operator: 'op\u00e9rateur {x}', step: '\u00e9tape {n}', reading: 'relev\u00e9 {r} {u}', second: 'seconde personne {x}', ack: 'avertissement acquitt\u00e9', over: '{r} au-dessus du max {m}', under: '{r} sous le min {m}', rollback: 'repli' },
      logAll: 'Tout afficher ({n})', logLast: '4 derniers seulement', logHid: '{n} \u00e9v\u00e9nements plus anciens masqu\u00e9s.',
      empty: 'Aucun \u00e9v\u00e9nement. D\u00e9marrez une ex\u00e9cution : chaque action ajoute ici un \u00e9v\u00e9nement.', unverified: 'Pas encore v\u00e9rifi\u00e9',
      vOk: 'Cha\u00eene valide', vOkBody: '{n} \u00e9v\u00e9nements, chacun reli\u00e9 au pr\u00e9c\u00e9dent. Empreinte de t\u00eate :', vBad: 'Cha\u00eene NON valide', vBadBody: 'Premier \u00e9v\u00e9nement en d\u00e9faut : n\u00b0{n}.',
      vErr: { fields: 'l\u2019\u00e9v\u00e9nement a des champs inattendus', seq: 'trou ou inversion dans la num\u00e9rotation', scope: 'l\u2019\u00e9v\u00e9nement appartient \u00e0 un autre journal', link: 'le lien avec l\u2019empreinte pr\u00e9c\u00e9dente est rompu (\u00e9v\u00e9nement supprim\u00e9, ins\u00e9r\u00e9 ou d\u00e9plac\u00e9)',
              hash: 'le contenu de l\u2019\u00e9v\u00e9nement ne correspond plus \u00e0 son empreinte (il a \u00e9t\u00e9 modifi\u00e9)', head: 'le journal ne correspond plus \u00e0 l\u2019empreinte de t\u00eate conserv\u00e9e (tronqu\u00e9 ou remplac\u00e9)' },
      vBadNo: 'Les liens de la cha\u00eene sont bons mais le journal est plus court ou diff\u00e9rent de l\u2019empreinte de t\u00eate conserv\u00e9e : {e}', markOk: 'valide', markBad: 'PREMIER \u00c9V\u00c9NEMENT EN D\u00c9FAUT', markAfter: 'apr\u00e8s rupture',
      tampDone: 'Simulation : \u00e9v\u00e9nement n\u00b0{n} modifi\u00e9 ({f} : {b} \u2192 {a}), aucune empreinte recalcul\u00e9e. Appuyez sur V\u00e9rifier.', noRun: 'D\u00e9marrez d\u2019abord une ex\u00e9cution.',
      engineWc: 'SHA-256 via WebCrypto', engineJs: 'SHA-256 via le code JavaScript de secours int\u00e9gr\u00e9', shown: 'Empreintes abr\u00e9g\u00e9es ({k} car. sur 64) ; le rapport les donne en entier.',
      qEmpty: 'Saisissez d\u2019abord une question.', qAnswer: 'R\u00e9ponse issue de la proc\u00e9dure approuv\u00e9e', qDeclined: 'Refus\u00e9 : la proc\u00e9dure approuv\u00e9e ne l\u2019autorise pas', qRefused: 'Refus : non couvert',
      qNote: 'C\u2019est l\u2019\u00e9tape approuv\u00e9e la plus proche, pas un jugement qu\u2019elle r\u00e9pond \u00e0 votre question. Lisez-la avant d\u2019agir.', qLogged: 'Consign\u00e9 dans la cha\u00eene : \u00e9v\u00e9nement n\u00b0{n}.', qNotLogged: 'Non consign\u00e9 (aucune ex\u00e9cution en cours, ou le journal ne se v\u00e9rifie pas).',
      cite: 'Citation', repNone: 'D\u00e9marrez une ex\u00e9cution pour activer le rapport.', repReady: 'Rapport pr\u00eat. L\u2019empreinte de t\u00eate qu\u2019il contient est {h}\u2026', dl: 'T\u00e9l\u00e9charger le rapport (HTML)', dlj: 'T\u00e9l\u00e9charger le rapport (JSON)'
    }
  }[lang];
  var f = function (s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o && o[k] !== undefined ? o[k] : ''; }); };

  /* ---------- tiny DOM helper: text only, never innerHTML ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag), i;
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] === true) e.setAttribute(k, ''); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    function add(c) {
      if (c == null) return;
      if (Array.isArray(c)) c.forEach(add); else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    for (i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  /* user-typed names are wrapped in Unicode bidi isolates (FSI..PDI) so an RTL name cannot reorder the surrounding sentence; display only, never hashed */
  function iso(x) { return '\u2068' + x + '\u2069'; }
  function short(x) { return x ? x.slice(0, 10) + '\u2026' : ''; }
  function say(msg) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); }

  var S = { run: null, st: null, tamper: null, verify: null, logAll: false, drawn: 0 };
  var LOG_TAIL = 4;

  /* ---------- engine label ---------- */
  function showEngine() {
    var e = O.sha.lastEngine(); if (!e) return;
    $('engine').textContent = e === 'webcrypto' ? T.engineWc : T.engineJs;
  }

  /* ---------- chain list ---------- */
  function evSummary(e) {
    var d = e && e.data || {}, p = [];
    try {
      if (e.type === 'run_started') return f(T.ev.operator, { x: iso(d.operator) });
      if (d.step !== undefined) p.push(f(T.ev.step, { n: d.step }));
      if (e.type === 'step_completed') {
        var st = DOC.steps[d.step - 1];
        if (d.reading !== undefined) p.push(f(T.ev.reading, { r: d.reading, u: st && st.reading ? st.reading.unit : '' }));
        if (d.verifier) p.push(f(T.ev.second, { x: iso(d.verifier) }));
        if (d.warning_acknowledged) p.push(T.ev.ack);
        if (d.rollback) p.push(T.ev.rollback);
      } else if (e.type === 'reading_out_of_range') p.push(d.reading > d.max ? f(T.ev.over, { r: d.reading + ' ' + d.unit, m: d.max }) : f(T.ev.under, { r: d.reading + ' ' + d.unit, m: d.min }));
      else if (e.type === 'deviation') p.push(String(d.reason).slice(0, 80));
      else if (e.type === 'question') p.push(String(d.status) + (d.steps && d.steps.length ? ' \u2192 ' + T.ev.step.replace('{n}', d.steps.join(',')) : ''));
    } catch (x) { return '?'; }
    return p.join(' \u00b7 ');
  }
  function renderChain() {
    var ol = $('chain'), evs = S.run ? S.run.chain.events : [], v = S.verify, i, nHid = 0;
    clear(ol); if (evs.length < S.drawn) S.drawn = 0;
    $('chain-empty').hidden = evs.length > 0;
    for (i = 0; i < evs.length; i++) {
      var e = evs[i], seq = i + 1, cls = 'ev' + (i < S.drawn ? ' ev-still' : ''), mark = null;   // ev-still: already on screen, no entrance replay on re-render
      if (v) {
        if (v.ok) { cls += ' ev-ok'; mark = h('span', { class: 'mark mark-ok' }, '\u2714 ', h('span', { class: 'sr-only', text: T.markOk })); }
        else if (v.first_bad_seq === seq) { cls += ' ev-bad'; mark = h('span', { class: 'mark mark-bad' }, '\u2716 ' + T.markBad); }
        else if (v.first_bad_seq && seq > v.first_bad_seq) { cls += ' ev-after'; mark = h('span', { class: 'mark mark-after' }, '? ' + T.markAfter); }
        else if (v.first_bad_seq && seq < v.first_bad_seq) { cls += ' ev-ok'; mark = h('span', { class: 'mark mark-ok' }, '\u2714 ', h('span', { class: 'sr-only', text: T.markOk })); }
      }
      var keep = S.logAll || evs.length <= LOG_TAIL || seq > evs.length - LOG_TAIL || (v && !v.ok && v.first_bad_seq === seq);   // collapsed: last 4 + the first bad event (never hidden)
      if (!keep) nHid++;
      ol.appendChild(h('li', { class: cls, hidden: !keep },
        h('div', { class: 'ev-head' }, h('span', { class: 'ev-n', text: '#' + seq }), h('strong', { text: (e && T.types[e.type]) || '?' }), mark),
        h('div', { class: 'ev-sum', text: evSummary(e) }),
        h('div', { class: 'ev-hash' }, h('span', { class: 'lbl', text: 'hash' }), h('code', { text: short(e && e.hash) }), h('span', { class: 'lbl', text: '\u2190 prev' }), h('code', { text: short(e && e.prev) }))));
    }
    S.drawn = evs.length;
    var tg = $('log-toggle'), collapsible = evs.length > LOG_TAIL;
    tg.hidden = !collapsible; tg.setAttribute('aria-expanded', String(S.logAll)); tg.textContent = S.logAll ? T.logLast : f(T.logAll, { n: evs.length });
    $('log-hid').hidden = !(nHid > 0); $('log-hid').textContent = nHid > 0 ? f(T.logHid, { n: nHid }) : '';
    $('chain-box').classList.toggle('is-open', S.logAll);
    var box = $('chain-box'); if (evs.length) box.scrollTop = box.scrollHeight;
    $('head').textContent = S.run && S.run.chain.anchor.count ? short(S.run.chain.anchor.hash) : '-';
    $('count').textContent = String(evs.length);
    $('btn-verify').disabled = !S.run; $('btn-tamper').disabled = !S.run || !!S.tamper; $('rep-html').disabled = !S.run; $('rep-json').disabled = !S.run;
    $('rep-note').textContent = S.run ? f(T.repReady, { h: S.run.chain.anchor.hash.slice(0, 12) }) : T.repNone;
    showEngine();
  }
  function renderVerify() {
    var box = $('verify-out'), v = S.verify; clear(box);
    if (!v) { box.className = 'verify v-none'; box.appendChild(h('p', { text: S.run ? T.unverified : T.noRun })); return; }
    if (v.ok) {
      box.className = 'verify v-ok';
      box.appendChild(h('p', { class: 'v-h' }, h('strong', { text: '\u2714 ' + T.vOk }), ' ', f(T.vOkBody, { n: v.count })));
      box.appendChild(h('p', null, h('code', { class: 'v-head', text: v.head })));
    } else {
      box.className = 'verify v-bad';
      box.appendChild(h('p', { class: 'v-h' }, h('strong', { text: '\u2716 ' + T.vBad })));
      var why = T.vErr[v.code] || v.error; why = why.charAt(0).toUpperCase() + why.slice(1);
      box.appendChild(h('p', { text: v.first_bad_seq ? f(T.vBadBody, { n: v.first_bad_seq }) + ' ' + why + '.' : f(T.vBadNo, { e: why }) }));
    }
  }

  /* ---------- execution pane ---------- */
  function refreshExec(focusHeading) {
    return S.run.state().then(function (st) { S.st = st; renderExec(focusHeading); });
  }
  function progressBar(st) {
    var bar = $('prog'); clear(bar);
    DOC.steps.filter(function (s) { return !s.rollback; }).forEach(function (s) {
      var c = st.completed[s.n] ? 'seg done' : (st.current && st.current.n === s.n ? 'seg cur' : 'seg');
      if (st.stop && st.stop.step === s.n) c = 'seg stop';
      bar.appendChild(h('span', { class: c }));
    });
    $('prog-text').textContent = st.status === 'in_progress' && st.current ? f(T.stepOf, { n: st.current.n, t: st.progress.total }) + ' \u00b7 ' + st.progress.done + '/' + st.progress.total : st.progress.done + '/' + st.progress.total;
  }
  function msg(id, text) { var m = $(id); if (m) m.textContent = text || ''; }

  function stepCard(step, st, rollback) {
    var card = h('div', { class: 'step-card' + (step.hold ? ' is-hold' : '') + (rollback ? ' is-rb' : '') });
    var tags = [];
    if (step.hold) tags.push(h('span', { class: 'tag tag-hold', text: T.hold }));
    if (step.verify2) tags.push(h('span', { class: 'tag tag-2p', text: T.second }));
    if (step.warning) tags.push(h('span', { class: 'tag tag-warn', text: '\u26a0 ' + T.warning }));
    card.appendChild(h('div', { class: 'step-tags' }, h('span', { class: 'step-n', text: rollback ? f(T.rbH, { n: step.n }) : f(T.stepOf, { n: step.n, t: st.progress.total }) }), tags));
    card.appendChild(h('h4', { id: 'step-h', tabindex: '-1', text: step.title }));
    card.appendChild(h('p', { class: 'step-text', text: step.text }));
    if (step.warning) {
      card.appendChild(h('div', { class: 'warn-box' }, h('p', null, h('strong', { text: '\u26a0 ' + T.warning + ' : ' }), step.warning),
        h('label', { class: 'check', for: 'ack' }, h('input', { type: 'checkbox', id: 'ack' }), h('span', { text: T.ack }))));
    }
    if (step.hold && !rollback) {
      var r = step.reading, hintId = 'reading-hint';
      card.appendChild(h('div', { class: 'field' },
        h('label', { for: 'reading', text: f(T.readingLbl, { label: r.label }) }),
        h('p', { class: 'range', id: 'range-hint', text: f(T.range, r) }),
        h('input', { id: 'reading', type: 'text', inputmode: r.min < 0 ? 'text' : 'decimal', autocomplete: 'off', 'aria-describedby': 'range-hint ' + hintId, maxlength: '14', 'data-step': String(step.n) }),
        h('p', { class: 'hint', id: hintId, text: T.readingHint + (step.n === 2 ? ' ' + T.try70 : '') })));
    }
    if (step.verify2) {
      card.appendChild(h('div', { class: 'field sim' }, h('p', { class: 'sim-note' }, h('strong', { text: T.simTitle + '. ' }), T.simBody),
        h('label', { for: 'verifier', text: T.verifierLbl }), h('input', { id: 'verifier', type: 'text', autocomplete: 'off', maxlength: '100' })));
    }
    card.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', id: 'confirm', text: rollback ? T.rbConfirm : T.confirm }),
      h('button', { class: 'btn ghost', type: 'button', id: 'dev-toggle', 'aria-expanded': 'false', 'aria-controls': 'dev-box', text: T.dev })));
    card.appendChild(h('div', { id: 'dev-box', class: 'dev-box', hidden: true },
      h('label', { for: 'dev-reason', text: T.devLbl }), h('textarea', { id: 'dev-reason', rows: '2', maxlength: '500' }),
      h('button', { class: 'btn ghost', type: 'button', id: 'dev-save', text: T.devSave })));
    card.appendChild(h('p', { class: 'msg', id: 'step-msg', role: 'alert' }));
    return card;
  }

  function renderExec(focusHeading) {
    var st = S.st, area = $('step-area'); clear(area);
    $('run-area').hidden = false; $('start-form').hidden = true;
    progressBar(st);
    var focusEl = null;
    if (st.status === 'in_progress') {
      var c = stepCard(st.current, st, false); area.appendChild(c); focusEl = $('step-h'); wire(st, st.current, false);
    } else if (st.status === 'stopped') {
      var s = st.stop;
      area.appendChild(h('div', { class: 'stop-box', role: 'alert', id: 'stop-box', tabindex: '-1' }, h('p', { class: 'stop-h', text: '\u2716 ' + T.stopH }),
        h('p', { text: f(T.stopBody, { r: s.reading, u: s.unit, min: s.min, max: s.max }) })));
      area.appendChild(stepCard(st.current, st, true)); wire(st, st.current, true); focusEl = $('stop-box');
    } else if (st.status === 'completed') {
      area.appendChild(h('div', { class: 'end-box end-ok', id: 'end-box', tabindex: '-1' }, h('p', { class: 'end-h', text: '\u2714 ' + T.doneH }), h('p', { text: f(T.doneBody, { n: st.progress.done, e: st.events }) }))); focusEl = $('end-box');
    } else if (st.status === 'rolled_back') {
      area.appendChild(h('div', { class: 'end-box end-rb', id: 'end-box', tabindex: '-1' }, h('p', { class: 'end-h', text: '\u21a9 ' + T.rbDoneH }), h('p', { text: f(T.rbDoneBody, { e: st.events }) }))); focusEl = $('end-box');
    } else {
      area.appendChild(h('div', { class: 'stop-box', role: 'alert', id: 'stop-box', tabindex: '-1' }, h('p', { class: 'stop-h', text: '\u2716 ' + T.tampH }), h('p', { text: T.tampBody }))); focusEl = $('stop-box');
    }
    if (focusHeading && focusEl) focusEl.focus({ preventScroll: false });
    renderChain();
  }

  function fail(e) {
    var code = e && e.code, text = T.err[code] || String(e && e.message || e);
    if (code === 'log_failed') { return S.run.chain.verify().then(function (v) { S.verify = v; renderVerify(); renderChain(); msg('step-msg', text); }); }
    msg('step-msg', text); return Promise.resolve();
  }

  function wire(st, step, rollback) {
    $('dev-toggle').addEventListener('click', function () {
      var b = $('dev-box'), open = b.hidden; b.hidden = !open; this.setAttribute('aria-expanded', String(open)); if (open) $('dev-reason').focus();
    });
    $('dev-save').addEventListener('click', function () {
      S.run.deviation(step.n, $('dev-reason').value).then(function () { $('dev-reason').value = ''; $('dev-box').hidden = true; $('dev-toggle').setAttribute('aria-expanded', 'false'); renderChain(); msg('step-msg', T.devOk); say(T.devOk); }, fail);
    });
    $('confirm').addEventListener('click', function () {
      msg('step-msg', '');
      var a = {};
      if (step.warning) a.ack = $('ack').checked;
      if (step.verify2) a.verifier = $('verifier').value;
      if (step.hold && !rollback) { var rv = O.engine.parseReading($('reading').value); a.reading = rv === null ? undefined : rv; }
      S.run.complete(step.n, a).then(function (res) {
        return refreshExec(true).then(function () {
          if (res.stopped) say(T.stopH); else if (res.status === 'completed') say(T.doneH); else if (S.st.current) say(f(T.stepOf, { n: S.st.current.n, t: S.st.progress.total }));
        });
      }, fail);
    });
  }

  /* ---------- start / reset / log buttons ---------- */
  function start(ev) {
    ev.preventDefault(); msg('start-msg', '');
    O.engine.startRun(DOC, $('op-name').value).then(function (run) { S.run = run; S.verify = null; S.tamper = null; renderVerify(); return refreshExec(true); },
      function (e) { msg('start-msg', T.err[e.code] || String(e.message)); });
  }
  function reset() {
    S.run = null; S.st = null; S.tamper = null; S.verify = null; S.logAll = false;
    clear($('step-area')); $('run-area').hidden = true; $('start-form').hidden = false; $('op-name').value = ''; msg('start-msg', ''); msg('tamper-out', '');
    renderChain(); renderVerify(); clear($('qa-out')); $('qa-in').value = ''; $('op-name').focus(); say('Reset');
  }
  /* ---------- tamper-found motion: ONE short sequence, cause -> effect, transform + opacity only, < 400 ms ----------
     Lead: the first bad event shakes (error jitter).  Decoration: its FIRST BAD EVENT mark fades in with it.
     Support: events after the break settle downward (outward from the cause, 3 max), then the status box rises in.
     Nothing blocks input (animations only, no timers). Under prefers-reduced-motion nothing is started: plain end state. */
  var EASE_OUT = (getComputedStyle(document.documentElement).getPropertyValue('--ease') || '').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';   // the site token, not a second curve
  function flagFailure() {
    if (!Element.prototype.animate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var bad = document.querySelector('#chain .ev-bad'); if (!bad) return;
    function go(el, frames, delay, dur) { if (!el) return; var a = el.animate(frames, { duration: dur, delay: delay, easing: EASE_OUT, fill: 'backwards' }); a.id = 'verify-flag'; }
    go(bad, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(5px)', offset: .35 }, { transform: 'translateX(-3px)', offset: .65 }, { transform: 'none' }], 0, 280);
    go(bad.querySelector('.mark-bad'), [{ opacity: 0 }, { opacity: 1 }], 0, 160);
    [].slice.call(document.querySelectorAll('#chain .ev-after:not([hidden])'), 0, 3).forEach(function (el, i) {
      go(el, [{ opacity: .45, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], [80, 130, 170][i], 200);
    });
    go($('verify-out'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 140, 220);
  }
  /* C4: loading state without flicker: aria-busy only after 120 ms, and a second press while pending is ignored */
  function busy(btn, promise) {
    var t = setTimeout(function () { btn.setAttribute('aria-busy', 'true'); }, 120);
    btn.setAttribute('data-pending', '1');
    function done() { clearTimeout(t); btn.removeAttribute('aria-busy'); btn.removeAttribute('data-pending'); }
    promise.then(done, done); return promise;
  }
  function verify() {
    var vb = $('btn-verify');
    if (!S.run || vb.getAttribute('data-pending')) return;
    busy(vb, S.run.chain.verify()).then(function (v) {
      S.verify = v; renderChain(); renderVerify();
      var badEl = document.querySelector('#chain .ev-bad');
      if (badEl) { var box = $('chain-box'); box.scrollTop = Math.max(0, badEl.offsetTop - box.offsetTop - 40); }   // show WHERE it broke
      $('verify-out').focus({ preventScroll: !!badEl }); say(v.ok ? T.vOk : T.vBad + ' #' + v.first_bad_seq);
      if (!v.ok) flagFailure();
    });
  }
  function tamper() {
    if (!S.run || S.tamper) return;
    var i = S.run.simulateTamper(); S.tamper = i; S.verify = null;
    msg('tamper-out', f(T.tampDone, { n: i.seq, f: i.field === 'reading' ? (lang === 'fr' ? 'relev\u00e9' : 'reading') : (lang === 'fr' ? 'acteur' : 'actor'), b: i.before, a: i.after }));
    renderChain(); renderVerify(); $('btn-verify').focus();
  }

  /* ---------- grounded Q&A ---------- */
  function ask(text) {
    var out = $('qa-out'); clear(out);
    if (!text || !text.trim()) { out.appendChild(h('p', { class: 'msg', text: T.qEmpty })); return; }
    var r = qa.ask(text), cls = r.status === 'answer' ? 'qa-ans' : (r.status === 'declined' ? 'qa-dec' : 'qa-ref');
    var title = r.status === 'answer' ? T.qAnswer : (r.status === 'declined' ? T.qDeclined : T.qRefused);
    var box = h('div', { class: 'qa-card ' + cls, tabindex: '-1', id: 'qa-card' }, h('p', { class: 'qa-h' }, h('span', { class: 'badge', text: (r.status === 'answer' ? '\u2714 ' : r.status === 'declined' ? '\u26d4 ' : '\u2716 ') + title })));
    if (r.status === 'refused') box.appendChild(h('p', { class: 'qa-text qa-refusal', text: r.answer }));
    else {
      r.answer.split('\n').forEach(function (line) { box.appendChild(h('p', { class: 'qa-text', text: line })); });
      box.appendChild(h('ul', { class: 'cites', 'aria-label': T.cite }, r.citations.map(function (c) { return h('li', null, h('strong', { text: T.cite + ' : ' }), h('code', { text: c.procedure_id + ' v' + c.version + (lang === 'fr' ? ' \u00b7 \u00e9tape ' : ' \u00b7 step ') + c.step }), ' ' + c.title); })));
    }
    out.appendChild(box);
    var note = h('p', { class: 'hint' }), pre = r.status === 'refused' ? '' : T.qNote + ' '; box.appendChild(note);
    var steps = r.citations.map(function (c) { return c.step; });
    var logged = S.run ? S.run.logQuestion({ status: r.status, reason: r.reason, steps: steps }).then(function (e) { note.textContent = pre + f(T.qLogged, { n: e.seq }); renderChain(); }, function () { note.textContent = pre + T.qNotLogged; })
                       : Promise.resolve(note.textContent = pre + T.qNotLogged);
    logged.then(function () { say(title); });
    box.focus({ preventScroll: true });
  }

  /* ---------- report download ---------- */
  function download(name, mime, text) {
    var url = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function report(kind) {
    if (!S.run) return;
    var rb = $(kind === 'html' ? 'rep-html' : 'rep-json'); if (rb.getAttribute('data-pending')) return;
    busy(rb, S.run.report({ lang: lang, engine: O.sha.lastEngine() })).then(function (rep) {
      var base = 'opsigne-' + (lang === 'fr' ? 'rapport' : 'report') + '-' + S.run.runId;
      if (kind === 'html') download(base + '.html', 'text/html;charset=utf-8', rep.html);
      else download(base + '.json', 'application/json;charset=utf-8', JSON.stringify(rep.json, null, 2));
      say(rep.json.verification.ok ? T.vOk : T.vBad);
    });
  }

  /* ---------- init ---------- */
  $('start-form').addEventListener('submit', start);
  $('btn-reset').addEventListener('click', reset);
  $('log-toggle').addEventListener('click', function () { S.logAll = !S.logAll; renderChain(); });
  $('btn-verify').addEventListener('click', verify);
  $('btn-tamper').addEventListener('click', tamper);
  $('qa-form').addEventListener('submit', function (e) { e.preventDefault(); ask($('qa-in').value); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-q]'), function (b) { b.addEventListener('click', function () { $('qa-in').value = b.getAttribute('data-q'); ask(b.getAttribute('data-q')); }); });
  $('rep-html').addEventListener('click', function () { report('html'); });
  $('rep-json').addEventListener('click', function () { report('json'); });
  $('chain-empty').textContent = T.empty; $('shown').textContent = f(T.shown, { k: 10 });
  renderChain(); renderVerify();
  root.setAttribute('data-ready', '1');
})();
