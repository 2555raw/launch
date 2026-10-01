"""
Generates public/images/footer-trail.svg: a fine engraving-style landscape with
two hikers (backpacks, hats, trekking poles) crossing a grassland below a
mountain range. Deterministic: the same seed always draws the same picture.

    python3 scripts/footer-art.py
"""

import math
import random
from pathlib import Path

W, H = 1600, 520
INK = "#0e2c1f"  # matches the footer background, so the sky reads as the page
PAPER = "#f2ead3"
rng = random.Random(11)


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def bumps(x, spec):
    total = 0.0
    for c, w, h, flat in spec:
        d = abs(x - c) / w
        # flat > 0 gives a mesa: a broad top that falls off steeply.
        total += h * math.exp(-(d ** (2 + flat)))
    return total


def make_ridge(base, spec, rough, seed):
    r = random.Random(seed)
    ph = [r.uniform(0, 6.28) for _ in range(5)]

    def ridge(x):
        n = (
            math.sin(x / 41 + ph[0]) * 0.45
            + math.sin(x / 17 + ph[1]) * 0.3
            + math.sin(x / 7.1 + ph[2]) * 0.17
            + math.sin(x / 2.9 + ph[3]) * 0.08
        )
        return base - bumps(x, spec) + n * rough

    return ridge


GROUND_Y = 372
# Back to front: (centre, width, height, flatness).
LAYERS = [
    make_ridge(352, [(110, 170, 46, 0), (470, 230, 30, 0), (1130, 150, 128, 2.2), (1260, 90, 70, 0.5), (1520, 160, 56, 0)], 2.2, 1),
    make_ridge(362, [(260, 240, 34, 0), (700, 200, 20, 0), (960, 160, 24, 0), (1420, 210, 30, 0)], 1.6, 2),
    make_ridge(370, [(40, 200, 18, 0), (560, 260, 14, 0), (1250, 260, 16, 0)], 1.0, 3),
]

STROKES = {"hair": 0.42, "thin": 0.55, "mid": 0.75, "bold": 1.0}
paths = {k: [] for k in STROKES}
out = []


def seg(group, x1, y1, x2, y2):
    paths[group].append(f"M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}")


def curve(group, x1, y1, cx, cy, x2, y2):
    paths[group].append(f"M{f(x1)} {f(y1)}Q{f(cx)} {f(cy)} {f(x2)} {f(y2)}")


def flush():
    """Write pending strokes so whatever is drawn next covers them."""
    for name, width in STROKES.items():
        if paths[name]:
            out.append(f'<path d="{"".join(paths[name])}" fill="none" stroke="{INK}" stroke-width="{width}" stroke-linecap="round"/>')
            paths[name].clear()


# Mountains: paper fill, then fine contour hatching that follows each ridge.
for li, ridge in enumerate(LAYERS):
    flush()
    pts = [(x, ridge(x)) for x in range(0, W + 1, 3)]
    d = "M0 " + f(H) + "L" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + f"L{W} {H}Z"
    out.append(f'<path d="{d}" fill="{PAPER}"/>')
    for x in range(0, W, 2):
        if rng.random() < 0.95:
            seg("thin", x, ridge(x), x + 2, ridge(x + 2))
    step = 1.75
    k = 1
    while True:
        off = k * step
        if off > 150:
            break
        x = 0.0
        drew = False
        while x < W:
            length = rng.uniform(2.5, 9)
            x2 = min(W, x + length)
            top = ridge(x)
            if GROUND_Y + 6 - top > off:
                drew = True
                slope = (ridge(x2) - top) / max(1e-6, x2 - x)  # > 0: facing away from the light
                rel = off / max(8, GROUND_Y - top)
                if slope > 0.12:
                    p, g = 0.93, "thin"
                elif slope > -0.05:
                    p, g = 0.6, "hair"
                else:
                    p, g = 0.38, "hair"
                p *= 1 - rel * 0.5
                if rng.random() < p:
                    wob = math.sin(x / 11 + k * 0.7) * 0.5
                    seg(g, x, top + off + wob, x2, ridge(x2) + off + wob)
            x = x2 + rng.uniform(0.8, 3.5)
        if not drew:
            break
        k += 1
    # Rock and gully marks across the steep faces of the far range.
    if li == 0:
        for _ in range(1600):
            x = rng.uniform(0, W)
            top = ridge(x)
            if GROUND_Y - top < 40:
                continue
            slope = ridge(x + 2) - ridge(x)
            if abs(slope) > 0.35 or rng.random() < 0.15:
                yy = rng.uniform(top + 3, GROUND_Y - 6)
                dx = 0.8 if slope > 0 else -0.8
                seg("hair", x, yy, x + dx * rng.uniform(1, 3), yy + rng.uniform(2.5, 6))

