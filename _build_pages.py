#!/usr/bin/env python3
"""Generates index.html (FR), en/index.html (EN) and js/bundle.js from one structure so both pages stay in sync.
Run: python3 _build_pages.py   (stdlib only; outputs are committed)."""
import html, json, os
ROOT = os.path.dirname(os.path.abspath(__file__))
E = lambda s: html.escape(s.replace("'", "\u2019"))

COPY = {
"fr": {
 "lang": "fr", "css": "css/site.css", "self": "index.html", "other": "en/index.html", "other_lbl": "EN", "other_title": "English version",
 "title": "OPSIGNE - Exécuter les procédures approuvées, et pouvoir le montrer",
 "desc": "OPSIGNE guide les techniciens datacenter pas à pas dans les procédures approuvées, consigne chaque étape critique dans un journal à preuve d'altération.",
 "mail": "mailto:bonjour@opsigne.example?subject=OPSIGNE%20-%20Parlons-en",
 "cta": "Parlons-en", "skip": "Aller au contenu",
 "nav": [("#fonctionnement", "Fonctionnement"), ("#demo", "Démo"), ("#limites", "Limites de sécurité"), ("#partenaires", "Partenaires de conception")],
 "hero_eyebrow": "Procédures d'exploitation de datacenter",
 "h1": "Une procédure approuvée ne vaut que si l'on peut montrer qu'elle a été suivie, étape par étape.",
 "lead": "OPSIGNE guide les techniciens pas à pas dans vos procédures approuvées (MOP, SOP, EOP), consigne chaque étape critique dans un journal dont toute modification se détecte, et ne répond qu'à partir de vos documents approuvés.",
 "hero_sec": "Essayer la démo",
 "pb_eyebrow": "Le problème",
 "pb_h": "La procédure existe. Ce qui manque, c'est la trace de ce qui s'est vraiment passé.",
 "pb_cards": [
  ("La procédure est écrite, le geste varie", "Le MOP est dans un classeur ou un PDF. Sous la pression d'une fenêtre de maintenance, des étapes sont sautées, réordonnées ou faites de mémoire. On le découvre après l'incident, rarement avant."),
  ("Le savoir-faire part avec les seniors", "L'ordre réel des gestes, la valeur qui doit alerter, le piège propre à une baie : tout cela vit dans la tête de quelques personnes. Quand elles changent de poste ou partent, il ne reste que le document."),
  ("L'audit se prépare dans l'urgence", "Reconstituer qui a fait quoi, quand, avec quelle version du document, à partir de mails, de photos et de souvenirs, prend des jours, et le résultat reste discutable."),
 ],
 "pb_note": "Volontairement sans chiffre : nous n'affichons aucune statistique dont nous ne pourrions pas nommer la source ici.",
 "how_eyebrow": "Comment ça marche",
 "how_h": "Quatre idées, démontrées sur une procédure fictive.",
 "how_sub": "Chaque bloc ci-dessous existe aujourd'hui dans une démo de preuve, sur une procédure inventée (remplacement d'un module d'onduleur). Ce n'est pas encore un produit. Vous pouvez essayer ces idées dans la démo plus bas.",
 "how": [
  ("01", "Exécution guidée, avec points d'arrêt", "Le technicien voit une étape à la fois. Aux points d'arrêt, il doit saisir la valeur relevée : hors tolérance, l'étape de repli prévue par la procédure s'affiche. Une seconde personne peut être exigée pour vérifier. Tout écart est consigné avec sa raison.", "Exemple fictif : relevé 70 % pour un maximum de 65 % - arrêt, retour à l'étape de repli."),
  ("02", "Un journal dont toute modification se détecte", "Chaque étape critique devient un événement relié au précédent par une empreinte SHA-256. Modifier un événement passé casse la chaîne, et la vérification le montre. Ce n'est pas un coffre-fort inviolable : c'est un journal qui rend l'altération visible.", "Exemple fictif : un relevé modifié après coup -> vérification : chaîne rompue à l'événement 7."),
  ("03", "Des réponses uniquement issues de vos documents approuvés", "Une question posée en cours d'intervention reçoit en réponse le texte de l'étape approuvée, avec l'identifiant, la version et le numéro d'étape. Si rien dans les documents approuvés ne répond, OPSIGNE refuse de répondre au lieu de deviner.", "Exemple fictif : « Quelle est la pression des pneus du chariot ? » -> « Non couvert par vos procédures approuvées, escaladez au chef de quart. »"),
  ("04", "Un rapport d'audit exportable", "Pour chaque exécution : qui, quand, quelle version de la procédure, quelles valeurs relevées, quels écarts, plus l'empreinte de tête de la chaîne, à conserver ailleurs si vous le souhaitez. Export JSON et HTML. Le rapport aide à produire des preuves ; il ne remplace ni votre auditeur ni votre jugement.", "Exemple fictif : RUN-0001, 13 étapes, 1 écart, empreinte de tête affichée."),
 ],
 "demo_eyebrow": "Démo interactive",
 "demo_h": "Essayez une intervention fictive, sans rien installer.",
 "safe_eyebrow": "Limite de sécurité",
 "safe_h": "OPSIGNE ne pilote jamais d'équipement, n'invente jamais d'étape. La procédure approuvée reste toujours l'autorité.",
 "safe": [
  ("Aucune connexion aux équipements", "OPSIGNE n'envoie aucune commande et ne lit aucun automate. Les valeurs sont saisies par la personne sur place."),
  ("Aucune étape inventée", "Les réponses reprennent le texte approuvé. Pas de génération libre, pas de reformulation qui changerait le sens."),
  ("En cas de doute, la procédure gagne", "Si l'outil et le document approuvé semblent diverger, on suit le document approuvé et on appelle le responsable d'astreinte."),
  ("Pas un système de sécurité", "OPSIGNE ne remplace ni les consignes de sécurité du site, ni les verrouillages, ni le jugement des personnes habilitées."),
 ],
 "who_eyebrow": "Pour qui",
 "who_h": "Pour les équipes qui exploitent les salles.",
 "who_sub": "Opérateurs de colocation et de cloud souverain de taille intermédiaire, en Europe.",
 "who": [
  ("Responsables d'exploitation", "Vous voulez que la procédure approuvée soit celle qui est exécutée, sur tous les quarts, y compris quand le senior est absent."),
  ("Chefs d'équipe et de quart", "Vous briefez, vous supervisez, vous signez. Vous voulez un déroulé clair pour le technicien et une trace que vous n'avez pas à recopier."),
  ("Responsables conformité et audit interne", "Vous devez montrer comment une intervention s'est déroulée. Vous voulez des éléments de preuve datés et vérifiables, pas des souvenirs."),
 ],
 "pt_eyebrow": "Où nous en sommes",
 "pt_h": "Phase de démarrage : nous cherchons des partenaires de conception.",
 "pt_p": "Soyons clairs : OPSIGNE n'a pas de clients. Il existe une démo de preuve, sur des données fictives, qui montre les quatre idées ci-dessus. Avant d'aller plus loin, nous voulons comprendre comment vos procédures sont réellement écrites, exécutées et auditées.",
 "pt_have_h": "Ce que nous cherchons",
 "pt_have": ["Quelques conversations avec des personnes d'exploitation, de quart ou de conformité.", "Un à trois partenaires de conception, prêts à regarder un prototype et à dire ce qui ne tient pas.", "Des retours francs, y compris « ce n'est pas pour nous »."],
 "pt_not_h": "Ce que nous ne faisons pas",
 "pt_not": ["Pas de démarchage commercial : cette page n'affiche pas de prix et ne vend rien.", "Pas de promesse sur ce qu'un audit exigera de vous.", "Pas de données réelles dans la démo : tout y est fictif."],
 "pt_cta": "Parlons-en",
 "foot_disc": "Démo à données fictives. Ce n’est pas un système de sécurité.",
 "foot_p": "OPSIGNE - prototype (round 2). Contenu provisoire, sans valeur contractuelle.",
 "foot_links": [("#fonctionnement", "Fonctionnement"), ("#limites", "Limites de sécurité"), ("en/index.html", "English")],
 "ph_label": "Emplacement", "h1_aria": "",
},
"en": {
 "lang": "en", "css": "../css/site.css", "self": "index.html", "other": "../index.html", "other_lbl": "FR", "other_title": "Version française",
 "title": "OPSIGNE - Run approved procedures, and be able to show it",
 "desc": "OPSIGNE walks data-centre technicians through approved procedures step by step and records each critical step in a tamper-evident log.",
 "mail": "mailto:hello@opsigne.example?subject=OPSIGNE%20-%20Talk%20to%20us",
 "cta": "Talk to us", "skip": "Skip to content",
 "nav": [("#how", "How it works"), ("#demo", "Demo"), ("#safety", "Safety boundary"), ("#partners", "Design partners")],
 "hero_eyebrow": "Data-centre operating procedures",
 "h1": "An approved procedure is only worth what you can show: that it was followed, step by step.",
 "lead": "OPSIGNE walks technicians through your approved procedures (MOP, SOP, EOP) one step at a time, records each critical step in a log where any change can be detected, and answers only from your approved documents.",
 "hero_sec": "Try the demo",
 "pb_eyebrow": "The problem",
 "pb_h": "The procedure exists. What is missing is the record of what actually happened.",
 "pb_cards": [
  ("The procedure is written, the work varies", "The MOP sits in a binder or a PDF. Under the pressure of a maintenance window, steps get skipped, reordered or done from memory. You find out after the incident, rarely before."),
  ("Know-how leaves with the seniors", "The real order of actions, the reading that should worry you, the quirk of one particular rack: all of it lives in a few heads. When they change role or leave, only the document remains."),
  ("The audit is prepared in a scramble", "Rebuilding who did what, when, against which version of the document, from emails, photos and memory takes days, and the result is still open to argument."),
 ],
 "pb_note": "Deliberately no figures: we show no statistic unless we can name its source on the page.",
 "how_eyebrow": "How it works",
 "how_h": "Four ideas, demonstrated on a fictional procedure.",
 "how_sub": "Each block below exists today in a proof demo, on an invented procedure (replacing a UPS power module). It is not a product yet. You can try these ideas in the demo further down.",
 "how": [
  ("01", "Guided execution, with hold points", "The technician sees one step at a time. At hold points they must enter the measured value: out of tolerance, the contingency step defined by the procedure is shown. A second person can be required to verify. Every deviation is recorded with its reason.", "Fictional example: reading 70% against a 65% maximum - stop, go to the contingency step."),
  ("02", "A log where any change can be detected", "Each critical step becomes an event linked to the previous one by a SHA-256 hash. Editing a past event breaks the chain, and verification shows it. It is not an unbreakable vault: it is a log that makes tampering visible.", "Fictional example: a reading edited afterwards -> verification: chain broken at event 7."),
  ("03", "Answers only from your approved documents", "A question asked mid-task is answered with the text of the approved step, with its identifier, version and step number. If nothing in the approved documents answers it, OPSIGNE refuses rather than guessing.", "Fictional example: \"What is the tyre pressure of the trolley?\" -> \"Not covered by your approved procedures, escalate to shift lead.\""),
  ("04", "An exportable audit report", "For each run: who, when, which procedure version, which readings, which deviations, plus the head hash of the chain, to be kept elsewhere if you wish. JSON and HTML export. The report helps produce evidence; it replaces neither your auditor nor your judgement.", "Fictional example: RUN-0001, 13 steps, 1 deviation, head hash shown."),
 ],
 "demo_eyebrow": "Interactive demo",
 "demo_h": "Try a fictional job, nothing to install.",
 "safe_eyebrow": "Safety boundary",
 "safe_h": "OPSIGNE never controls equipment and never invents steps. The approved procedure is always the authority.",
 "safe": [
  ("No connection to equipment", "OPSIGNE sends no command and reads no controller. Values are entered by the person on site."),
  ("No invented steps", "Answers quote the approved text. No free generation, no rewording that could change the meaning."),
  ("When in doubt, the procedure wins", "If the tool and the approved document seem to disagree, follow the approved document and call the on-call lead."),
  ("Not a safety system", "OPSIGNE replaces neither the site's safety rules, nor interlocks, nor the judgement of authorised people."),
 ],
 "who_eyebrow": "Who it is for",
 "who_h": "For the teams that run the halls.",
 "who_sub": "Mid-size colocation and sovereign-cloud operators in Europe.",
 "who": [
  ("Operations managers", "You want the approved procedure to be the one that is executed, on every shift, including when the senior person is away."),
  ("Shift and team leads", "You brief, supervise and sign off. You want a clear sequence for the technician and a record you do not have to retype."),
  ("Compliance and internal audit managers", "You need to show how a job went. You want dated, verifiable pieces of evidence, not recollections."),
 ],
 "pt_eyebrow": "Where we are",
 "pt_h": "Early stage: we are looking for design partners.",
 "pt_p": "To be plain: OPSIGNE has no customers. There is a proof demo, on fictional data, that shows the four ideas above. Before going further we want to understand how your procedures are actually written, executed and audited.",
 "pt_have_h": "What we are looking for",
 "pt_have": ["A few conversations with people in operations, shift leadership or compliance.", "One to three design partners willing to look at a prototype and tell us what does not hold up.", "Frank feedback, including \"this is not for us\"."],
 "pt_not_h": "What we are not doing",
 "pt_not": ["No sales pitch: this page shows no price and sells nothing.", "No promise about what an audit will require from you.", "No real data in the demo: everything in it is fictional."],
 "pt_cta": "Talk to us",
 "foot_disc": "Demo with fictional data. Not a safety system.",
 "foot_p": "OPSIGNE - prototype (round 2). Provisional content, no contractual value.",
 "foot_links": [("#how", "How it works"), ("#safety", "Safety boundary"), ("../index.html", "Français")],
 "ph_label": "Placeholder",
}}
# FR anchors differ from EN anchors on purpose (ids follow the page language).
IDS = {"fr": dict(how="fonctionnement", safe="limites", pt="partenaires", demo="demo", pb="probleme", who="pour-qui"),
       "en": dict(how="how", safe="safety", pt="partners", demo="demo", pb="problem", who="who")}


