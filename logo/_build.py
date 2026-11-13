#!/usr/bin/env python3
"""OPSIGNE logo, direction A (chain check) - final geometry. Emits SVGs only (PNG/ICO: logo/_raster.py).
Hand-defined geometry, no fonts: the wordmark is stroked paths. Run: python3 logo/_build.py

Symbol: a check mark made of two chain links (hollow capsules). The links INTERLOCK: at one crossing the ink link passes over the
accent link, at the other the accent link passes over the ink link, with a small gap cut from the lower stroke (SVG mask, no
background colour needed, so it works on any background). Crossings are computed, not eyeballed.
Favicon: a simplified variant for 16-32 px (solid tile, solid check, one gap = the link) because 1.4 px outlines vanish at 16 px."""
import math, os
HERE = os.path.dirname(os.path.abspath(__file__))
THEMES = {  # 2 colours per theme: ink + accent
    "light": {"ink": "#2B2118", "accent": "#8F4524"},
    "dark":  {"ink": "#F7F2E9", "accent": "#E7A878"},
}
SW, HW = 5.5, 7.5          # link stroke width, link half-width (centre line to centre line / 2)
GAP = 1.6                  # clear gap between the over and the under stroke
A_P, A_Q = (13.0, 37.0), (25.0, 49.0)                      # short link end centres (45 deg)
B_P = (29.0, 43.0)                                          # long link starts inside the short link's end: two clean crossings
B_Q = (B_P[0] + 38 * math.cos(math.radians(50)), B_P[1] - 38 * math.sin(math.radians(50)))   # long link at 50 deg

def centreline(p, q, hw, n=240):
    """Points on the centre line of a stadium (capsule outline) whose axis runs p->q, half-width hw."""
    (x1, y1), (x2, y2) = p, q
    L = math.hypot(x2 - x1, y2 - y1); ux, uy = (x2 - x1) / L, (y2 - y1) / L; nx, ny = -uy, ux
    pts = []
    for i in range(n):  # straight side +, cap at q, straight side -, cap at p
        t = i / n
        if t < .25: s = t / .25; pts.append((x1 + ux * L * s + nx * hw, y1 + uy * L * s + ny * hw))
        elif t < .5:
            a = math.pi * (t - .25) / .25; pts.append((x2 + hw * (nx * math.cos(a) + ux * math.sin(a)), y2 + hw * (ny * math.cos(a) + uy * math.sin(a))))
        elif t < .75: s = (t - .5) / .25; pts.append((x2 - ux * L * s - nx * hw, y2 - uy * L * s - ny * hw))
        else:
            a = math.pi * (t - .75) / .25; pts.append((x1 - hw * (nx * math.cos(a) + ux * math.sin(a)) , y1 - hw * (ny * math.cos(a) + uy * math.sin(a))))
    return pts

def crossings():
    A, B = centreline(A_P, A_Q, HW), centreline(B_P, B_Q, HW)
    out = []
    for i in range(len(A)):
        a1, a2 = A[i], A[(i + 1) % len(A)]
        for j in range(len(B)):
            b1, b2 = B[j], B[(j + 1) % len(B)]
            d = (a2[0]-a1[0])*(b2[1]-b1[1]) - (a2[1]-a1[1])*(b2[0]-b1[0])
            if abs(d) < 1e-12: continue
            t = ((b1[0]-a1[0])*(b2[1]-b1[1]) - (b1[1]-a1[1])*(b2[0]-b1[0])) / d
            u = ((b1[0]-a1[0])*(a2[1]-a1[1]) - (b1[1]-a1[1])*(a2[0]-a1[0])) / d
            if 0 <= t < 1 and 0 <= u < 1:
                c = (a1[0] + t*(a2[0]-a1[0]), a1[1] + t*(a2[1]-a1[1]))
                if all(math.hypot(c[0]-o[0], c[1]-o[1]) > 3 for o in out): out.append(c)
    return sorted(out, key=lambda c: c[1])