flush()

# Ground: very fine horizontal strokes, tight near the horizon and opening up toward us.
y = GROUND_Y + 1.2
while y < H:
    t = (y - GROUND_Y) / (H - GROUND_Y)
    gap = 1.6 + t * 4.2
    x = rng.uniform(0, 5)
    while x < W:
        length = rng.uniform(1.5, 5 + t * 9)
        if rng.random() < 0.5 - t * 0.22:
            yj = rng.uniform(-0.3, 0.3)
            seg("hair", x, y + yj, x + length, y + yj)
        x += length + rng.uniform(2, 9 + t * 12)
    y += gap

HIKERS = [(742, 448, 0.92, 1), (816, 452, 0.96, 0)]


def tuft(cx, by, size):
    blades = rng.randint(7, 15) if size > 10 else rng.randint(4, 8)
    group = "mid" if size > 20 else ("thin" if size > 9 else "hair")
    for _ in range(blades):
        ang = rng.gauss(0, 0.5)
        h = size * rng.uniform(0.45, 1.0)
        tipx = cx + math.sin(ang) * h * 0.95 + rng.uniform(-1.5, 1.5)
        tipy = by - math.cos(ang) * h
        bx = cx + rng.uniform(-size * 0.15, size * 0.15)
        bend = rng.uniform(-3, 3)
        curve(group, bx, by, (bx + tipx) / 2 + bend, (by + tipy) / 2 - 1.5, tipx, tipy)
    for i in range(3 if size > 9 else 1):
        seg("hair", cx - size * 0.55 + i * 1.5, by + 1 + i * 1.2, cx + size * 0.6 - i * 1.5, by + 1 + i * 1.2)


def clear_of_hikers(cx, by):
    return not (HIKERS[0][0] - 45 < cx < HIKERS[1][0] + 45 and HIKERS[0][1] - 30 < by < HIKERS[1][1] + 14)


# Small sprigs near the horizon, bushy clumps in the foreground.
for _ in range(700):
    t = rng.random() ** 0.75
    by = GROUND_Y + 5 + t * (H - GROUND_Y + 6)
    cx = rng.uniform(-10, W + 10)
    if clear_of_hikers(cx, by):
        tuft(cx, by, 3 + t * 26)
# A few tall clumps along the bottom edge.
for _ in range(60):
    cx = rng.uniform(-10, W + 10)
    if clear_of_hikers(cx, H - 6):
        tuft(cx, H + rng.uniform(-6, 4), rng.uniform(26, 40))
flush()

defs = []
art = []