# ---- static strings of the demo box and the hero visual (dynamic strings live in js/demo.js) ----
DEMO = {
"fr": {"disc_title": "Démo à données fictives. Ce n’est pas un système de sécurité.",
  "lead": "Tout se passe dans votre navigateur : aucun serveur, réseau ni cookie, rien n’est conservé. La procédure est inventée.",
  "noscript": "Cette démo a besoin de JavaScript. Le reste de la page fonctionne sans.",
  "proc": "Procédure fictive", "h_exec": "Exécution guidée", "op_lbl": "Nom de l’opérateur (fictif)", "op_hint": "Tapez un nom inventé, par exemple « A. Exemple ». Il reste dans cet onglet.",
  "start": "Démarrer l’exécution",
  "h_log": "Journal à preuve d’altération", "log_intro": "Chaque action ajoute un événement dont l’empreinte SHA-256 inclut la précédente.",
  "head": "Empreinte de tête", "count": "Événements", "log_label": "Journal des événements (zone défilante)",
  "verify": "Vérifier le journal", "tamper": "Simuler une altération", "tamper_hint": "Simulation : modifie un événement passé sans recalculer les empreintes.", "reset": "Réinitialiser",
  "h_ask": "Poser une question", "ask_intro": "Réponses citées (identifiant, version, étape). Posez votre question en français.", "ask_note": "Réponses limitées aux étapes approuvées ; en cas de doute, la demande est refusée.",
  "q_lbl": "Votre question", "q_btn": "Demander", "q_try": "Essayez :",
  "chips": ["Quel équipement de protection est requis ?", "Comment fait-on le repli ?", "Quelle est la pression des pneus du chariot ?", "Puis-je sauter le verrouillage pour gagner du temps ?"],
  "h_rep": "Rapport", "rep_intro": "HTML autonome ou JSON brut, avec l’empreinte de tête.",
  "rep_html": "Télécharger le rapport (HTML)", "rep_json": "Télécharger le rapport (JSON)", "sha_lbl": "Moteur de hachage"},
"en": {"disc_title": "Demo with fictional data. Not a safety system.",
  "lead": "Everything runs in your browser: no server, network or cookies, nothing is kept. The procedure is invented.",
  "noscript": "This demo needs JavaScript. The rest of the page works without it.",
  "proc": "Fictional procedure", "h_exec": "Guided execution", "op_lbl": "Operator name (fictional)", "op_hint": "Type an invented name, for example “A. Example”. It stays in this tab.",
  "start": "Start the run",
  "h_log": "Tamper-evident log", "log_intro": "Each action adds an event whose SHA-256 hash includes the previous one.",
  "head": "Head hash", "count": "Events", "log_label": "Event log (scrollable area)",
  "verify": "Verify the log", "tamper": "Simulate tampering", "tamper_hint": "Simulation: edits one past event without recomputing any hash.", "reset": "Reset",
  "h_ask": "Ask a question", "ask_intro": "Answers are cited (id, version, step). Ask in English.", "ask_note": "Answers are limited to the approved steps; when in doubt the question is refused.",
  "q_lbl": "Your question", "q_btn": "Ask", "q_try": "Try:",
  "chips": ["What protective equipment is required?", "How do I roll back?", "What is the tyre pressure of the trolley?", "Can I skip the lockout to save time?"],
  "h_rep": "Report", "rep_intro": "Self-contained HTML or raw JSON, with the head hash.",
  "rep_html": "Download report (HTML)", "rep_json": "Download report (JSON)", "sha_lbl": "Hashing engine"}}

