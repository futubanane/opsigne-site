/* OPSIGNE - grounded Q&A over APPROVED steps only (browser port of opsigne/qa.py).
   Extractive TF-IDF retrieval. No generation, no network. Outcomes: answer | declined | refused.
   createQA(doc, {lang:'en'|'fr', improve:bool}).ask(question).
   - lang 'en' + improve:false is the faithful port of the Python logic (parity-tested against it, see test/parity.test.js).
   - improve:true adds a small, fixed, auditable set of query/step normalisations (see IMPROVE_EN) and nothing else:
     same thresholds, same refusal rules, same scope checks.
   - lang 'fr' is a French rule pack written for this site (NOT part of the Python parity test). */
(function (root) {
  'use strict';

  var REFUSAL = { en: 'Not covered by your approved procedures, escalate to shift lead.', fr: 'Non couvert par vos procédures approuvées, escaladez au chef de quart.' };
  var MAX_Q = 500, MIN_SCORE = 0.15, MIN_COVERAGE = 0.35;

  /* Python str.strip() whitespace set (differs slightly from JS trim) */
  var PYWS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  var PY_BLANK = new RegExp('^[' + PYWS + ']*$');

  function words(s) { return s.split(/\s+/).filter(Boolean); }
  function set(s) { var o = Object.create(null); words(s).forEach(function (w) { o[w] = true; }); return o; }
  function re(src, flags) { return new RegExp(src, flags); }

  /* ---------------- English rule pack (verbatim port of the constants in qa.py) ---------------- */
  var EN = {
    stop: set('a an the and or but if then of to in on at by for with from as is are was were be been being do does did doing i me my we you your it its this that these those there what which who whom how when where why can could should would may might must shall will need needs want get got have has had about into over than so not no yes please tell me us ok okay any some just also very more most such own same too only step steps procedure procedures mop'),
    alias: { lockout: 'lock', tagout: 'lock', loto: 'lock', locked: 'lock', locks: 'lock' },
    suffixes: ['ment', 'ing', 'ed', 'es', 's', 'ly'],
    injection: [
      /\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules?|prompt|procedures?|previous|prior|above)\b/is,
      /\b(system|hidden|developer)\s+(prompt|instructions?|mode|message)\b/is, /\bnew\s+instructions?\b/is, /\byou\s+are\s+now\b/is,
      /\bsystem\s*:/is, /<\/?\s*[a-z]+\s*>/is, /#{3,}/is, /\breveal\s+your\b/is, /\bpretend\b/is, /\bact\s+as\b/is, /\bjailbreak\b/is,
      /\bown\s+knowledge\b/is, /\bmaintenance\s+mode\b/is, /\bthe\s+procedure\s+now\s+says\b/is],
    shortcut: /\b(skip|skipping|bypass|bypassing|omit|waive|disable|override|shortcut|short-cut|ignore|ignoring|without|save\s+time|no\s+need|not\s+necessary|unnecessary|instead\s+of|alone|myself|my\s+own|someone\s+else|carry\s+on|go\s+ahead\s+anyway|quick\s+look)\b/i,
    permission: /\b(can|could|may|might|should|shall|am)\s+(i|we)\b|\bis\s+it\s+(ok|okay|fine|acceptable|allowed|permitted|safe|alright|necessary|optional)\b|\b(optional|really\s+need|required\s+right|isn'?t\s+required|not\s+required|allowed|permitted|acceptable\s+to|what\s+if\s+i)\b|\bdo\s+(i|we)\s+(really\s+)?(have\s+to|need\s+to|need)\b|\bright\s*\?\s*$|\bwould\s+it\s+be\s+ok/i,
    shortcutExtra: /\b(leave\s+out|forgo|forego|rather\s+than|by\s+hand|single\s+person|one\s+person|self[-\s]?verif\w*|early|rush\w*|hurry|not\s+(lock|wait|test|verify|wear)\w*|only\s+(tag|lock|wait)\w*|lower\s+(ppe|category|rating|class)|thinner|cheaper|proceed|continue|carry\s+on|regardless|anyway|tick\s+\w+\s+(step\s+)?as\s+done)\b/i,
    runtime: /\b(phone|telephone|email|e-mail|contact|yesterday|last\s+(change|time|week|night)|previous\s+(change|run|shift)|who\s+is\s+(the\s+)?(shift|on)\b)/i,
    authority: /\b(has|have|had)\s+(been\s+)?(authori[sz]ed|approved|waived|allowed|cleared)\b|\b(authori[sz]ed|approved|cleared|waived)\s+by\b|\b(supervisor|manager|shift\s+lead|boss)\s+(said|says|told|allows|allowed|approved|authori[sz]ed)\b|\b(has|have)\s+been\s+(updated|changed|revised)\b|\bupdated\s+to\b|\brepeat\s+after\s+me\b|\bunrestricted\b|\bprint\s+your\b|\btraining\s+data\b|\bnow\s+(says|reads)\b/i,
    equipment: set('generator genset switchgear switchboard msb chiller crah crac pdu battery batteries transformer fuel kv cooling sprinkler rack server ats sts bms dcim ventilation'),
    asset: /\b(UPS|PDU|CRAH|CRAC|GEN|ATS|STS|BMS|RPP|MDB|PAC|FCU|BATT?)[-\s]?([A-Z]?\d+[A-Z0-9]*)\b/gi,
    wh: /^\s*(what|which|how|who|when|where)\b(?!\s+if\s+i\b)/,
    stepRef: /\bstep\s+(\d{1,2})\b/,
    itemWords: { module: 1, slot: 1, breaker: 1, phase: 1, unit: 1 },
    pre: null
  };

  /* Normalisations used only when improve:true (EN). Applied identically to step text and to the question, after folding.
     Each one maps a spelling/synonym of a term that IS in the approved text onto the term the approved text uses. */
  var IMPROVE_EN = {
    pre: function (f) {
      return f.replace(/\bpadlocks?\b/g, 'lock').replace(/\bdanger\s+tags?\b/g, 'tag')
              .replace(/\b(?:take|taken|took|taking|takes)\s+((?:\w+\s+){0,3}?)(?:off|out)\b/g, 'remove $1')                            /* take off / take out = remove (step 10, step 7) */
              .replace(/\b(?:put|puts|place|placed|fit|attach|affix|hang)\b((?:\s+\w+){0,3}?)\s+(lock|tag)\b/g, 'apply$1 $2')      /* put / fit the lock = apply (step 5) */
              .replace(/\b(lock|tag)\s+(?:is\s+|are\s+|be\s+|been\s+)?(?:put\s+on|fitted|placed|attached|applied|hung)\b/g, 'apply $1')
              .replace(/\b(?:put|bring|brought|switch|turn|set)\b((?:\s+\w+){0,3}?)\s+(?:back\s+)?on-?line\b/g, 'bring$1 online')
              .replace(/\b(?:loosen|unscrew|slacken)\w*/g, 'release')
              .replace(/\broll[\s-]+back\b/g, 'rollback')
              .replace(/\b(dead|de-?energi[sz]ed|voltage[\s-]+free)\b/g, 'zero')
              .replace(/\b(personal\s+)?protective\s+(equipment|gear|clothing)\b/g, 'ppe');
    },
    /* a reading unit of "%" is indexed with the words people use for it */
    unitTerms: { '%': ['percent', 'percentage'] },
    /* "transfer the load" = "carry the load" (step 2 says the remaining modules must be able to carry it) */
    alias: { transfer: 'carry' },
    /* a question about the rollback goes to the step the procedure itself flags as rollback */
    rollbackRouting: true,
    /* Found while testing (also true of the Python original): a question about an attribute the procedure never states
       (price, password, warranty, colour...) about an object the procedure DOES mention used to get the nearest step as an answer.
       These words are refused unless the approved text itself uses them. Only ever adds refusals. */
    support: {
      /* Round 3: refuse by default. After retrieval, the QUESTION's key words must be supported by the answering step itself.
         key word = not a stop word, not a filler, not a procedure-wide object word (stem present in >= 40% of the steps),
         not a number, not part of a shortcut/permission phrase, not part of an intent phrase handled below.
         Supported = same stem, or shares a 5-letter stem prefix with a step word, or listed below as a synonym of a word the step states. */
      filler: set('something anything everything nothing thing things go goes going went gone happen happens happened happening wrong problem problems issue issues trouble goes fail fails failed failing failure required require requires requirement requirements needed necessary before after first next last start starts started begin begins finish finished done say says said saying read reads explain explains show shows shown describe describes description mean means meaning detail details give gives take takes taken make makes made use used uses using get gets got getting know tell told want wants looking look looks see seen find found right correct exactly actually really exact properly safely correctly if so then else both either each every one ones lot many much long apply applies applied touch touching supposed expect expected out up down off under above below between only slightly around via per place placed once while during until upon whenever contain contains content'),
      /* question stem -> stems that, if the step states one of them, support it */
      syn: {
        check: ['verify', 'inspect', 'confirm', 'test', 'read'], checks: ['verify', 'inspect', 'confirm', 'test', 'read'], checked: ['verify', 'inspect', 'confirm', 'test', 'read'], precaution: ['warning', 'hazard', 'ppe'], precautions: ['warning', 'hazard', 'ppe'],
        attach: ['apply'], hang: ['apply'], fix: ['apply'], affix: ['apply'],
        torque: ['nm'], value: ['__range', 'nm'], heavy: ['weigh'], weight: ['weigh'], wear: ['put', 'ppe'], people: ['person'], persons: ['person'],
        install: ['insert'], put: ['insert'], fit: ['insert'], fitted: ['insert'], new: ['replacement'], replace: ['insert', 'replacement'], swap: ['insert', 'replacement'],
        pull: ['remove'], extract: ['remove'], withdraw: ['remove'], detach: ['remove'], uninstall: ['remove'], lift: ['lift', 'trolley'],
        revert: ['rollback'], undo: ['rollback'], abort: ['rollback', 'stop'], cancel: ['rollback', 'stop'], examine: ['inspect'], looking: ['inspect'], damaged: ['damage'], broken: ['damage'], fault: ['damage'],
        lockout: ['lock'], lock: ['lock'], tag: ['tag'], gloves: ['glove'], hazard: ['hazard', 'danger', 'warning'], danger: ['hazard', 'warning'], risk: ['hazard', 'warning'],
        maximum: ['__range'], minimum: ['__range'], max: ['__range'], min: ['__range'], range: ['__range'], limit: ['__range', 'limit'], allowed: ['__range'], acceptable: ['__range'], expected: ['__range'],
        reading: ['__range', 'read'], measured: ['__range', 'read'], measure: ['__range', 'read'], threshold: ['__range', 'limit'], tolerance: ['__range'],
        percentage: ['percent'], percent: ['percent'], volts: ['voltage'], volt: ['voltage'], proves: ['prove'], proof: ['prove'], proven: ['prove'], seconds: ['second'], minutes: ['minute'],
        close: ['close'], closing: ['close'], closed: ['close'], energized: ['live'], energised: ['live'], panel: ['panel'], screen: ['display', 'panel'], display: ['display', 'panel'],
        stop: ['stop'], continue: ['proceed'], proceed: ['proceed'], approved: ['approv'], approval: ['approv'], authorised: ['approv'], authorized: ['approv']
      },
      /* intent phrases: the asked kind of fact must exist in the step text */
      intents: [
        { ask: /\bhow\s+long\b|\bhow\s+much\s+time\b|\bduration\b|\bhow\s+many\s+(seconds|minutes|hours)\b/g, has: /\b(seconds?|minutes?|hours?|days?)\b/ },
        { ask: /\bwho(m|se)?\b/g, has: /\b(person|people|lead|supervisor|operator|engineer|team|verifier|colleague)\b/ },
        /* why / what happens / purpose: a reason or consequence must be written in the step */
        { ask: /\bwhy\b|\bwhat\s+(happens|would\s+happen|will\s+happen)\b|\b(reason|purpose)\b|\bwhat\s+for\b/g, has: /\b(because|so\s+that|in\s+order|to\s+avoid|otherwise|since|due\s+to|reason|purpose)\b/ },
        /* "what is the part number / serial / version / model / code": an identifier VALUE must be written in the step (a code next to the term), mentioning that something must match is not enough */
        { ask: /\b(what|which)\s+(is|are|was)\s+(the\s+)?(\w+\s+)?(part\s+number|part\s+no|serial(\s+number)?|reference|model|firmware|version|code|id)\b/g, has: /\b(number|no|serial|reference|model|firmware|version|code|id)\s+(\w+\s+){0,2}[a-z]*\d/ },
        { ask: /\bhow\s+(many|much)\b/g, has: /\d|\b(one|two|three|four|five|six|both|each)\b/ }
      ]
    },
    unknownAttr: set('price prices cost costs password passwords passcode pin login username warranty guarantee colour color colours colors manufacturer manufacturers manufactured manufacture supplier vendor brand model serial supplier cheaper budget invoice salary')
  };

  /* ---------------- French rule pack (written for this site; patterns run on accent-folded lowercase for the word lists) ---------------- */
  var FR = {
    stop: set('le la les l un une des du de d et ou mais si alors a au aux en dans sur par pour avec que qui quoi quel quelle quels quelles ce cet cette ces est sont etre ete faut fait faire je j tu il elle on nous vous ils elles me m mon ma mes votre vos notre nos y ne n pas plus se s sa son ses ton ta tes te toi ca cela ceci c t qu jusqu lorsqu comment quand pourquoi combien dois doit doivent peut peux puis veux veut faut avoir ai as ont avons avez va vais aller svp merci dis dites etape etapes procedure procedures mop oui non tout tous toute toutes aussi tres plus moins seulement meme cas'),
    alias: { onduleur: 'ups', onduleurs: 'ups', poids: 'pes', lourd: 'pes', lourde: 'pes', pese: 'pes', verrouillage: 'verrou', verrouiller: 'verrou', verrouille: 'verrou', cadenas: 'verrou', cadenassage: 'verrou', consignation: 'verrou', consigner: 'verrou', loto: 'verrou', etiquetage: 'etiquet', etiquette: 'etiquet', tagout: 'verrou', lockout: 'verrou' },
    suffixes: ['ations', 'ation', 'ements', 'ement', 'ments', 'ment', 'ees', 'ee', 'es', 'er', 'ez', 's', 'x', 'e'],
    injection: [
      /\b(ignor\w*|oubli\w*|neglig\w*|contourn\w*|annul\w*)\b.{0,40}\b(instructions?|consignes?|regles?|prompt|procedures?|precedent\w*|ci-dessus)\b/is,
      /\b(prompt|instructions?|mode|message)\s+(systeme|cache|developpeur)\b/is, /\b(systeme|cache|developpeur)\s+(prompt|instructions?|mode|message)\b/is,
      /\bnouvelles?\s+(instructions?|consignes?)\b/is, /\btu\s+es\s+(maintenant|desormais)\b/is, /\bvous\s+etes\s+(maintenant|desormais)\b/is,
      /\bsysteme\s*:/is, /\bsystem\s*:/is, /<\/?\s*[a-z]+\s*>/is, /#{3,}/is, /\brevele\w*\b/is, /\bfais\s+semblant\b/is, /\bfaites\s+semblant\b/is,
      /\bjoue\w*\s+(le\s+)?role\b/is, /\bjailbreak\b/is, /\bpropres?\s+connaissances?\b/is, /\bmode\s+maintenance\b/is,
      /\ba\s+partir\s+de\s+maintenant\b/is, /\bla\s+procedure\s+(dit|indique|precise)\s+maintenant\b/is, /\bignore\b.{0,40}\b(instructions?|rules?|prompt)\b/is],
    shortcut: /\b(sauter|saute|sautons|sautant|ignorer|ignore|ignorant|contourner|contourne|contournant|omettre|omets|dispenser|dispense|desactiver|desactive|raccourci|sans|gagner\s+du\s+temps|pas\s+besoin|inutile|pas\s+necessaire|au\s+lieu\s+de|seul|seule|moi-meme|moi\s+meme|quelqu\s+un\s+d\s+autre|continuer\s+quand\s+meme|passer\s+outre|tant\s+pis|rapidement|vite)\b/,
    permission: /\b(puis-je|puis\s+je|peut-on|peut\s+on|pouvons-nous|pourrait-on|pourrais-je|je\s+peux|on\s+peut|ai-je\s+le\s+droit|a-t-on\s+le\s+droit|est-ce\s+que\s+je\s+peux|est-ce\s+que\s+je\s+dois|est-il\s+(ok|possible|permis|acceptable|autorise|necessaire|obligatoire|facultatif)|est-ce\s+(ok|autorise|permis|obligatoire|necessaire|facultatif)|facultatif|optionnel|vraiment\s+(besoin|obligatoire|necessaire)|doit-on|dois-je\s+vraiment|et\s+si\s+je|autorise|permis)\b|\bnon\s*\?\s*$/,
    shortcutExtra: /\b(laisser\s+de\s+cote|(se|me|te|nous|vous)\s+passer|plutot\s+que|a\s+la\s+main|une\s+seule\s+personne|une\s+personne\s+seule|auto-?verif\w*|tot|presse|hate|pas\s+(de\s+)?(verrou\w*|cadenas\w*|attendre|tester|verifier|porter)|seulement\s+(l\s+etiquette|le\s+cadenas|attendre)|inferieur\w*|moins\s+cher|plus\s+fin|poursuivre|continuer|quand\s+meme|malgre|cocher\s+\w+\s+comme\s+fait)\b/,
    runtime: /\b(telephone|portable|mail|courriel|e-mail|contact|hier|derniere?\s+(fois|changement|semaine|nuit|intervention)|changement\s+precedent|equipe\s+precedente|qui\s+est\s+(le\s+|la\s+)?(chef|astreinte|de\s+garde)|numero\s+de)\b/,
    authority: /\b(a|ont|avait)\s+(ete\s+)?(autorise\w*|approuve\w*|valide\w*|dispense\w*)\b|\b(autorise\w*|approuve\w*|valide\w*|dispense\w*)\s+par\b|\b(superviseur|manager|responsable|chef\s+de\s+quart|chef|patron)\s+(a\s+dit|dit|m\s+a\s+dit|permet|autorise|a\s+autorise|a\s+approuve)\b|\ba\s+ete\s+(mise?\s+a\s+jour|modifiee?|revisee?|changee?)\b|\bmise?\s+a\s+jour\s+(pour|en)\b|\brepete\s+apres\s+moi\b|\bsans\s+restriction\b|\bdonnees\s+d\s+entrainement\b|\bdit\s+maintenant\b|\bimprime\s+ton\b/,
    equipment: set('generator genset switchgear switchboard msb chiller crah crac pdu battery batteries transformer fuel kv cooling sprinkler rack server ats sts bms dcim ventilation generateur groupe electrogene tableau climatisation clim batterie transformateur carburant refroidissement extinction baie serveur'),
    asset: /\b(UPS|PDU|CRAH|CRAC|GEN|ATS|STS|BMS|RPP|MDB|PAC|FCU|BATT?)[-\s]?([A-Z]?\d+[A-Z0-9]*)\b/gi,
    wh: /^\s*(que|qu|quel|quelle|quels|quelles|qui|quand|ou|comment|combien|pourquoi|quoi|lequel|laquelle)\b(?!\s+(si|et\s+si)\s+(je|j)\b)/,
    stepRef: /\b(?:etape|step)\s+(\d{1,2})\b/,
    itemWords: { module: 1, emplacement: 1, slot: 1, disjoncteur: 1, phase: 1, unite: 1 },
    unknownAttr: set('prix cout couts tarif tarifs motdepasse identifiant garantie couleur fabricant fabricants fournisseur fournisseurs marque modele budget facture salaire'),
    pre: function (f) { return f.replace(/\bmots?\s+de\s+passe\b/g, 'motdepasse').replace(/\bequipements?\s+de\s+protection(\s+individuelle)?\b/g, 'epi').replace(/\bretour\s+arriere\b/g, 'repli').replace(/\b(revenir|retourner|reculer|faire\s+marche)\s+(en\s+)?arriere\b/g, 'repli').replace(/\bannul(er|ation)\b/g, 'repli').replace(/\b(hors\s+tension|sans\s+tension|mort)\b/g, 'zero')
      /* F5: ordinary French phrasings of terms the approved text states otherwise */
      .replace(/\b(plus\s+de|absence\s+de|aucun|hors)\s+courant\b/g, 'zero')                                   // "plus de courant" = absence de tension (step 6)
      .replace(/\b(mett\w+|pass\w+|plac\w+)((?:\s+\w+){0,3}?)\s+hors\s+service\b/g, 'isoler$2')                  // "mettre le module 3 hors service" = isoler (step 4)
      .replace(/\b(revenu|revenue|revient|reviens|revenir)\s+en\s+ligne\b/g, 'en ligne')                         // "revenu en ligne" = EN LIGNE (step 11); "revenir en arriere" is handled above
      .replace(/\b(depasse\w*|superieur\w*|excede\w*)\s+(la\s+|le\s+|l\s+)?(limite|maximum|seuil|plage)\b/g, 'repli')   // a reading above the limit = the procedure's own fallback (rollback step)
      .replace(/\b(gants?|epi|ecran\s+facial)\b([^?.]{0,40}?)\b(mettre|mettez|mets|met|porter|portez|enfilez)\b/g, '$1$2enfiler')   // "quels gants dois-je mettre" = enfiler (step 3)
      .replace(/\b(mettre|mettez|mets|porter|portez|enfilez)\b([^?.]{0,40}?)\b(gants?|epi|ecran\s+facial)\b/g, 'enfiler$2$3')
      /* QA1: the two opposite verbs for the padlock/tag/module are written one way (retirer / poser); ordinary synonyms are mapped onto them */
      .replace(/\b(retir\w*|enlev\w*|ot(e|es|er|ez|ons|ent|ee|ees)|depos\w*|deverrouill\w*)\b/g, 'retirer')                       // enlever / oter / deposer = retirer (step 10, step 7)
      .replace(/\b(mett\w+|mets|met|remett\w*|remets|appos\w*|accroch\w*|plac(e|es|er|ez|ons|ent))\b(?=[^?.]{0,40}\b(cadenas|etiquet\w*|verrou\w*)\b)/g, 'poser')   // mettre / apposer le cadenas = poser (step 5)
      .replace(/\bpos(ons|ent|ee|ees)\b/g, 'poser').replace(/\b(n\s+y\s+a\s+plus|plus)\s+de\s+tension\b/g, 'zero tension').replace(/\betiquet\w*\s+(de\s+)?danger\b/g, 'etiquette')
      .replace(/\b(re)?(mett\w+|mets|met|remis\w*|pass\w*|bascul\w*|ramen\w*)\b([^?.]{0,25}?)\b(en\s+ligne|en\s+service)\b/g, '$3 en ligne')   // remettre le module en ligne = en ligne (step 11)
      .replace(/\ben\s+service\b/g, 'en ligne'); },
    support: {
      filler: set('moment laisser laisse laissez approximatif approximative approximativement demarrer demarre demarr situer trop elevee elevees eleve eleves haute hautes sait sais place places quelque chose choses tout rien passe passer arrive arrive arriver mal probleme problemes souci soucis ennui echec echoue echouer requis requise requises necessaire necessaires avant apres premier premiere dernier prochain suivant commencer commence debut debuter finir termine fin dire dit dites lire lis lit expliquer explique montrer montre decrire decris signifie signifier detail details donner donne prendre prend faire fais fait utiliser utilise utilisee savoir trouver trouve voir vois regarder regarde bien correctement exactement vraiment entier entiere complet complete si sinon chaque deux beaucoup longtemps soit toucher intervention travail operation tache pendant durant jusqu pouvoir contient contenu contenir hors seulement lorsque lors quand peuvent regardes regardez rappelle rappelles rappelez rappeler entre'),
      syn: {
        depasser: ['__range'], depasse: ['__range'], depass: ['__range'], revient: ['revenir'], reviens: ['revenir'], observer: ['inspect'], observ: ['inspect'], monter: ['inser'], mont: ['inser'],
        appareil: ['testeur', 'afficheur'], document: ['demand', 'chang'], docu: ['demand', 'chang'],
        protection: ['epi', 'gant', 'ecran'], manipuler: ['soulev', 'gliss', 'retir'], manipulation: ['soulev', 'gliss', 'retir'],
        deplacer: ['gliss', 'chariot'], deplac: ['gliss', 'chariot'], essayer: ['test'], essay: ['test'], tolere: ['__range'], toler: ['__range'], tolerable: ['__range'],
        tiennent: ['maintien'], tient: ['maintien'], tenir: ['maintien'], ouvrant: ['ouvrir'], fixer: ['serr', 'inser'], fix: ['serr', 'inser'], fixe: ['serr', 'inser'],
        risques: ['dang', 'danger', 'attention'], risqu: ['dang', 'danger', 'attention'],
        controler: ['verifi', 'inspect', 'confirm', 'test', 'lire'], controle: ['verifi', 'inspect', 'confirm', 'test', 'lire'], verification: ['verifi'], precaution: ['danger', 'attention', 'epi'], precautions: ['danger', 'attention', 'epi'], equipement: ['epi', 'equipement'], arc: ['arc'],
        couple: ['nm'], transferer: ['port'], transfer: ['port'], transfert: ['port'], maximal: ['__range'], maximale: ['__range'], minimal: ['__range'], minimale: ['__range'], serrage: ['serr'], serrer: ['serr'], visser: ['serr'], lourd: ['pes'], pese: ['pes'], poids: ['pes'], porter: ['equipement', 'epi'], mettre: ['enfil', 'epi', 'inser'], mettr: ['enfil', 'epi', 'inser'],
        avertit: ['prevenir'], avertir: ['prevenir'], avertissez: ['prevenir'], avertis: ['prevenir'], informer: ['prevenir'], informe: ['prevenir'], informez: ['prevenir'], alerter: ['prevenir'], alertez: ['prevenir'], notifier: ['prevenir'], notifiez: ['prevenir'], prevenez: ['prevenir'], preven: ['prevenir'], previens: ['prevenir'], prevenu: ['prevenir'], prevenue: ['prevenir'],
        encaisser: ['port'], encaiss: ['port'], supporter: ['port'], absorber: ['port'], autres: ['restant'], autre: ['restant'], type: ['isolant', 'adapt'], typ: ['isolant', 'adapt'],
        verifi: ['verifi', 'test', 'prouv', 'inspect', 'confirm'], verifier: ['verifi', 'test', 'prouv', 'inspect', 'confirm'], sort: ['retir', 'gliss'], sorti: ['sorti'],
        compar: ['compar', 'correspond'], comparer: ['compar', 'correspond'], compare: ['compar', 'correspond'], comparez: ['compar', 'correspond'],
        patienter: ['attend'], patient: ['attend'], patiente: ['attend'], patientez: ['attend'],
        installer: ['inser'], install: ['inser'], installe: ['inser'], ancien: ['retir'], ancienne: ['retir'], poser: ['inser', 'repos'], remplacer: ['inser', 'remplacement'], remplac: ['inser', 'remplacement'], nouveau: ['remplac', 'remplacement'], neuf: ['remplac', 'remplacement'], echanger: ['inser', 'remplacement'],
        retirer: ['retir'], enlever: ['retir'], extraire: ['retir'], demonter: ['retir', 'desserr'], sortir: ['retir'], soulever: ['soulev', 'chariot'], inspecter: ['inspect'], examiner: ['inspect'], endommage: ['dommage'], casse: ['dommage'], abime: ['dommage'],
        maximum: ['__range'], minimum: ['__range'], max: ['__range'], min: ['__range'], plage: ['__range'], limite: ['__range', 'limit'], admis: ['__range'], acceptable: ['__range'], attendu: ['__range'],
        valeur: ['__range', 'nm'], releve: ['__range', 'lire'], mesure: ['__range', 'lire'], mesurer: ['__range', 'lire'], seuil: ['__range', 'limit'], tolerance: ['__range'], pourcentage: ['%', 'charge'], pourcent: ['charge'],
        prouver: ['prouv'], preuve: ['prouv'], volts: ['tension'], volt: ['tension'], secondes: ['seconde'], minutes: ['minute'], danger: ['danger', 'attention'], risque: ['danger', 'attention'], dangereux: ['danger', 'attention'],
        fermer: ['ferm'], ferme: ['ferm'], ouvrir: ['ouvr'], arreter: ['arret'], arret: ['arret'], continuer: ['poursuiv'], poursuivre: ['poursuiv'], approuve: ['approuv'], approbation: ['approuv'], valide: ['approuv', 'valid'], ecran: ['afficheur', 'panneau'], afficheur: ['afficheur', 'panneau'], gants: ['gant'], etiquette: ['etiquet']
      },
      intents: [
        { ask: /\bcombien\s+de\s+(temps|secondes?|minutes?|heures?)\b|\bduree\b|\bpendant\s+combien\b/g, has: /\b(secondes?|minutes?|heures?|jours?)\b/ },
        { ask: /\bqui\b|\bquelqu\s+un\b/g, has: /\b(personnes?|chef|superviseur|operateur|equipe|verificateur|collegue)\b/ },
        { ask: /\bpourquoi\b|\bque\s+se\s+passe\b|\bqu\s+arrive\s+t\s*il\b|\braison\b|\ba\s+quoi\s+sert\b|\bsert\s+a\s+quoi\b/g, has: /\b(car|parce|afin|pour\s+eviter|sinon|raison)\b/ },
        { ask: /\b(quel|quelle|quels|quelles)\s+(est|sont)\s+(la|le|l|les)\s+(\w+\s+)?(reference|numero|serie|modele|version|code|identifiant|firmware)\b/g, has: /\b(reference|numero|serie|modele|version|code|identifiant|firmware)\s+(\w+\s+){0,2}\w*\d/ },
        { ask: /\bcombien\b/g, has: /\d|\b(un|une|deux|trois|quatre|cinq|six|tous|chacun)\b/ }
      ]
    },
    unitTerms: null,
    rollbackTerm: 'repli'
  };

  function fold(s) {
    s = s.normalize('NFKC').replace(/[\p{Cf}\p{Cc}]/gu, '');
    return s.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase();
  }
  function cpLen(s) { var n = 0; for (var c of s) { n++; } return n; }  // code points, like Python len()
  function assetKey(s) { return s.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function vkey(v) { return v.split(/[.\-]/).map(function (x) { return /^\d+$/.test(x) ? parseInt(x, 10) : x; }); }


  /* QA1: opposite-action pairs (put on / take off, open / close, isolate / online, tighten / loosen, insert / remove).
     A question that uses one verb of a pair must never be answered with a step that only does the OPPOSITE action on the same object.
     q* = patterns on the folded question (any conjugation), s* = patterns on the folded step title+text (infinitive/imperative only, negated verbs and the WARNING text ignored).
     obj/nobj = the pair only applies when the question names (obj) / does not name (nobj) these objects. Pure filter: it can only remove candidate steps, never add one. */
  var POL_FR = [
    { promote: 1, obj: /\b(cadenas|etiquet\w*|verrou\w*|consign\w*|loto)\b/, A: /\b(pos(e|es|er|ez|ons|ent|ee|ees)|repos\w*|appos\w*|mett\w+|mets|met|remett\w*|remets|appliqu\w*|install\w*|accroch\w*|plac(e|es|er|ez|ons|ent)|verrouill\w*|cadenass\w*|consign\w*)\b/, B: /\b(retir\w*|enlev\w*|ot(e|es|er|ez|ons|ent|ee|ees)|depos\w*|deverrouill\w*|decadenass\w*|deconsign\w*|lev(e|er|ez|ons))\b/,
      sA: /\b(poser|reposer|apposer|mettre|remettre|appliquer|installer|accrocher|verrouiller)\b/, sB: /\b(retirer|enlever|oter|deposer|deverrouiller)\b/ },
    { obj: /\b(disjoncteurs?|q\d)\b/, A: /\b(ouvr\w*|ouvert\w*)\b/, B: /\b(ferm\w*|clos\w*|clor\w*)\b/, sA: /\bouvrir\b/, sB: /\bfermer\b/ },
    { A: /\b(isol(e|es|er|ez|ons|ent|ee|ees|ation)|hors\s+service|deconnect\w*)\b/, B: /\b(en\s+ligne|online|en\s+service|reconnect\w*|reintegr\w*)\b/, sA: /\bisoler\b/, sB: /\ben\s+ligne\b/ },
    { A: /\b(serr\w*|resserr\w*|viss\w*)\b/, B: /\b(desserr\w*|devis\w*|relach\w*)\b/, sA: /\b(serrer|resserrer|visser)\b/, sB: /\b(desserrer|devisser)\b/ },
    { promote: 1, obj: /\b(modules?|ancien\w*|unites?|chassis)\b/, nobj: /\b(cadenas|etiquet\w*|verrou\w*|consign\w*|gants?|epi|ecran|disjoncteurs?|q\d)\b/, A: /\b(install\w*|reinstall\w*|inser\w*|mont(e|es|er|ez|ons|ent|age))\b/, B: /\b(retir\w*|enlev\w*|ot(e|es|er|ez|ons|ent)|extrai\w*|extract\w*|sort(ir|e|es|ez|ons|ent)|demont\w*|depos\w*)\b/,
      sA: /\b(installer|reinstaller|inserer|monter)\b|\bglisser\b[^.]{0,60}\bemplacement\b/, sB: /\b(retirer|enlever|extraire|sortir|demonter)\b(?![^.]{0,30}(cadenas|etiquet|verrou))|\bglisser\b[^.]{0,40}\bchariot\b/ },
    { obj: /\b(gants?|epi|ecran|casque|tenue|equipements?)\b/, A: /\b(enfil\w*|mett\w+|mets|met|porter|portez|portons|revet\w*|equip\w*)\b/, B: /\b(enlev\w*|retir\w*|ot(e|es|er|ez|ons)|quitt\w*|depos\w*)\b/, sA: /\benfiler\b/, sB: /\b(enlever|retirer|oter|quitter)\b/ }
  ];
  var POL_EN = [
    { promote: 1, obj: /\b(locks?|padlocks?|tags?|lockout|tagout|loto)\b/, A: /\b(put|puts|putting|apply|applies|applied|applying|fit|fits|fitted|fitting|attach\w*|affix\w*|hang\w*|place\w*|placing|install\w*|re-?appl\w*|re-?fit\w*)\b/, B: /\b(remov\w*|unlock\w*|detach\w*|pull\w*|releas\w*|lift\w*)\b/,
      sA: /\b(apply|re-?apply|put|fit|attach|install|place)\b/, sB: /\b(remove|release|detach|unlock)\b/ },
    { obj: /\b(breakers?|q\d)\b/, A: /\bopen\w*/, B: /\b(clos\w*|shut\w*)\b/, sA: /\bopen\b/, sB: /\bclose\b/ },
    { A: /\b(isolat\w*|disconnect\w*|offline|out\s+of\s+service)\b/, B: /\b(online|on-?line|in\s+service|reconnect\w*|re-?integrat\w*)\b/, sA: /\bisolate\b/, sB: /\bonline\b/ },
    { A: /\b(tighten\w*|fasten\w*)\b/, B: /\b(loosen\w*|releas\w*|unscrew\w*|slacken\w*)\b/, sA: /\btighten\b/, sB: /\b(release|loosen)\b/ },
    { promote: 1, obj: /\b(modules?|old|units?)\b/, nobj: /\b(locks?|padlocks?|tags?|lockout|ppe|gloves?|shield|breakers?|q\d)\b/, A: /\b(install\w*|insert\w*|fit|fits|fitted|fitting|mount\w*|reinstall\w*)\b/, B: /\b(remov\w*|extract\w*|withdraw\w*|pull\w*|detach\w*|uninstall\w*)\b/,
      sA: /\b(insert|install|re-?install)\b|\bslide\b[^.]{0,40}\bslot\b/, sB: /\bremove\b(?![^.]{0,30}\b(lock|tag)\b)|\bslide\b[^.]{0,40}\btrolley\b|\bextract\b|\bwithdraw\b/ },
    { obj: /\b(ppe|gloves?|shield|helmet|gear|equipment|clothing)\b/, A: /\b(put\s+(\w+\s+){0,3}?on|wear\w*|don|donning)\b/, B: /\b(remov\w*|doff\w*|stop\s+wearing)\b/, sA: /\b(put\s+on|wear)\b/, sB: /\b(take\s+off|remove|doff)\b/ }
  ];
  var POL_NEG = { fr: /\bne\s+(jamais|pas|plus)\s+\w+(\s+(ni|ou)\s+\w+)?/g, en: /\b(never|do\s+not|don\s*t|must\s+not|not)\s+\w+(\s+(or|nor)\s+\w+)?/g };

  function createQA(doc, opts) {
    opts = opts || {};
    var lang = opts.lang === 'fr' ? 'fr' : 'en';
    var P = lang === 'fr' ? FR : EN;
    var improve = !!opts.improve;                     // EN: normalisations + support check; FR: support check (the FR pack always normalises)
    var pre = lang === 'fr' ? P.pre : (improve ? IMPROVE_EN.pre : null);
    var SUP = improve ? (lang === 'fr' ? FR.support : IMPROVE_EN.support) : null;
    var unitTerms = lang === 'fr' ? null : (improve ? IMPROVE_EN.unitTerms : null);
    var REFUSE = REFUSAL[lang];

    var alias = P.alias;
    if (improve && lang === 'en') { alias = {}; Object.keys(P.alias).forEach(function (k) { alias[k] = P.alias[k]; }); Object.keys(IMPROVE_EN.alias).forEach(function (k) { alias[k] = IMPROVE_EN.alias[k]; }); }
    function stem(w) {
      if (Object.prototype.hasOwnProperty.call(alias, w)) return alias[w];
      for (var i = 0; i < P.suffixes.length; i++) {
        var suf = P.suffixes[i];
        if (w.length - suf.length >= 3 && w.slice(-suf.length) === suf) return w.slice(0, -suf.length);
      }
      return w;
    }
    function fold2(text) { return fold(lang === 'fr' ? text.replace(/[\u2019\u2018'`\u00b4]/g, ' ') : text); }
    function norm(text) { var f = fold2(text); return pre ? pre(f) : f; }
    function tokens(f) { return f.match(/[a-z0-9]+/g) || []; }
    function terms(text) { return tokens(norm(text)).filter(function (w) { return !P.stop[w]; }).map(stem); }
    function counter(list) { var m = new Map(); list.forEach(function (t) { m.set(t, (m.get(t) || 0) + 1); }); return m; }

    /* index over approved steps */
    var raw = new Set(), bigrams = new Set(), chunks = [];
    doc.steps.forEach(function (s) {
      var parts = [s.title, s.text, s.warning || ''];
      var extra = [];
      if (s.reading) { parts.push(s.reading.label, s.reading.unit); if (unitTerms && unitTerms[s.reading.unit]) extra = unitTerms[s.reading.unit]; }
      var joined = parts.join(' ');
      var toks = tokens(norm(joined));
      toks.forEach(function (t) { raw.add(t); });
      for (var i = 0; i + 1 < toks.length; i++) bigrams.add(toks[i] + '\u0000' + toks[i + 1]);
      var ch = { doc: doc, step: s, terms: counter(terms(joined + (extra.length ? ' ' + extra.join(' ') : ''))), plain: ' ' + tokens(norm(joined)).join(' ') + ' ' };
      chunks.push(ch);
    });
    var knownAssets = new Set(doc.assets.map(assetKey));

    function score(qTerms) {
      var n = chunks.length, df = new Map();
      chunks.forEach(function (c) { c.terms.forEach(function (_, t) { df.set(t, (df.get(t) || 0) + 1); }); });
      var idf = function (t) { return Math.log((n + 1) / ((df.get(t) || 0) + 1)) + 1.0; };
      var idfMax = Math.log(n + 1) + 1.0;
      var qtf = counter(qTerms), qvec = new Map(), qn = 0;
      qtf.forEach(function (c, t) { qvec.set(t, (1 + Math.log(c)) * (df.has(t) ? idf(t) : idfMax)); });
      qvec.forEach(function (v) { qn += v * v; });
      var qnorm = Math.sqrt(qn) || 1.0, covDen = 0;
      qvec.forEach(function (v) { covDen += v; });
      var res = chunks.map(function (c) {
        var cvec = new Map(), cn = 0;
        c.terms.forEach(function (tf, t) { cvec.set(t, (1 + Math.log(tf)) * idf(t)); });
        cvec.forEach(function (v) { cn += v * v; });
        var cnorm = Math.sqrt(cn) || 1.0, dot = 0, covNum = 0;
        qvec.forEach(function (v, t) { if (cvec.has(t)) { dot += v * cvec.get(t); covNum += v; } });
        return [dot / (qnorm * cnorm), covDen ? covNum / covDen : 0.0, c];
      });
      res.sort(function (a, b) { return (b[0] - a[0]) || (a[2].step.n - b[2].step.n); });
      return res;
    }

    /* ---- Round 3: question-intent support check (only when improve:true) ---- */
    var nSteps = chunks.length, dfStem = new Map();
    chunks.forEach(function (c) { c.terms.forEach(function (_, t) { dfStem.set(t, (dfStem.get(t) || 0) + 1); }); });
    function isObjectWord(t) { return (dfStem.get(t) || 0) >= 0.4 * nSteps; }          // procedure-wide object word (module, ups, b2...)
    function related(a, b) {                                                           // same word family: 5-letter common prefix, or short prefix of a longer word
      if (a === b) return true;
      var lo = a.length <= b.length ? a : b, hi = lo === a ? b : a;
      if (lo.length >= 4 && hi.indexOf(lo) === 0 && hi.length - lo.length <= 4) return true;
      var k = 0; while (k < lo.length && lo[k] === hi[k]) k++;
      return k >= 5 && lo.length >= 5;
    }
    function keyWords(question) {
      var f = fold2(question);
      if (pre) f = pre(f);
      var intents = [];
      SUP.intents.forEach(function (it) { var r = new RegExp(it.ask.source, 'g'); if (r.test(f)) { intents.push(it.has); f = f.replace(new RegExp(it.ask.source, 'g'), ' '); } });
      f = f.replace(new RegExp(P.stepRef.source, 'g'), ' ');
      f = f.replace(new RegExp(P.asset.source, 'gi'), ' ');
      var keys = [];
      tokens(f).forEach(function (w) {
        if (P.stop[w] || SUP.filler[w] || /^\d+$/.test(w) || w.length < 2) return;
        var st = stem(w);
        if (P.stop[st] || SUP.filler[st] || isObjectWord(st) || isObjectWord(w)) return;
        if (keys.indexOf(w) < 0) keys.push(w);
      });
      return { keys: keys, intents: intents };
    }
    function supports(c, kw) {                                                        // does this ONE step state everything the question asks about?
      for (var i = 0; i < kw.intents.length; i++) if (!kw.intents[i].test(c.plain)) return false;
      var have = Array.from(c.terms.keys());
      if (c.step.reading) have.push('__range');           // the step states an allowed range (min..max): "maximum/limit/range/value" questions are supported by it
      return kw.keys.every(function (w) {
        var st = stem(w), cands = [st, w].concat(SUP.syn[w] || [], SUP.syn[st] || []);
        return cands.some(function (x) { return have.some(function (h) { return related(x, h); }); });
      });
    }


    /* QA1: polarity (see POL_* above) */
    var POL = (lang === 'fr' || improve) ? (lang === 'fr' ? POL_FR : POL_EN) : null;
    function polOf(c) {
      if (c.pol) return c.pol;
      var f = fold2(c.step.title + ' . ' + c.step.text).replace(POL_NEG[lang], ' ');
      c.pol = POL.map(function (p) { return { a: p.sA.test(f), b: p.sB.test(f), o: !p.obj || p.obj.test(f) }; });
      return c.pol;
    }
    function polPlan(question) {
      var f0 = fold2(question), f1 = pre ? pre(f0) : f0, plan = [];
      var any = function (re) { return re.test(f0) || re.test(f1); };
      if (POL) POL.forEach(function (p, i) {
        if ((p.obj && !any(p.obj)) || (p.nobj && any(p.nobj))) return;
        var a = any(p.A), b = any(p.B);
        if (a !== b) plan.push({ i: i, a: a, pr: !!p.promote });
      });
      return plan;
    }
    function polKeep(plan, c) {
      var pc = polOf(c);
      return plan.every(function (x) { var s = pc[x.i]; return !s.o || (x.a ? !(s.b && !s.a) : !(s.a && !s.b)); });
    }

    function render(d, s) {
      if (lang === 'fr') {
        var t = '[' + d.id + ' v' + d.version + ' étape ' + s.n + '] ' + s.title + ' : ' + s.text;
        if (s.warning) t += ' ATTENTION : ' + s.warning;
        if (s.reading) t += ' Relevé attendu (' + s.reading.label + ') : de ' + s.reading.min + ' à ' + s.reading.max + ' ' + s.reading.unit + '.';
        return t;
      }
      var t2 = '[' + d.id + ' v' + d.version + ' step ' + s.n + '] ' + s.title + ': ' + s.text;
      if (s.warning) t2 += ' WARNING: ' + s.warning;
      if (s.reading) t2 += ' Expected reading (' + s.reading.label + '): ' + s.reading.min + ' to ' + s.reading.max + ' ' + s.reading.unit + '.';
      return t2;
    }
    function out(status, reason, answer, srcs, conf, flagged) {
      srcs = srcs || [];
      return {
        status: status, reason: reason, answer: answer != null ? answer : REFUSE,
        citations: srcs.map(function (p) { return { procedure_id: p[0].id, version: p[0].version, step: p[1].n, title: p[1].title }; }),
        confidence: conf || { score: 0.0, coverage: 0.0 }, flagged_injection: !!flagged
      };
    }
    function r3(x) { return Math.round(x * 1000) / 1000; }

    function scopeProblem(question) {
      var f = fold2(question), m, asked = new Set();
      var A = new RegExp(P.asset.source, 'gi');
      while ((m = A.exec(f)) !== null) asked.add(assetKey(m[1] + m[2]));
      var bad = false;
      asked.forEach(function (a) { if (!knownAssets.has(a)) bad = true; });
      if (asked.size && bad) return 'asset_not_covered';
      var toks = tokens(f), i;
      if (toks.some(function (t) { return P.equipment[t] && !raw.has(t); })) return 'equipment_not_covered';
      if (toks.some(function (t) { return /^[a-z]\d{1,3}$/.test(t) && !raw.has(t); })) return 'tag_not_covered';
      for (i = 0; i + 1 < toks.length; i++) {
        if (P.itemWords[toks[i]] === 1 && /^\d+$/.test(toks[i + 1]) && !bigrams.has(toks[i] + '\u0000' + toks[i + 1])) return 'item_not_covered';
      }
      if (P.runtime.test(lang === 'fr' ? f : question)) return 'runtime_data_not_procedure';
      var ua = lang === 'fr' ? P.unknownAttr : (improve ? IMPROVE_EN.unknownAttr : null);
      if (ua && tokens(pre ? pre(f) : f).some(function (t) { return ua[t] && !raw.has(t); })) return 'attribute_not_covered';
      return null;
    }

    function final(shortcut, picks, conf, why) {
      if (shortcut) {
        var crit = picks.filter(function (p) { return p[1].warning || p[1].verify2 || p[1].hold; });
        var p0 = (crit.length ? crit : picks)[0];
        var msg = lang === 'fr'
          ? 'La procédure approuvée n’autorise pas cet écart ni ce raccourci. Suivez l’étape telle qu’elle est écrite ; tout écart passe par le chef de quart. ' + render(p0[0], p0[1]) + ' Escaladez au chef de quart.'
          : 'The approved procedure does not allow this deviation or shortcut. Follow the step as written; any deviation needs the shift lead. ' + render(p0[0], p0[1]) + ' Escalate to shift lead.';
        return out('declined', 'permission_or_shortcut', msg, [p0], conf);
      }
      return out('answer', why, picks.map(function (p) { return render(p[0], p[1]); }).join('\n'), picks, conf);
    }

    function decide(question) {
      if (typeof question !== 'string' || PY_BLANK.test(question) || cpLen(question) > MAX_Q) return out('refused', 'invalid_input');
      var tst = lang === 'fr' ? fold2(question) : question;
      if (P.injection.some(function (p) { return p.test(tst); }) || P.authority.test(tst)) return out('refused', 'injection_or_authority_claim', null, [], null, true);
      if (!chunks.length) return out('refused', 'no_approved_procedures');
      var problem = scopeProblem(question);
      if (problem) return out('refused', problem);
      var fq = fold2(question);
      var tq = lang === 'fr' ? fq : question;
      var wh = P.wh.exec(fq);
      var shortcut = !!(P.shortcut.test(tq) || P.shortcutExtra.test(tq) || (P.permission.test(tq) && !wh));
      var m = P.stepRef.exec(fq);
      if (m) {
        var n = parseInt(m[1], 10), st = doc.steps.filter(function (x) { return x.n === n; });
        if (st.length) {
          if (SUP && !shortcut && !supports(chunks.filter(function (c) { return c.step.n === n; })[0], keyWords(question))) return out('refused', 'attribute_not_in_step', null, [], { score: 1.0, coverage: 1.0 });
          return final(shortcut, [[doc, st[0]]], { score: 1.0, coverage: 1.0 }, 'explicit_step');
        }
      }
      var kw = SUP ? keyWords(question) : null;
      var qTerms = terms(question);
      if (SUP) {
        qTerms = tokens(norm(question)).filter(function (w) { return !P.stop[w] && !SUP.filler[w]; }).map(stem).filter(function (t) { return !SUP.filler[t]; });
        /* a question word the approved text never uses is replaced by the curated synonym(s) the text does use (so retrieval can find the step) */
        qTerms = [].concat.apply([], qTerms.map(function (t) {
          if (dfStem.has(t)) return [t];
          var syn = SUP.syn[t] || [], alt = syn.filter(function (x) { return dfStem.has(x) && x !== '__range'; });
          if (alt.length) return alt;
          return syn.indexOf('__range') >= 0 ? [] : [t];    // "maximum/range/value": an intent about the reading, checked by the support rule, not a retrieval term
        }));
      }
      if (!qTerms.length) return out('refused', 'no_content_terms');
      var ranked = score(qTerms);
      var rbTerm = lang === 'fr' ? P.rollbackTerm : (improve && IMPROVE_EN.rollbackRouting ? 'rollback' : null);
      if (rbTerm && qTerms.indexOf(rbTerm) >= 0 && ranked.some(function (r) { return r[2].step.rollback; })) {
        ranked = ranked.filter(function (r) { return r[2].step.rollback; }).concat(ranked.filter(function (r) { return !r[2].step.rollback; }));
      }
      var plan = polPlan(question);
      if (plan.length) {
        ranked = ranked.filter(function (r) { return polKeep(plan, r[2]); });
        if (!ranked.length) return out('refused', 'opposite_action_not_in_procedure');
        /* steps that do exactly the asked action (and not its opposite) go first, among the steps that already pass the thresholds */
        var exact = function (r) { return r[0] >= MIN_SCORE && r[1] >= MIN_COVERAGE && plan.some(function (x) { var s = polOf(r[2])[x.i]; return x.pr && s.o && (x.a ? s.a && !s.b : s.b && !s.a); }); };
        ranked = ranked.filter(exact).concat(ranked.filter(function (r) { return !exact(r); }));
      }
      var top = ranked[0], topS = top[0], topCov = top[1];
      var conf = { score: r3(topS), coverage: r3(topCov) };
      if (topS < MIN_SCORE || topCov < MIN_COVERAGE) return out('refused', 'low_confidence', null, [], conf);
      if (SUP && !shortcut && !kw.keys.length) return out('refused', 'no_key_terms', null, [], conf);   // only object words ("module 3") or an intent phrase with no subject: too vague to answer
      if (SUP && !shortcut) {   // refuse by default: the answering step must itself state what is asked; fall to the next ranked step that does, else refuse
        ranked = ranked.filter(function (r) { return r[0] >= MIN_SCORE && r[1] >= MIN_COVERAGE && supports(r[2], kw); });
        if (!ranked.length) return out('refused', 'attribute_not_in_step', null, [], conf);
        top = ranked[0]; topS = top[0]; conf = { score: r3(topS), coverage: r3(top[1]) };
      }
      var picks = [[top[2].doc, top[2].step]];
      ranked.slice(1, 3).forEach(function (r) {
        if (r[0] >= Math.max(MIN_SCORE, 0.85 * topS) && r[1] >= MIN_COVERAGE) picks.push([r[2].doc, r[2].step]);
      });
      return final(shortcut, picks, conf, 'grounded');
    }

    return { ask: decide, keyWords: SUP ? keyWords : null, terms: terms, lang: lang, improve: improve, refusal: REFUSE };
  }

  var api = { createQA: createQA, REFUSAL: REFUSAL, MIN_SCORE: MIN_SCORE, MIN_COVERAGE: MIN_COVERAGE, MAX_Q: MAX_Q, fold: fold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.OPSIGNE = root.OPSIGNE || {}; root.OPSIGNE.qa = api; }
})(typeof window !== 'undefined' ? window : globalThis);