def capsule(p, q, hw, sw, color, mask=None):
    (x1, y1), (x2, y2) = p, q
    L = math.hypot(x2 - x1, y2 - y1) + 2 * hw
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1)); cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    r = (f'<rect x="{-L/2:.2f}" y="{-hw}" width="{L:.2f}" height="{2*hw}" rx="{hw}" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'transform="translate({cx:.2f} {cy:.2f}) rotate({ang:.2f})"/>')
    return f'<g mask="url(#{mask})">{r}</g>' if mask else r   # mask on a wrapper: userSpaceOnUse masks use the element's own (rotated) space

def symbol(t):
    c = crossings(); assert len(c) == 2, c
    r = 5.6                          # clear disc: covers (half over-stroke + gap) / sin(crossing angle) along the under stroke
    # upper crossing: ink is OVER (cut a disc out of the accent link); lower crossing: accent is OVER (cut a disc out of the ink link)
    up, lo = c[0], c[1]
    def mask(i, c0):
        return (f'<mask id="{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/>'
                f'<circle cx="{c0[0]:.2f}" cy="{c0[1]:.2f}" r="{r:.2f}" fill="#000"/></mask>')
    # the "over" link is redrawn on top of the cut so the over-stroke stays continuous through the crossing
    over_ink = capsule(A_P, A_Q, HW, SW, t["ink"])
    clip_ink = (f'<clipPath id="cu"><circle cx="{up[0]:.2f}" cy="{up[1]:.2f}" r="{r - 0.05:.2f}"/></clipPath>')
    clip_acc = (f'<clipPath id="cl"><circle cx="{lo[0]:.2f}" cy="{lo[1]:.2f}" r="{r - 0.05:.2f}"/></clipPath>')
    body = (f'<defs>{mask("mi", lo)}{mask("ma", up)}{clip_ink}{clip_acc}</defs>'
            + capsule(A_P, A_Q, HW, SW, t["ink"], "mi")
            + capsule(B_P, B_Q, HW, SW, t["accent"], "ma")
            + f'<g clip-path="url(#cu)">{over_ink}</g>'
            + f'<g clip-path="url(#cl)">{capsule(B_P, B_Q, HW, SW, t["accent"])}</g>')
    return body

def letters(s):
    a = s / 2
    def O():  return 26, f'<rect x="{a}" y="{a}" width="{26-s}" height="{40-s}" rx="{(26-s)/2}" fill="none" stroke="currentColor" stroke-width="{s}"/>'
    def P():
        r = (24 - a) / 2; x1 = 26 - a - r
        return 26, f'<path d="M{a} 40V{a}H{x1:.2f}A{r:.2f} {r:.2f} 0 0 1 {x1:.2f} 24H{a}" fill="none" stroke="currentColor" stroke-width="{s}"/>'
    def S():
        r = (40 - s) / 4; y2 = a + 2 * r
        return 26, (f'<path d="M{26-a} {a}H{a+r:.2f}A{r:.2f} {r:.2f} 0 0 0 {a+r:.2f} {y2:.2f}H{26-a-r:.2f}A{r:.2f} {r:.2f} 0 0 1 {26-a-r:.2f} {40-a}H{a}" fill="none" stroke="currentColor" stroke-width="{s}"/>')
    def I():  return s, f'<path d="M{a} 0V40" fill="none" stroke="currentColor" stroke-width="{s}"/>'
    def G():
        r = (26 - s) / 2
        return 26, (f'<path d="M{26-a} {a+r:.2f}A{r:.2f} {r:.2f} 0 0 0 {a} {a+r:.2f}V{40-a-r:.2f}A{r:.2f} {r:.2f} 0 0 0 {26-a} {40-a-r:.2f}V21H13" fill="none" stroke="currentColor" stroke-width="{s}"/>')
    def N():
        d = s * 1.15
        return 26, f'<path d="M0 40V0H{d:.2f}L{26-d:.2f} 26V0H26V40H{26-d:.2f}L{d:.2f} 14V40Z" fill="currentColor"/>'
    def E():  return 26, f'<path d="M{26-a} {a}H{a}V{40-a}H{26-a}M{a} 20H22" fill="none" stroke="currentColor" stroke-width="{s}"/>'
    return [O(), P(), S(), I(), G(), N(), E()]

def wordmark(s=5.0, track=7, y=12, x0=84):
    x, out = x0, []
    for w, svg in letters(s):
        out.append(f'<g transform="translate({x:.2f} {y})">{svg}</g>'); x += w + track
    return "\n".join(out), x - track - x0

def favicon():
    """Simplified for 16-32 px: solid tile + one solid check made of two solid links (long one in the accent) with one clear gap."""
    t = THEMES["light"]
    cap = lambda p, q, hw, fill: capsule(p, q, hw, 0, fill).replace('fill="none" stroke="%s" stroke-width="0"' % fill, f'fill="{fill}"')
    s1 = cap((18.0, 33.5), (27.0, 42.5), 6.0, "#F7F2E9")
    s2 = cap((30.6, 41.2), (47.0, 20.5), 6.0, "#E7A878").replace('/>', f' stroke="{t["ink"]}" stroke-width="3" paint-order="stroke"/>')   # ink outline = the clear gap where link 2 passes over link 1
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><title>OPSIGNE</title>'
            f'<rect width="64" height="64" rx="14" fill="{t["ink"]}"/>{s1}{s2}</svg>\n')

def favicon_square():
    """apple-touch-icon source: full-bleed square (iOS rounds the corners itself and fills transparency with black)."""
    return favicon().replace(' rx="14"', "")

def main():
    for tn, t in THEMES.items():
        body = symbol(t)
        open(f"{HERE}/symbol-{tn}.svg", "w").write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><title>OPSIGNE symbol - check mark made of two interlocked chain links</title>{body}</svg>\n')
        wm, w = wordmark()
        open(f"{HERE}/lockup-{tn}.svg", "w").write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {84+w:.0f} 64" role="img" color="{t["ink"]}"><title>OPSIGNE</title>{body}\n{wm}</svg>\n')
    open(f"{HERE}/favicon.svg", "w").write(favicon())
    open(f"{HERE}/_favicon-square.svg", "w").write(favicon_square())
    print("crossings:", [(round(x, 2), round(y, 2)) for x, y in crossings()])

if __name__ == "__main__":
    main()