HERO = {
"fr": {"label": "Illustration fictive : une étape avec point d’arrêt, un relevé de 70 % pour un maximum de 65 % qui déclenche l’arrêt, et trois événements chaînés dont le troisième est rompu.",
  "ctx": "MOP-UPS-017 v1.0 · étape 2 sur 12", "title": "Vérifier la marge de charge", "tag": "Point d’arrêt", "lbl": "Charge de sortie totale", "val": "70 %", "max": "max 65 %",
  "stop": "ARRÊT - hors plage", "stop2": "Repli : étape 13", "chain": "Journal", "ok": "lié", "bad": "rompu", "fict": "Données fictives"},
"en": {"label": "Fictional illustration: a step with a hold point, a reading of 70% against a 65% maximum that triggers a stop, and three chained events where the third link is broken.",
  "ctx": "MOP-UPS-017 v1.0 · step 2 of 12", "title": "Check load headroom", "tag": "Hold point", "lbl": "Total output load", "val": "70%", "max": "max 65%",
  "stop": "STOP - out of range", "stop2": "Rollback: step 13", "chain": "Log", "ok": "linked", "bad": "broken", "fict": "Fictional data"}}

def demo_html(l):
    d = DEMO[l]; doc = json.load(open(os.path.join(ROOT, "data", "mop-ups-017.json" if l == "en" else "mop-ups-017.fr.json"), encoding="utf-8"))
    chips = "".join(f'<button class="chip" type="button" data-q="{html.escape(q)}">{E(q)}</button>' for q in d["chips"])
    return f'''<div class="demo" id="demo-app">
<noscript><p class="demo-nojs">{E(d["noscript"])}</p></noscript>
<p class="demo-disc"><strong>{E(d["disc_title"])}</strong></p>
<p class="demo-lead">{E(d["lead"])}</p>
<p class="demo-proc"><span class="mono">{d["proc"]}</span> <strong>{E(doc["id"])} v{E(doc["version"])}</strong> - {E(doc["title"])}</p>
<div class="demo-grid">
<section class="pane pane-exec" aria-labelledby="d-exec">
<h3 id="d-exec"><span class="pn" aria-hidden="true">1</span>{E(d["h_exec"])}</h3>
<form id="start-form" class="stack" novalidate>
<label for="op-name">{E(d["op_lbl"])}</label>
<input id="op-name" name="op" type="text" maxlength="100" autocomplete="off" aria-describedby="op-hint start-msg">
<p class="hint" id="op-hint">{E(d["op_hint"])}</p>
<button class="btn" type="submit">{E(d["start"])}</button>
<p class="msg" id="start-msg" role="alert"></p>
</form>
<div id="run-area" hidden>
<div class="progress"><p class="prog-text" id="prog-text"></p><div class="prog" id="prog" aria-hidden="true"></div></div>
<div id="step-area"></div>
</div>
</section>
<section class="pane pane-log" aria-labelledby="d-log">
<h3 id="d-log"><span class="pn" aria-hidden="true">2</span>{E(d["h_log"])}</h3>
<p class="intro">{E(d["log_intro"])}</p>
<dl class="kv"><div><dt>{E(d["count"])}</dt><dd id="count">0</dd></div><div><dt>{E(d["head"])}</dt><dd><code id="head">-</code></dd></div><div><dt>{E(d["sha_lbl"])}</dt><dd id="engine">-</dd></div></dl>
<p class="hint log-hid" id="log-hid" hidden></p>
<div class="chain-box" id="chain-box" role="region" aria-label="{E(d["log_label"])}" tabindex="0"><p class="hint" id="chain-empty"></p><ol class="chain" id="chain"></ol></div>
<div class="log-foot"><p class="hint" id="shown"></p><button class="linkbtn" type="button" id="log-toggle" aria-expanded="false" aria-controls="chain" hidden></button></div>
<div class="actions"><button class="btn" type="button" id="btn-verify" disabled>{E(d["verify"])}</button><button class="btn warn" type="button" id="btn-tamper" disabled aria-describedby="tamper-hint">{E(d["tamper"])}</button><button class="btn ghost" type="button" id="btn-reset">{E(d["reset"])}</button></div>
<p class="hint" id="tamper-hint">{E(d["tamper_hint"])}</p>
<p class="msg sim-msg" id="tamper-out"></p>
<div class="verify v-none" id="verify-out" role="status" tabindex="-1"></div>
</section>
<section class="pane pane-ask" aria-labelledby="d-ask">
<h3 id="d-ask"><span class="pn" aria-hidden="true">3</span>{E(d["h_ask"])}</h3>
<p>{E(d["ask_intro"])}</p>
<form id="qa-form" class="stack" novalidate><label for="qa-in">{E(d["q_lbl"])}</label><div class="qrow"><input id="qa-in" type="text" maxlength="500" autocomplete="off" aria-describedby="ask-note"><button class="btn" type="submit">{E(d["q_btn"])}</button></div><p class="hint ask-note" id="ask-note">{E(d["ask_note"])}</p></form>
<div class="chips" role="group" aria-label="{E(d["q_try"])}"><span class="mono">{E(d["q_try"])}</span>{chips}</div>
<div id="qa-out" class="qa-out"></div>
</section>
<section class="pane pane-rep" aria-labelledby="d-rep">
<h3 id="d-rep"><span class="pn" aria-hidden="true">4</span>{E(d["h_rep"])}</h3>
<p class="intro">{E(d["rep_intro"])}</p>
<div class="actions"><button class="btn" type="button" id="rep-html" disabled>{E(d["rep_html"])}</button><button class="btn ghost" type="button" id="rep-json" disabled>{E(d["rep_json"])}</button></div>
<p class="hint" id="rep-note"></p>
</section>
</div>
<div class="sr-only" id="live" aria-live="polite" role="status"></div>
<p class="demo-disc demo-disc-foot">{E(d["disc_title"])}</p>
</div>'''

