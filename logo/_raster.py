#!/usr/bin/env python3
"""Rasterises the logo SVGs with the server's Chrome (via playwright, tools/render_svg.js) and packs favicon.ico with the stdlib.
Needs node + playwright (see docs/DESIGN-NOTES.md). Run after logo/_build.py:  python3 logo/_raster.py"""
import os, struct, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "png"); os.makedirs(OUT, exist_ok=True)
NODE = os.environ.get("NODE", "node")
def render(svg, out, w):
    subprocess.run([NODE, os.path.join(ROOT, "tools", "render_svg.js"), os.path.join(HERE, svg), os.path.join(OUT, out), str(w)], check=True)
for w in (16, 32, 512): render("favicon.svg", f"favicon-{w}.png", w)
render("_favicon-square.svg", "apple-touch-icon-180.png", 180)
for tn in ("light", "dark"):
    render(f"symbol-{tn}.svg", f"symbol-{tn}-512.png", 512)
    render(f"lockup-{tn}.svg", f"lockup-{tn}-1148.png", 1148)
# favicon.ico = PNG-compressed images (16, 32, 48), valid since Windows Vista and all browsers
render("favicon.svg", "_ico-48.png", 48)
imgs = [(s, open(os.path.join(OUT, n), "rb").read()) for s, n in ((16, "favicon-16.png"), (32, "favicon-32.png"), (48, "_ico-48.png"))]
head = struct.pack("<HHH", 0, 1, len(imgs)); off = 6 + 16 * len(imgs); ent = b""; data = b""
for s, png in imgs:
    ent += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(png), off + len(data)); data += png
open(os.path.join(HERE, "favicon.ico"), "wb").write(head + ent + data)
os.remove(os.path.join(OUT, "_ico-48.png"))
print("ok", sorted(os.listdir(OUT)))
