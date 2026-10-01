"""
Generates public/images/footer-trail.svg: an engraving-style landscape with
two hikers (backpacks, trekking poles) crossing a grassland under a mountain
range. Deterministic: the same seed always draws the same picture.

    python3 scripts/footer-art.py
"""

import math
import random
from pathlib import Path

W, H = 1600, 560
INK = "#0e2c1f"  # matches the footer background, so the sky reads as the page
PAPER = "#f2ead3"
rng = random.Random(7)


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def bumps(x, spec):
    return sum(h * math.exp(-(((x - c) / w) ** 2)) for c, w, h in spec)


def make_ridge(base, spec, rough, seed):
    r = random.Random(seed)
    phases = [r.uniform(0, 6.28) for _ in range(4)]

    def ridge(x):
        n = (
            math.sin(x / 37 + phases[0]) * 0.5
            + math.sin(x / 13 + phases[1]) * 0.3
            + math.sin(x / 5.3 + phases[2]) * 0.2
        )
        return base - bumps(x, spec) + n * rough

    return ridge


# Back to front. (centre, width, height) bumps above a base line.
LAYERS = [
    make_ridge(392, [(70, 160, 70), (420, 210, 52), (760, 180, 40), (1110, 125, 168), (1235, 85, 120), (1505, 170, 90)], 3.2, 1),
    make_ridge(404, [(250, 230, 44), (620, 150, 30), (930, 210, 38), (1390, 200, 46)], 2.4, 2),
]
GROUND_Y = 404

paths = {"fill": [], "thin": [], "mid": [], "bold": []}


def seg(group, x1, y1, x2, y2):
    paths[group].append(f"M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}")


def curve(group, x1, y1, cx, cy, x2, y2):
    paths[group].append(f"M{f(x1)} {f(y1)}Q{f(cx)} {f(cy)} {f(x2)} {f(y2)}")


out = []


def flush():
    """Write the pending strokes, so whatever is drawn next covers them."""
    for name, attrs in STROKES.items():
        if paths[name]:
            out.append(f'<path d="{"".join(paths[name])}" fill="none" stroke="{INK}" {attrs} stroke-linecap="round"/>')
            paths[name].clear()


STROKES = {"thin": 'stroke-width="0.8"', "mid": 'stroke-width="1.15"', "bold": 'stroke-width="1.6"'}

# Mountains: paper fill, then contour hatching that follows each ridge.
for li, ridge in enumerate(LAYERS):
    flush()
    pts = [(x, ridge(x)) for x in range(0, W + 1, 4)]
    d = "M0 " + f(H) + "L" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + f"L{W} {H}Z"
    out.append(f'<path d="{d}" fill="{PAPER}"/>')
    # Ridge outline, slightly broken like a burin line.
    for x in range(0, W, 3):
        if rng.random() < 0.93:
            seg("mid", x, ridge(x), x + 3, ridge(x + 3))
    # Contours: offsets of the ridge, densest on the slopes facing away from the light (left).
    depth = 190 if li == 0 else 60
    step = 2.5
    k = 1
    while k * step < depth:
        off = k * step
        x = 0.0
        while x < W:
            length = rng.uniform(4, 15)
            x2 = min(W, x + length)
            slope = (ridge(x2) - ridge(x)) / max(1e-6, x2 - x)  # > 0: descending to the right, in shadow
            height = GROUND_Y - ridge(x)
            if height > off * 0.9:
                shade = 0.95 if slope > 0.08 else (0.62 if slope > -0.08 else 0.36)
                shade *= 1 - (off / depth) * 0.45
                if rng.random() < shade:
                    wob = math.sin(x / 9 + k) * 0.6
                    y1 = ridge(x) + off + wob
                    y2 = ridge(x2) + off + wob
                    seg("thin" if slope <= 0.08 else "mid", x, y1, x2, y2)
            x = x2 + rng.uniform(1.5, 6)
        k += 1

    # Rock texture: short strokes down the shaded faces.
    for _ in range(900 if li == 0 else 250):
        x = rng.uniform(0, W)
        top = ridge(x)
        if GROUND_Y - top < 25:
            continue
        slope = ridge(x + 2) - ridge(x)
        if slope > 0.15 or rng.random() < 0.25:
            yy = rng.uniform(top + 4, GROUND_Y - 4)
            seg("thin", x, yy, x + rng.uniform(1, 4), yy + rng.uniform(2, 6))

flush()

# Ground: fine horizontal strokes, tighter toward the horizon.
y = GROUND_Y + 2.0
while y < H:
    t = (y - GROUND_Y) / (H - GROUND_Y)
    gap = 2.4 + t * 7
    x = rng.uniform(0, 8)
    while x < W:
        length = rng.uniform(3, 9 + t * 16)
        if rng.random() < 0.48 - t * 0.24:
            seg("thin", x, y + rng.uniform(-0.6, 0.6), x + length, y + rng.uniform(-0.6, 0.6))
        x += length + rng.uniform(4, 16 + t * 20)
    y += gap

HIKERS_X = (735, 832)
HIKERS_FOOT = 474


def tuft(cx, by, size):
    blades = rng.randint(5, 11)
    for _ in range(blades):
        ang = rng.uniform(-1.15, 1.15)
        h = size * rng.uniform(0.55, 1.0)
        tipx = cx + math.sin(ang) * h * 0.9 + rng.uniform(-2, 2)
        tipy = by - math.cos(ang) * h
        bx = cx + rng.uniform(-size * 0.18, size * 0.18)
        curve("bold" if size > 18 else "mid", bx, by, (bx + tipx) / 2 - math.sin(ang) * 3, (by + tipy) / 2 - 2, tipx, tipy)
    # Shadow strokes under the tuft.
    for i in range(3):
        seg("thin", cx - size * 0.6 + i * 2, by + 1.5 + i * 1.6, cx + size * 0.7 - i * 2, by + 1.5 + i * 1.6)