def hiker(idx, x, y0, s, phase):
    """A hiker walking right, inked solid with fine paper hatching on the lit side."""
    g = []
    P = lambda dx, dy: (x + dx * s, y0 + dy * s)  # noqa: E731

    def line(a, b, width, color=INK):
        g.append(f'<path d="M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}" stroke="{color}" stroke-width="{f(width * s)}" stroke-linecap="round" fill="none"/>')

    def poly(points, color=INK, width=0.0):
        d = "M" + "L".join(f"{f(px)} {f(py)}" for px, py in points) + "Z"
        stroke = f' stroke="{color}" stroke-width="{f(width * s)}" stroke-linejoin="round"' if width else ""
        g.append(f'<path d="{d}" fill="{color}"{stroke}/>')

    stride = 13.5 if phase == 0 else 11
    hip, shoulder = P(0, -40), P(5, -66)
    back_foot, front_foot = P(-stride, 0), P(stride, 0)
    front_knee, back_knee = P(stride * 0.55, -21), P(-stride * 0.3, -20)
    back_hand, front_hand = P(-7, -44), P(17, -48)

    # Shadow on the ground, drawn as fine strokes.
    for i in range(5):
        line(P(-20 + i * 2, 1.2 + i * 0.9), P(28 - i * 3, 1.2 + i * 0.9), 0.45)
    # Back pole and back arm first.
    line(back_hand, P(-21, 1), 1.1)
    line(hip, back_knee, 7.2)
    line(back_knee, back_foot, 6.2)
    line(hip, front_knee, 7.2)
    line(front_knee, front_foot, 6.2)
    for fx, fy in (back_foot, front_foot):
        poly([(fx - 3 * s, fy - 3 * s), (fx + 6.5 * s, fy - 2.2 * s), (fx + 7 * s, fy + 0.6 * s), (fx - 3.4 * s, fy + 0.8 * s)], INK, 0.8)
    line(hip, shoulder, 12.5)
    line(shoulder, back_hand, 4.6)
    # Backpack, sleeping mat on top, bottle on the side.
    poly([P(-17, -71), P(-4.5, -73), P(-1.5, -43), P(-15.5, -40.5)], INK, 1.6)
    g.append(f'<ellipse cx="{f(P(-10.5, -75)[0])}" cy="{f(P(-10.5, -75)[1])}" rx="{f(8 * s)}" ry="{f(3.3 * s)}" fill="{INK}"/>')
    poly([P(-19.5, -56), P(-16.5, -56.5), P(-16, -46), P(-19, -45.5)], INK, 0.6)
    # Head, wide brim hat.
    head = P(8.5, -76.5)
    g.append(f'<circle cx="{f(head[0])}" cy="{f(head[1])}" r="{f(5.4 * s)}" fill="{INK}"/>')
    brim = P(8.5, -81)
    g.append(f'<ellipse cx="{f(brim[0])}" cy="{f(brim[1])}" rx="{f(9.2 * s)}" ry="{f(1.7 * s)}" fill="{INK}"/>')
    poly([P(3.8, -81), P(4.8, -87.5), P(12.2, -87.5), P(13.2, -81)], INK, 0.8)
    # Front arm and pole.
    line(shoulder, P(13, -55), 4.6)
    line(P(13, -55), front_hand, 4.2)
    line(front_hand, P(26, 1), 1.1)
    g.append(f'<circle cx="{f(front_hand[0])}" cy="{f(front_hand[1])}" r="{f(2.1 * s)}" fill="{INK}"/>')
    body = "".join(g)

    # Engraved light: fine paper lines clipped to the figure, denser toward the lit (left/top) edges.
    cid = f"h{idx}"
    defs.append(f'<clipPath id="{cid}">{body}</clipPath>')
    hatch = []
    top, bottom = y0 - 90 * s, y0 + 2 * s
    yy = top
    while yy < bottom:
        xs = x - 26 * s
        while xs < x + 22 * s:
            ln = rng.uniform(1.5, 4.5) * s
            lit = (x + 2 * s - xs) / (30 * s)  # 1 at the left edge, 0 in the middle
            if rng.random() < 0.18 + max(0.0, lit) * 0.55:
                hatch.append(f"M{f(xs)} {f(yy)}L{f(xs + ln)} {f(yy - ln * 0.35)}")
            xs += ln + rng.uniform(1.2, 3.5) * s
        yy += 1.35 * s
    detail = [
        # Pack straps, hip belt, mat roll and hat band.
        (P(-15.5, -64), P(-5, -65.5)),
        (P(-15.2, -58), P(-4.2, -59.5)),
        (P(-16, -50), P(-3, -51)),
        (P(-17.2, -75), P(-3.8, -75)),
        (P(4.8, -82.6), P(12.2, -82.6)),
        (P(1.2, -38), P(stride * 0.5, -22)),
        (P(4.2, -62), P(1.6, -44)),
    ]
    lines = "".join(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}" for a, b in detail)
    art.append(
        body
        + f'<path d="{"".join(hatch)}" stroke="{PAPER}" stroke-width="{f(0.32 * s)}" fill="none" clip-path="url(#{cid})" opacity="0.85"/>'
        + f'<path d="{lines}" stroke="{PAPER}" stroke-width="{f(0.5 * s)}" stroke-linecap="round" fill="none" clip-path="url(#{cid})"/>'
    )


for i, (hx, hy, hs, ph) in enumerate(HIKERS):
    hiker(i, hx, hy, hs, ph)

svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">',
    f"<defs>{''.join(defs)}</defs>",
    "".join(out),
    "".join(art),
    "</svg>",
]
dest = Path(__file__).resolve().parent.parent / "public" / "images" / "footer-trail.svg"
dest.write_text("".join(svg))
print(dest, round(dest.stat().st_size / 1024), "KB")