def hero_vis(l):
    """Hero 1 'Chain band'. One announcement for screen readers: the figure carries the text equivalent (aria-label), the drawing inside is aria-hidden."""
    v = HERO[l]
    return f'''<figure class="vis band" role="img" aria-label="{E(v["label"])}"><div aria-hidden="true">
<div class="band-top"><span class="vis-ctx">{E(v["ctx"])}</span><span class="vis-title"><span class="tag tag-hold">{E(v["tag"])}</span> {E(v["title"])}</span><span class="vis-fict">{E(v["fict"])}</span></div>
<p class="vis-ctx band-log">{E(v["chain"])}</p>
<div class="band-chain"><span class="blk">#1<code>a3f9&hellip;</code></span><span class="band-link"><span class="wire"></span><span class="lnk ok">{E(v["ok"])}</span><span class="wire"></span></span><span class="blk">#2<code>7c1e&hellip;</code></span><span class="band-link"><span class="wire bad"></span><span class="lnk bad">{E(v["bad"])}</span><span class="wire bad"></span></span><span class="blk bad">#3<code>51d0&hellip;</code></span></div>
<p class="band-stop"><strong>&#10006; {E(v["stop"])}</strong><span>{E(v["lbl"])} {E(v["val"])} &middot; {E(v["max"])} &rarr; {E(v["stop2"])}</span></p>
</div></figure>'''