# Grass tufts: sparse and small near the horizon, big in the foreground. Keep the path clear around the hikers.
for _ in range(420):
    t = rng.random() ** 0.6
    by = GROUND_Y + 8 + t * (H - GROUND_Y + 10)
    cx = rng.uniform(-10, W + 10)
    if HIKERS_X[0] - 70 < cx < HIKERS_X[1] + 70 and HIKERS_FOOT - 40 < by < HIKERS_FOOT + 25:
        continue
    tuft(cx, by, 5 + t * 34)

art = []


def hiker(x, y0, s, phase):
    """A hiker walking right: boots, legs, torso, backpack, hat and two trekking poles."""
    g = []
    sw = lambda v: f(v * s)  # noqa: E731
    P = lambda dx, dy: (x + dx * s, y0 + dy * s)  # noqa: E731

    hip = P(0, -40)
    shoulder = P(5, -67)
    stride = 13 if phase == 0 else 11
    back_foot, front_foot = P(-stride, 0), P(stride, 0)
    front_knee = P(stride * 0.55, -21)
    back_knee = P(-stride * 0.35, -20)

    def line(a, b, width, color=INK):
        g.append(f'<path d="M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}" stroke="{color}" stroke-width="{sw(width)}" stroke-linecap="round" fill="none"/>')

    def poly(points, color=INK, width=0):
        d = "M" + "L".join(f"{f(px)} {f(py)}" for px, py in points) + "Z"
        stroke = f' stroke="{color}" stroke-width="{sw(width)}" stroke-linejoin="round"' if width else ""
        g.append(f'<path d="{d}" fill="{color}"{stroke}/>')

    # Ground shadow.
    g.append(f'<ellipse cx="{f(x)}" cy="{f(y0 + 1.5 * s)}" rx="{sw(24)}" ry="{sw(2.4)}" fill="{INK}" opacity="0.55"/>')
    # Back pole and arm first, so the body covers them.
    back_hand = P(-7, -45)
    line(back_hand, P(-21, 1), 1.5)
    # Legs.
    line(hip, back_knee, 7.6)
    line(back_knee, back_foot, 6.6)
    line(hip, front_knee, 7.6)
    line(front_knee, front_foot, 6.6)
    # Boots.
    for fx, fy in (back_foot, front_foot):
        poly([(fx - 3 * s, fy - 3.2 * s), (fx + 6.5 * s, fy - 2.4 * s), (fx + 7 * s, fy + 0.6 * s), (fx - 3.4 * s, fy + 0.8 * s)], INK, 1)
    # Torso.
    line(hip, shoulder, 13)
    line(shoulder, back_hand, 5)
    # Backpack with a rolled mat on top.
    pack = [P(-17, -72), P(-4, -74), P(-1, -44), P(-15, -41)]
    poly(pack, INK, 2.2)
    g.append(f'<ellipse cx="{f(P(-10, -76)[0])}" cy="{f(P(-10, -76)[1])}" rx="{sw(8.2)}" ry="{sw(3.6)}" fill="{INK}"/>')
    # Engraving highlights on the pack and the mat.
    for i in range(5):
        a = P(-15 + i * 0.4, -66 + i * 4.6)
        b = P(-5.5 + i * 0.5, -67.5 + i * 4.6)
        line(a, b, 0.55, PAPER)
    line(P(-15.5, -76.3), P(-4.5, -76.3), 0.5, PAPER)
    line(P(-16, -50), P(-3, -51), 0.6, PAPER)  # hip strap
    # Head and wide brim hat.
    head = P(8.5, -77.5)
    g.append(f'<circle cx="{f(head[0])}" cy="{f(head[1])}" r="{sw(5.6)}" fill="{INK}"/>')
    brim = P(8.5, -82)
    g.append(f'<ellipse cx="{f(brim[0])}" cy="{f(brim[1])}" rx="{sw(9.5)}" ry="{sw(1.9)}" fill="{INK}"/>')
    crown = [P(3.5, -82), P(4.5, -88.5), P(12.5, -88.5), P(13.5, -82)]
    poly(crown, INK, 1)
    line(P(4.6, -83.6), P(12.4, -83.6), 0.6, PAPER)  # hat band
    # Front arm and pole.
    front_hand = P(17, -49)
    line(shoulder, P(13, -56), 5)
    line(P(13, -56), front_hand, 4.6)
    line(front_hand, P(26, 1), 1.5)
    g.append(f'<circle cx="{f(front_hand[0])}" cy="{f(front_hand[1])}" r="{sw(2.3)}" fill="{INK}"/>')
    # Highlights that separate overlapping limbs.
    line(P(1, -38), P(stride * 0.5 + 0.5, -22), 0.55, PAPER)
    line(P(4, -63), P(1.5, -44), 0.55, PAPER)
    art.append("".join(g))


hiker(HIKERS_X[0], HIKERS_FOOT - 2, 1.24, 1)
hiker(HIKERS_X[1], HIKERS_FOOT, 1.3, 0)

flush()
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">',
    "".join(out),
]
svg.extend(art)
svg.append("</svg>")

dest = Path(__file__).resolve().parent.parent / "public" / "images" / "footer-trail.svg"
dest.write_text("".join(svg))
print(dest, round(dest.stat().st_size / 1024), "KB")
