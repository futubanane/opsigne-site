#!/usr/bin/env python3
"""Writes data/mop-ups-017.fr.json: the French rendering of the fictional MOP-UPS-017 (same ids, steps, numbers and limits as the
English source data/mop-ups-017.json; only the human text is translated). Structure is checked against the source."""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(os.path.join(R, "data", "mop-ups-017.json"), encoding="utf-8"))
T = {
1: ("Confirmer la fenêtre d’intervention", "Confirmer que la demande de changement CHG-DEMO-0042 est approuvée et que l’avis client pour la fenêtre a été envoyé. Ne pas démarrer en dehors de la fenêtre approuvée.", None, None),
2: ("Vérifier la marge de charge", "Sur l’afficheur de l’UPS-B2, lire la charge de sortie totale. Les modules restants doivent pouvoir porter la charge sans le module 3. Ne poursuivre que si la charge totale est dans la limite.", None, ("Charge de sortie totale de l’UPS-B2", "%")),
3: ("Enfiler les EPI contre l’arc électrique", "Enfiler les EPI contre l’arc électrique adaptés à la catégorie indiquée sur l’étiquette de l’armoire, les gants isolants et l’écran facial avant d’ouvrir toute porte d’armoire de l’UPS-B2.", "DANGER D’ARC ÉLECTRIQUE : ne pas ouvrir la porte de l’armoire sans les EPI adaptés. Ne pas travailler seul dans l’armoire.", None),
4: ("Isoler le module 3 depuis le panneau de commande", "Au panneau de commande de l’UPS-B2, sélectionner le module 3 et choisir Isoler. Vérifier que le panneau affiche le module 3 comme ISOLÉ et que les modules 1, 2 et 4 restent EN LIGNE.", None, None),
5: ("Verrouillage et étiquetage (consignation) du disjoncteur de sortie du module 3", "Ouvrir le disjoncteur de sortie Q3 du module 3. Poser votre cadenas personnel et votre étiquette de danger sur Q3. Une seconde personne doit vérifier de façon indépendante que le cadenas et l’étiquette sont sur Q3 et que la manette du disjoncteur ne peut pas être bougée.", "LE VERROUILLAGE EST OBLIGATOIRE. Ne jamais retirer ni contourner le cadenas d’une autre personne. Ne jamais sauter le verrouillage.", None),
6: ("Prouver l’absence de tension", "Avec un testeur de tension adapté, tester les bornes de sortie du module 3 entre phases et entre phase et terre. Tester le testeur sur une source sous tension connue avant et après. La valeur lue doit être proche de zéro avant tout travail sur le module.", None, ("Tension aux bornes de sortie du module 3", "V CA")),
7: ("Retirer le module 3", "Desserrer les deux vis de maintien avant et faire glisser le module 3 sur le chariot élévateur de modules. Le module pèse environ 85 kg : utiliser le chariot et deux personnes. Ne pas le soulever à la main.", None, None),
8: ("Inspecter le connecteur du fond de panier", "Inspecter le connecteur du fond de panier de l’emplacement vide : broches tordues, traces de brûlure ou débris. En cas de dommage, s’arrêter et passer à l’étape de repli.", None, None),
9: ("Insérer le module de remplacement", "Vérifier que la référence et l’étiquette de firmware du module de remplacement correspondent à celles du module retiré. Faire glisser le module de remplacement dans l’emplacement 3 et serrer les deux vis de maintien à 5 Nm.", None, None),
10: ("Retirer le cadenas et fermer le disjoncteur d’entrée", "Retirer votre propre cadenas et votre étiquette de Q3. Fermer le disjoncteur d’entrée Q1 du module 3 et attendre 120 secondes la précharge. Lire ensuite la tension du bus continu du module 3.", None, ("Tension du bus continu du module 3", "V CC")),
11: ("Mettre le module 3 en ligne et vérifier la sortie", "Au panneau de commande, sélectionner le module 3 et choisir En ligne. Une fois que le module indique EN LIGNE, lire la tension de sortie du module 3.", None, ("Tension de sortie du module 3", "V CA")),
12: ("Vérifier le partage de charge et clôturer", "Comparer la charge du module 3 à celle des modules 1, 2 et 4. Noter l’écart. Ne clôturer la demande de changement CHG-DEMO-0042 qu’une fois le partage de charge dans les limites.", None, ("Écart de charge du module 3 par rapport à la moyenne", "%")),
13: ("REPLI : revenir à la configuration d’origine", "Arrêter le travail. Sélectionner le module 3 et choisir Isoler. Ouvrir les disjoncteurs Q1 et Q3 et reposer votre cadenas et votre étiquette. Réinstaller le module 3 d’origine s’il a été retiré. Remettre le module 3 dans son état précédent et prévenir le chef de quart avant toute autre action.", None, None),
}
doc = json.loads(json.dumps(src))
doc["title"] = "Remplacement d’un module UPS (fictif) : remplacer le module de puissance 3 de l’UPS-B2"
for s in doc["steps"]:
    title, text, warn, rd = T[s["n"]]
    s["title"], s["text"] = title, text
    if warn: s["warning"] = warn
    elif "warning" in s: raise SystemExit("source warning missing in FR for step %d" % s["n"])
    if rd: s["reading"]["label"], s["reading"]["unit"] = rd
# structure check: identical except human text
def skeleton(d):
    d = json.loads(json.dumps(d)); d.pop("title")
    for s in d["steps"]:
        for k in ("title", "text", "warning"): s.pop(k, None)
        if "reading" in s: s["reading"].pop("label"); s["reading"].pop("unit")
    return d
assert skeleton(doc) == skeleton(src), "FR doc structure differs from source"
assert all(("warning" in a) == ("warning" in b) for a, b in zip(doc["steps"], src["steps"]))
json.dump(doc, open(os.path.join(R, "data", "mop-ups-017.fr.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(doc["steps"]), "steps")