JS_ORDER = ["sha256", "chain", "qa", "report", "engine", "mop-data", "demo"]
def bundle():
    parts = ["/* OPSIGNE bundle - GENERATED by _build_pages.py from js/*.js (order: %s). Edit the sources, not this file. */" % ", ".join(JS_ORDER)]
    for n in JS_ORDER:
        parts.append(open(os.path.join(ROOT, "js", n + ".js"), encoding="utf-8").read().rstrip("\n"))
    open(os.path.join(ROOT, "js", "bundle.js"), "w", encoding="utf-8").write("\n".join(parts) + "\n")

CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"

def page(l):
    c = COPY[l]; i = IDS[l]; up = "../" if l == "en" else ""
    cards = "".join(f'<article class="card" data-reveal><h3>{E(t)}</h3><p>{E(p)}</p></article>' for t, p in c["pb_cards"])
    how = "".join(
        f'<article class="card" data-reveal style="--i:{k}"><span class="num" aria-hidden="true">{n}</span><h3>{E(t)}</h3><p>{E(p)}</p><p class="sample">{E(s)}</p></article>'.replace(' style="--i:%d"' % k, "")
        for k, (n, t, p, s) in enumerate(c["how"]))
    safe = "".join(f'<li><strong>{E(t)}</strong><span>{E(p)}</span></li>' for t, p in c["safe"])
    who = "".join(f'<li data-reveal><h3>{E(t)}</h3><p>{E(p)}</p></li>' for t, p in c["who"])
    have = "".join(f"<li>{E(x)}</li>" for x in c["pt_have"]); nots = "".join(f"<li>{E(x)}</li>" for x in c["pt_not"])
    nav = "".join(f'<a class="sec" href="{h}">{E(t)}</a>' for h, t in c["nav"])
    fl = "".join(f'<a href="{h}">{E(t)}</a>' for h, t in c["foot_links"])
    other = "en" if l == "fr" else "fr"
    return f'''<!doctype html>
<html lang="{c["lang"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<title>{E(c["title"])}</title>
<meta name="description" content="{E(c["desc"])}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#F7F2E9">
<link rel="icon" href="{up}logo/favicon.svg" type="image/svg+xml">
<link rel="icon" href="{up}logo/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="{up}logo/png/apple-touch-icon-180.png">
<link rel="stylesheet" href="{c["css"]}">
<script src="{up}js/boot.js"></script>
</head>
<body>
<a class="skip" href="#main">{E(c["skip"])}</a>
<header class="top">
<div class="wrap">
<a class="brand" href="{c["self"]}" aria-label="OPSIGNE"><img src="{up}logo/lockup-light.svg" width="144" height="32" alt="OPSIGNE"></a>
<nav class="nav" aria-label="{'Navigation principale' if l == 'fr' else 'Main navigation'}">{nav}<a class="lang" href="{c["other"]}" hreflang="{other}" lang="{other}" title="{E(c["other_title"])}">{c["other_lbl"]}</a><a class="btn" href="{c["mail"]}">{E(c["cta"])}</a></nav>
</div>
</header>
<main id="main">

<section class="hero" aria-labelledby="h-hero">
<div class="wrap">
<p class="eyebrow">{E(c["hero_eyebrow"])}</p>
<h1 id="h-hero">{E(c["h1"])}</h1>
<p class="lead">{E(c["lead"])}</p>
<div class="row"><a class="btn" href="{c["mail"]}">{E(c["cta"])}</a><a class="btn ghost" href="#{i["demo"]}">{E(c["hero_sec"])}</a></div>
{hero_vis(l)}
</div>
</section>

<section class="alt" id="{i["pb"]}" aria-labelledby="h-pb">
<div class="wrap">
<div class="sec-head"><p class="eyebrow">{E(c["pb_eyebrow"])}</p><h2 id="h-pb">{E(c["pb_h"])}</h2></div>
<div class="grid g3">{cards}</div>
<p class="note">{E(c["pb_note"])}</p>
</div>
</section>

<section id="{i["how"]}" aria-labelledby="h-how">
<div class="wrap">
<div class="sec-head"><p class="eyebrow">{E(c["how_eyebrow"])}</p><h2 id="h-how">{E(c["how_h"])}</h2><p>{E(c["how_sub"])}</p></div>
<div class="grid g2">{how}</div>
</div>
</section>

<section class="alt" id="{i["demo"]}" aria-labelledby="h-demo">
<div class="wrap">
<div class="sec-head"><p class="eyebrow">{E(c["demo_eyebrow"])}</p><h2 id="h-demo">{E(c["demo_h"])}</h2></div>
{demo_html(l)}
</div>
</section>

<section class="safety" id="{i["safe"]}" aria-labelledby="h-safe">
<div class="wrap">
<p class="eyebrow">{E(c["safe_eyebrow"])}</p>
<h2 id="h-safe">{E(c["safe_h"])}</h2>
<ul>{safe}</ul>
</div>
</section>

<section id="{i["who"]}" aria-labelledby="h-who">
<div class="wrap">
<div class="sec-head"><p class="eyebrow">{E(c["who_eyebrow"])}</p><h2 id="h-who">{E(c["who_h"])}</h2><p>{E(c["who_sub"])}</p></div>
<ul class="who">{who}</ul>
</div>
</section>

<section class="alt" id="{i["pt"]}" aria-labelledby="h-pt">
<div class="wrap">
<div class="sec-head"><p class="eyebrow">{E(c["pt_eyebrow"])}</p><h2 id="h-pt">{E(c["pt_h"])}</h2><p>{E(c["pt_p"])}</p></div>
<div class="lists">
<div class="card"><h3>{E(c["pt_have_h"])}</h3><ul>{have}</ul></div>
<div class="card"><h3>{E(c["pt_not_h"])}</h3><ul>{nots}</ul></div>
</div>
<div class="row"><a class="btn" href="{c["mail"]}">{E(c["pt_cta"])}</a></div>
</div>
</section>

</main>
<footer>
<div class="wrap">
<p class="disclaimer">{E(c["foot_disc"])}</p>
<p>{E(c["foot_p"])}</p>
<div class="links">{fl}</div>
</div>
</footer>
<script src="{up}js/bundle.js" defer></script>
</body>
</html>
'''

if __name__ == "__main__":
    bundle()
    for l, path in (("fr", "index.html"), ("en", "en/index.html")):
        os.makedirs(os.path.dirname(os.path.join(ROOT, path)), exist_ok=True)
        open(os.path.join(ROOT, path), "w", encoding="utf-8").write(page(l))
    print("pages + js/bundle.js written")
