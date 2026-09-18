#!/usr/bin/env python3
"""Traces the mark from a flat raster into one SVG path.

The result takes currentColor, so the mark is whatever colour the thing
around it is — pink on the page, petal on the dark rail — instead of a
recoloured PNG that has to be re-exported every time the palette moves.
"""
import sys, numpy as np, potrace
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("L")

# The art is dark on light: everything below the midpoint is the mark.
a = np.array(im)
mask = a < (int(a.min()) + int(a.max())) // 2

# Trim to the ink, then pad by 6% so the mark has its own breathing room
# rather than inheriting whatever margin the source file happened to have.
ys, xs = np.nonzero(mask)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
mask = mask[y0:y1, x0:x1]
h, w = mask.shape
pad = int(round(max(h, w) * 0.06))
side = max(h, w) + pad * 2
# potracer reads a FALSE cell as ink, so the canvas starts true (blank) and
# the mark is punched into it. Passing the mask the other way up traces the
# page and hands back the mark as a hole.
box = np.ones((side, side), dtype=bool)
oy, ox = (side - h) // 2, (side - w) // 2
box[oy:oy + h, ox:ox + w] = ~mask

path = potrace.Bitmap(box).trace(turdsize=2, alphamax=1.0, opticurve=True, opttolerance=0.2)

out = []
for curve in path:
    p0 = curve.start_point; x, y = p0.x, p0.y
    out.append(f"M{x:.2f} {y:.2f}")
    for seg in curve:
        if seg.is_corner:
            cx, cy = seg.c.x, seg.c.y
            ex, ey = seg.end_point.x, seg.end_point.y
            out.append(f"L{cx:.2f} {cy:.2f}L{ex:.2f} {ey:.2f}")
        else:
            a1, b1 = seg.c1.x, seg.c1.y
            a2, b2 = seg.c2.x, seg.c2.y
            ex, ey = seg.end_point.x, seg.end_point.y
            out.append(f"C{a1:.2f} {b1:.2f} {a2:.2f} {b2:.2f} {ex:.2f} {ey:.2f}")
    out.append("Z")
d = "".join(out)

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" '
       f'fill="currentColor" aria-hidden="true"><path d="{d}"/></svg>')
open(dst, "w").write(svg)
print(f"{dst}  viewBox 0 0 {side} {side}  {len(d)} chars  {len(list(path))} contours")
