#!/usr/bin/env python3
"""WCAG 2.x contrast for every text/background and border/background pair used in css/site.css.
Reads the :root custom properties from the CSS so the table cannot drift from the stylesheet.
Exit 1 if any pair is below its threshold. Run: python3 tools/contrast.py [--md]"""
import re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(ROOT, "css", "site.css"), encoding="utf-8").read()
V = dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})", css))

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# (label, foreground var, background var, minimum, kind)
T, UI = 4.5, 3.0
PAIRS = [
 ("body text", "ink", "paper", T), ("body text on card", "ink", "panel", T), ("body text on band", "ink", "band", T),
 ("secondary text", "mut", "paper", T), ("secondary text on card", "mut", "panel", T), ("secondary text on band", "mut", "band", T),
 ("accent text/links", "accent", "paper", T), ("accent text on card", "accent", "panel", T), ("accent text on band", "accent", "band", T),
 ("button text", "on-accent", "accent", T), ("button hover text", "on-accent", "accent-hover", T),
 ("success text on card", "ok", "panel", T), ("success text on band", "ok", "band", T), ("success text on ok-tint", "ok", "ok-bg", T),
 ("stop text on card", "stop", "panel", T), ("stop text on stop-tint", "stop", "stop-bg", T),
 ("warning text on warn-tint", "warn", "warn-bg", T), ("ink on warn-tint", "ink", "warn-bg", T),
 ("dark band text", "on-dark", "dark", T), ("dark band muted", "on-dark-mut", "dark", T), ("accent on dark", "accent-on-dark", "dark", T),
 ("ink on mono/sample box (band)", "ink", "band", T),
 ("success text on page", "ok", "paper", T), ("stop text on page", "stop", "paper", T), ("warning text on page (simulation message)", "warn", "paper", T),
 ("warning text on card", "warn", "panel", T), ("ink on stop-tint", "ink", "stop-bg", T), ("ink on ok-tint", "ink", "ok-bg", T), ("secondary text on warn-tint", "mut", "warn-bg", T),
 ("success border vs card (state boxes)", "ok", "panel", UI), ("stop border vs card", "stop", "panel", UI), ("warn border vs card", "warn", "panel", UI),
 ("stop border vs stop-tint", "stop", "stop-bg", UI), ("ok border vs ok-tint", "ok", "ok-bg", UI), ("warn border vs warn-tint", "warn", "warn-bg", UI),
 ("card border vs page", "line", "paper", UI), ("card border vs band", "line", "band", UI), ("card border vs card", "line", "panel", UI),
 ("input border vs card", "line", "panel", UI), ("focus ring vs paper", "focus", "paper", UI), ("focus ring vs band", "focus", "band", UI),
 ("focus ring vs card", "focus", "panel", UI), ("focus ring vs dark", "focus-on-dark", "dark", UI),
 ("dark-band border vs dark", "line-on-dark", "dark", UI),
]
rows, bad = [], 0
for lab, fg, bg, need in PAIRS:
    r = ratio(V[fg], V[bg])
    ok = r >= need
    bad += not ok
    rows.append((lab, "#" + V[fg][1:], fg, V[bg], bg, r, need, ok))
if "--md" in sys.argv:
    print("| Pair | Foreground | Background | Ratio | Need | |\n|---|---|---|---|---|---|")
    for lab, f, fn, b, bn, r, need, ok in rows:
        print("| %s | %s (%s) | %s (%s) | %.2f:1 | %.1f | %s |" % (lab, f, fn, b, bn, r, need, "pass" if ok else "FAIL"))
else:
    for lab, f, fn, b, bn, r, need, ok in rows:
        print("%-34s %s on %s  %5.2f:1  (need %.1f)  %s" % (lab, f, b, r, need, "ok" if ok else "FAIL"))
print("pairs: %d, failing: %d" % (len(rows), bad))
sys.exit(1 if bad else 0)
