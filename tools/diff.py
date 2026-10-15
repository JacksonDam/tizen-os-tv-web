#!/usr/bin/env python3
"""Compare a web capture with a reference screenshot from the real TV UI.

usage: diff.py ref.png shot.png [out.png] [--crop x,y,w,h]
Prints the mean absolute difference (0-255) overall and per 4x4 grid cell, and writes a
composite: reference | web | amplified difference (red = web brighter, cyan = reference brighter).
"""
import sys
from PIL import Image, ImageChops

args = sys.argv[1:]
crop = None
if "--crop" in args:
    i = args.index("--crop")
    x, y, w, h = map(int, args[i + 1].split(","))
    crop = (x, y, x + w, y + h)
    del args[i:i + 2]
ref = Image.open(args[0]).convert("RGB")
web = Image.open(args[1]).convert("RGB").resize(ref.size)
if crop:
    ref, web = ref.crop(crop), web.crop(crop)
W, H = ref.size

diff = ImageChops.difference(ref, web).convert("L")
hist = diff.histogram()
mean = sum(i * n for i, n in enumerate(hist)) / (W * H)
print(f"mean abs diff {mean:.2f}")
rows = []
for gy in range(4):
    cells = []
    for gx in range(4):
        c = diff.crop((gx * W // 4, gy * H // 4, (gx + 1) * W // 4, (gy + 1) * H // 4))
        h = c.histogram()
        cells.append(sum(i * n for i, n in enumerate(h)) / (c.size[0] * c.size[1]))
    rows.append(" ".join(f"{v:6.1f}" for v in cells))
print("grid (4x4):\n  " + "\n  ".join(rows))

if len(args) > 2:
    lr, lw = ref.convert("L"), web.convert("L")
    pos = ImageChops.subtract(lw, lr).point(lambda v: min(255, v * 4))
    neg = ImageChops.subtract(lr, lw).point(lambda v: min(255, v * 4))
    heat = Image.merge("RGB", (pos, neg, neg))
    out = Image.new("RGB", (W * 3, H))
    out.paste(ref, (0, 0)); out.paste(web, (W, 0)); out.paste(heat, (W * 2, 0))
    scale = min(1.0, 2880 / out.size[0])
    out = out.resize((int(out.size[0] * scale), int(out.size[1] * scale)))
    out.save(args[2])
    print(args[2])
