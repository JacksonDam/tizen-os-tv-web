#!/usr/bin/env python3
"""Compare element bounding boxes between a reference screenshot and a web capture.

usage: boxes.py ref.png web.png regions.json
regions.json: {"name": [x0, y0, x1, y1, "pred"], ...} where pred is one of
  white (r,g,b > 200), light (sum > 400), text (sum > 300), dark (sum < 60)
For each region prints the ink bounding box in both images and the deltas (dx, dy, dw, dh).
"""
import json, sys
from PIL import Image

PREDS = {
    "white": lambda c: c[0] > 200 and c[1] > 200 and c[2] > 200,
    "light": lambda c: sum(c) > 400,
    "text": lambda c: sum(c) > 300,
    "dark": lambda c: sum(c) < 60,
}

def bbox(px, x0, y0, x1, y1, pred):
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pred(px[x, y]):
                xs.append(x); ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None

ref = Image.open(sys.argv[1]).convert("RGB").load()
web = Image.open(sys.argv[2]).convert("RGB").load()
for name, (x0, y0, x1, y1, p) in json.load(open(sys.argv[3])).items():
    a = bbox(ref, x0, y0, x1, y1, PREDS[p])
    b = bbox(web, x0, y0, x1, y1, PREDS[p])
    if a and b:
        d = (b[0] - a[0], b[1] - a[1], (b[2] - b[0]) - (a[2] - a[0]), (b[3] - b[1]) - (a[3] - a[1]))
        flag = "" if max(map(abs, d)) <= 1 else "  <--"
        print(f"{name:18} ref {a}  web {b}  d(x,y,w,h)={d}{flag}")
    else:
        print(f"{name:18} ref {a}  web {b}")
