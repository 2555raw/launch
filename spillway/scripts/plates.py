#!/usr/bin/env python3
"""Draw one plate per water source.

Real photographs of these places are licensed by other people and cannot be
fetched from this machine, so each site gets a drawing built from its own
figures instead: the class decides the scene, the fill level decides how much
water is in it, and the ticker seeds the terrain so no two look alike. Drop a
photograph in media/sources/ and it takes over from the drawing.
"""

import json, math, os, random, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "media", "plates")

W, H = 960, 600


def read_data():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    rows = []
    for m in re.finditer(r"\{\s*t:\s*\"(\w+)\".*?n:\s*\"([^\"]+)\".*?c:\s*\"([^\"]+)\"", src):
        rows.append({"t": m.group(1), "n": m.group(2), "c": m.group(3)})
    lvl = {}
    block = re.search(r"BASE_LEVEL\s*=\s*\{(.*?)\}", src, re.S).group(1)
    for m in re.finditer(r"(\w+):\s*([\d.]+)", block):
        lvl[m.group(1)] = float(m.group(2))
    for r in rows:
        r["lvl"] = lvl.get(r["t"], 0.5)
    return rows


def lerp(a, b, t):
    return a + (b - a) * t


def hsl(h, s, l, a=1.0):
    if a >= 1:
        return "hsl(%d %d%% %d%%)" % (h % 360, s, l)
    return "hsl(%d %d%% %d%% / %.2f)" % (h % 360, s, l, a)


def ridge(rng, y0, amp, n=9, x0=0, x1=W):
    """A jagged skyline as a path, closed to the bottom of the frame."""
    pts = []
    for i in range(n + 1):
        x = lerp(x0, x1, i / n)
        y = y0 + rng.uniform(-amp, amp) - (amp * 0.6 if i in (0, n) else 0)
        pts.append((x, y))
    d = "M%.0f %.0f" % (x0, H)
    for i, (x, y) in enumerate(pts):
        if i == 0:
            d += " L%.1f %.1f" % (x, y)
        else:
            px, py = pts[i - 1]
            d += " Q%.1f %.1f %.1f %.1f" % ((px + x) / 2, min(py, y) - amp * 0.25, x, y)
    d += " L%.0f %.0f Z" % (x1, H)
    return d


def sky(rng, top, bottom, sun=None):
    g = f'''<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>'''
    body = f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
    if sun:
        sx, sy, sr, col = sun
        g += f'''<radialGradient id="sun"><stop offset="0" stop-color="{col}" stop-opacity=".85"/>
          <stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>'''
        body += f'<circle cx="{sx}" cy="{sy}" r="{sr}" fill="url(#sun)"/>'
    return g, body


def clouds(rng, y, n, col):
    out = []
    for _ in range(n):
        cx, cy = rng.uniform(-40, W + 40), y + rng.uniform(-28, 28)
        w = rng.uniform(70, 190)
        out.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{w:.0f}" ry="{w*rng.uniform(.13,.22):.0f}" fill="{col}"/>')
    return "".join(out)


# ---------------------------------------------------------------- reservoir

def reservoir(rng, lvl):
    """Seen from below the dam: the lake above the crest, the wall across the
    canyon, the plunge pool at your feet."""
    hue = rng.randint(188, 206)
    defs, body = sky(rng, hsl(hue + 8, 56, 84), hsl(hue, 26, 96),
                     (rng.uniform(120, 840), rng.uniform(50, 120), 200, hsl(44, 96, 78)))
    body += clouds(rng, rng.uniform(80, 140), rng.randint(2, 4), "hsl(0 0% 100% / .5)")
    body += f'<path d="{ridge(rng, 236, 30, 8)}" fill="{hsl(hue + 12, 20, 62)}" opacity=".5"/>'
    body += f'<path d="{ridge(rng, 268, 22, 10)}" fill="{hsl(hue + 16, 18, 50)}" opacity=".6"/>'

    crest = lerp(330, 292, lvl)     # a full lake is held higher
    toe = 486

    # the lake, seen over the top of the wall
    defs += f'''<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{hsl(hue - 4, 46, 70)}"/><stop offset="1" stop-color="{hsl(hue + 4, 56, 48)}"/></linearGradient>'''
    lake_top = crest - lerp(16, 58, lvl)
    body += f'<path d="M40 {crest:.0f} L{W-40} {crest:.0f} L{W-150} {lake_top:.0f} L150 {lake_top:.0f} Z" fill="url(#lake)"/>'
    for i in range(6):
        y = lake_top + 4 + i * ((crest - lake_top) / 7)
        inset = lerp(150, 40, (y - lake_top) / max(1, crest - lake_top))
        body += f'<rect x="{inset + rng.uniform(10, 90):.0f}" y="{y:.0f}" width="{rng.uniform(40, 180):.0f}" height="1.6" fill="hsl(0 0% 100% / {rng.uniform(.14,.3):.2f})"/>'

    # the canyon the wall is wedged into
    lx, rx = rng.uniform(150, 210), rng.uniform(150, 210)
    rock, rock2 = hsl(26, 16, 46), hsl(26, 14, 36)
    body += f'<path d="M0 {crest-70:.0f} L{lx:.0f} {crest-10:.0f} L{lx*0.8:.0f} {H} L0 {H} Z" fill="{rock}"/>'
    body += f'<path d="M{W} {crest-80:.0f} L{W-rx:.0f} {crest-10:.0f} L{W-rx*0.8:.0f} {H} L{W} {H} Z" fill="{rock2}"/>'
    # the ring a drawn-down lake leaves on the rock it used to cover
    if lvl < 0.66:
        band = lerp(66, 8, lvl)
        body += f'<path d="M{lx*0.94:.0f} {crest-6:.0f} L{lx*0.86:.0f} {crest+band:.0f} L{lx*0.2:.0f} {H} L{lx*0.3:.0f} {crest+band*1.4:.0f} Z" fill="hsl(36 40% 78% / .5)"/>'
        body += f'<path d="M{W-rx*0.94:.0f} {crest-6:.0f} L{W-rx*0.86:.0f} {crest+band:.0f} L{W-rx*0.2:.0f} {H} L{W-rx*0.3:.0f} {crest+band*1.4:.0f} Z" fill="hsl(36 40% 78% / .45)"/>'

    # the wall itself, curved into the flow
    defs += '''<linearGradient id="wall" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="hsl(40 8% 70%)"/><stop offset=".38" stop-color="hsl(40 10% 93%)"/>
      <stop offset="1" stop-color="hsl(40 8% 66%)"/></linearGradient>'''
    l, r = lx - 14, W - rx + 14
    body += (f'<path d="M{l:.0f} {crest:.0f} Q{W/2:.0f} {crest+22:.0f} {r:.0f} {crest:.0f} '
             f'L{r-26:.0f} {toe:.0f} Q{W/2:.0f} {toe+30:.0f} {l+26:.0f} {toe:.0f} Z" fill="url(#wall)"/>')
    gates = rng.randint(6, 10)
    for i in range(1, gates):
        x0 = lerp(l, r, i / gates)
        x1 = lerp(l + 26, r - 26, i / gates)
        body += f'<line x1="{x0:.0f}" y1="{crest+8:.0f}" x2="{x1:.0f}" y2="{toe:.0f}" stroke="hsl(40 6% 58% / .38)" stroke-width="1.4"/>'
    # inspection galleries
    for k in (0.34, 0.62):
        y = lerp(crest, toe, k)
        body += f'<path d="M{lerp(l, l+26, k):.0f} {y:.0f} Q{W/2:.0f} {y+22:.0f} {lerp(r, r-26, k):.0f} {y:.0f}" stroke="hsl(40 6% 60% / .3)" stroke-width="2" fill="none"/>'
    # the crest road
    body += f'<path d="M{l-6:.0f} {crest:.0f} Q{W/2:.0f} {crest+22:.0f} {r+6:.0f} {crest:.0f} L{r+6:.0f} {crest-10:.0f} Q{W/2:.0f} {crest+12:.0f} {l-6:.0f} {crest-10:.0f} Z" fill="hsl(40 8% 97%)"/>'
    for i in range(1, 9):
        x = lerp(l, r, i / 9)
        body += f'<rect x="{x:.0f}" y="{crest - 22 + 16 * math.sin(math.pi * i / 9):.0f}" width="2" height="12" fill="hsl(40 6% 74%)"/>'

    # water leaving over the spillway, and the pool it lands in
    open_gates = max(1, round(lvl * 4))
    for g in range(open_gates):
        sx = lerp(l + 60, r - 100, (g + 0.5) / max(1, open_gates)) + rng.uniform(-14, 14)
        sw = rng.uniform(34, 52)
        body += (f'<path d="M{sx:.0f} {crest+6:.0f} q{sw*.18:.0f} {(toe-crest)*.5:.0f} {sw*.1:.0f} {toe-crest-6:.0f} '
                 f'l{sw:.0f} 0 q{sw*.12:.0f} {-(toe-crest)*.5:.0f} {-sw*.08:.0f} {-(toe-crest-6):.0f} Z" fill="hsl(190 34% 99% / .92)"/>')
        body += f'<ellipse cx="{sx+sw*.5:.0f}" cy="{toe+14:.0f}" rx="{sw*1.7:.0f}" ry="{rng.uniform(14,22):.0f}" fill="hsl(190 30% 100% / .7)"/>'
        for _ in range(rng.randint(4, 7)):
            body += f'<circle cx="{sx+rng.uniform(-sw, sw*2):.0f}" cy="{toe+rng.uniform(4, 40):.0f}" r="{rng.uniform(4,13):.0f}" fill="hsl(190 26% 100% / {rng.uniform(.25,.6):.2f})"/>'

    # the river below the toe
    defs += f'''<linearGradient id="riv" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{hsl(hue + 2, 40, 58)}"/><stop offset="1" stop-color="{hsl(hue + 8, 48, 36)}"/></linearGradient>'''
    body += f'<path d="M{lx*0.55:.0f} {H} L{l+30:.0f} {toe:.0f} L{r-30:.0f} {toe:.0f} L{W-rx*0.55:.0f} {H} Z" fill="url(#riv)"/>'
    for i in range(9):
        y = toe + 12 + i * 12
        if y > H: break
        k = (y - toe) / (H - toe)
        body += f'<rect x="{lerp(l+40, lx*0.6, k) + rng.uniform(0, 120):.0f}" y="{y:.0f}" width="{rng.uniform(30,150):.0f}" height="2" rx="1" fill="hsl(0 0% 100% / {rng.uniform(.1,.3):.2f})"/>'
    return defs, body


# ------------------------------------------------------------------ aquifer

def aquifer(rng, lvl):
    hue = rng.randint(28, 44)
    defs, body = sky(rng, hsl(200, 54, 88), hsl(196, 40, 96), None)
    body += clouds(rng, 90, rng.randint(2, 3), "hsl(0 0% 100% / .6)")
    # the surface: a worked plain with a windbreak
    ground = 190
    body += f'<rect x="0" y="{ground}" width="{W}" height="{H-ground}" fill="{hsl(hue+40, 26, 58)}"/>'
    for i in range(rng.randint(5, 9)):
        x = rng.uniform(20, W - 20)
        body += (f'<path d="M{x:.0f} {ground} l0 -34" stroke="hsl(120 22% 34%)" stroke-width="3"/>'
                 f'<ellipse cx="{x:.0f}" cy="{ground-42:.0f}" rx="{rng.uniform(12,22):.0f}" ry="{rng.uniform(14,24):.0f}" fill="hsl({rng.randint(96,132)} 26% 38%)"/>')
    # strata, each a different soil
    bands = [(58, hsl(hue, 30, 50)), (52, hsl(hue - 6, 26, 42)), (88, hsl(hue + 6, 20, 58)),
             (120, hsl(hue - 10, 18, 34)), (H, hsl(hue - 14, 16, 26))]
    y = ground + 26
    body += f'<rect x="0" y="{ground}" width="{W}" height="26" fill="{hsl(hue+20, 30, 34)}"/>'
    tops = []
    for h, col in bands:
        if y >= H: break
        hh = min(h, H - y)
        body += f'<rect x="0" y="{y:.0f}" width="{W}" height="{hh:.0f}" fill="{col}"/>'
        tops.append(y)
        y += hh
    # the saturated zone: gravel holding water, filled to the water table
    top, bot = tops[2], H
    wt = lerp(bot - 30, top + 8, lvl)
    defs += f'''<linearGradient id="sat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(192 64% 54% / .85)"/><stop offset="1" stop-color="hsl(200 70% 32% / .9)"/></linearGradient>'''
    body += f'<rect x="0" y="{wt:.0f}" width="{W}" height="{bot-wt:.0f}" fill="url(#sat)"/>'
    for _ in range(150):
        gx, gy = rng.uniform(0, W), rng.uniform(top + 6, H - 4)
        r = rng.uniform(2, 6)
        op = .22 if gy < wt else .3
        body += f'<circle cx="{gx:.0f}" cy="{gy:.0f}" r="{r:.1f}" fill="hsl(38 24% 88% / {op})"/>'
    # the water table, drawn as the measured line it is
    body += (f'<line x1="0" y1="{wt:.0f}" x2="{W}" y2="{wt:.0f}" stroke="hsl(190 80% 88%)" stroke-width="2.5" stroke-dasharray="14 8"/>')
    # a well down to it
    wx = rng.uniform(220, 700)
    body += (f'<rect x="{wx:.0f}" y="{ground-54:.0f}" width="16" height="{H-ground+54:.0f}" fill="hsl(28 8% 82%)"/>'
             f'<rect x="{wx+4:.0f}" y="{ground-50:.0f}" width="8" height="{H-ground+50:.0f}" fill="hsl(200 40% 24%)"/>'
             f'<rect x="{wx-14:.0f}" y="{ground-70:.0f}" width="44" height="22" rx="3" fill="hsl(28 10% 70%)"/>')
    return defs, body


# ------------------------------------------------------------------ glacier

def glacier(rng, lvl):
    """A tongue coming down between two peaks to a calving face."""
    defs, body = sky(rng, hsl(206, 68, 80), hsl(200, 40, 96), None)
    body += clouds(rng, 70, rng.randint(1, 3), "hsl(0 0% 100% / .45)")

    front = lerp(330, 430, lvl)   # a glacier in balance reaches further down
    # the valley walls the ice runs between
    body += f'<path d="M0 150 L300 {front+30:.0f} L0 {H} Z" fill="hsl(212 16% 52%)"/>'
    body += f'<path d="M{W} 130 L{W-320:.0f} {front+40:.0f} L{W} {H} Z" fill="hsl(212 14% 42%)"/>'
    body += f'<path d="M120 300 L250 150 L390 300 Z" fill="hsl(212 18% 62%)"/>'
    body += f'<path d="M250 150 L310 218 L250 246 L196 214 Z" fill="hsl(206 30% 94%)"/>'
    body += f'<path d="M{W-420:.0f} 290 L{W-300:.0f} 128 L{W-160:.0f} 290 Z" fill="hsl(212 16% 58%)"/>'
    body += f'<path d="M{W-300:.0f} 128 L{W-238:.0f} 200 L{W-300:.0f} 228 L{W-356:.0f} 196 Z" fill="hsl(206 30% 95%)"/>'

    # the ice, narrow at the head and spread at the front
    defs += '''<linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(198 40% 97%)"/><stop offset=".5" stop-color="hsl(194 66% 88%)"/>
      <stop offset="1" stop-color="hsl(197 72% 74%)"/></linearGradient>'''
    body += (f'<path d="M410 244 L{W-430:.0f} 244 Q{W-230:.0f} {front*.82:.0f} {W-60:.0f} {front:.0f} '
             f'L60 {front:.0f} Q230 {front*.82:.0f} 410 244 Z" fill="url(#ice)"/>')
    # crevasses, opening across the direction of flow
    for i in range(rng.randint(4, 6)):
        k = (i + 0.7) / 7
        y = lerp(280, front - 26, k)
        half = lerp(110, (W - 120) / 2, k) * 0.7
        cx = W / 2 + rng.uniform(-40, 40)
        body += (f'<path d="M{cx-half*.8:.0f} {y:.0f} Q{cx:.0f} {y+rng.uniform(10,22):.0f} {cx+half*.8:.0f} {y:.0f}" '
                 f'stroke="hsl(199 58% 60% / .42)" stroke-width="{rng.uniform(3,7):.1f}" fill="none" stroke-linecap="round"/>')
    # seracs on the calving face
    face_h = rng.uniform(40, 62)
    teeth = ""
    x = 60
    while x < W - 60:
        w = rng.uniform(26, 58)
        teeth += f'L{x:.0f} {front + rng.uniform(face_h*.55, face_h):.0f} L{x+w:.0f} {front + face_h*.92:.0f} '
        x += w
    body += f'<path d="M60 {front:.0f} {teeth} L{W-60:.0f} {front:.0f} Z" fill="hsl(196 62% 82%)"/>'
    body += f'<path d="M60 {front:.0f} {teeth} L{W-60:.0f} {front:.0f} Z" fill="hsl(200 70% 50% / .2)"/>'

    # the meltwater it calves into
    sea = front + face_h + 10
    defs += '''<linearGradient id="melt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(190 58% 62%)"/><stop offset="1" stop-color="hsl(200 66% 28%)"/></linearGradient>'''
    body += f'<rect x="0" y="{sea:.0f}" width="{W}" height="{H-sea:.0f}" fill="url(#melt)"/>'
    for _ in range(rng.randint(5, 9)):
        bx, by = rng.uniform(20, W - 60), rng.uniform(sea + 14, H - 20)
        s2 = rng.uniform(12, 34)
        body += (f'<path d="M{bx:.0f} {by:.0f} l{s2*.5:.0f} {-s2*.8:.0f} l{s2:.0f} {s2*.8:.0f} Z" fill="hsl(195 64% 94%)"/>'
                 f'<ellipse cx="{bx+s2*.75:.0f}" cy="{by+2:.0f}" rx="{s2:.0f}" ry="4" fill="hsl(194 60% 78% / .8)"/>')
    return defs, body


# ------------------------------------------------------------- desalination

def desal(rng, lvl):
    """A plant on the shore: sea behind it, membrane halls on the platform,
    intake and brine outfall running back out."""
    defs, body = sky(rng, hsl(204, 62, 82), hsl(34, 64, 95),
                     (rng.uniform(140, 820), rng.uniform(70, 130), 230, hsl(34, 96, 80)))
    horizon = 212
    defs += '''<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(200 46% 68%)"/><stop offset="1" stop-color="hsl(204 62% 40%)"/></linearGradient>'''
    body += f'<rect x="0" y="{horizon}" width="{W}" height="{H-horizon}" fill="url(#sea)"/>'
    for i in range(22):
        y = horizon + 6 + i * rng.uniform(8, 16)
        if y > H: break
        body += f'<rect x="{rng.uniform(0, W*.75):.0f}" y="{y:.0f}" width="{rng.uniform(40, 220):.0f}" height="2" rx="1" fill="hsl(0 0% 100% / {rng.uniform(.06,.22):.2f})"/>'

    shore = 470
    # the intake and the brine outfall run out to sea, away from the viewer
    body += (f'<path d="M200 {shore-14:.0f} L170 {horizon+96:.0f} L120 {horizon+44:.0f}" stroke="hsl(202 26% 84% / .75)" stroke-width="11" fill="none" stroke-linejoin="round"/>'
             f'<path d="M{W-330:.0f} {shore-14:.0f} L{W-290:.0f} {horizon+110:.0f} L{W-210:.0f} {horizon+52:.0f}" stroke="hsl(30 30% 84% / .7)" stroke-width="13" fill="none" stroke-linejoin="round"/>'
             f'<ellipse cx="{W-210:.0f}" cy="{horizon+52:.0f}" rx="34" ry="10" fill="hsl(28 40% 90% / .5)"/>')

    # the platform the plant stands on
    body += f'<path d="M0 {shore:.0f} L{W} {shore-8:.0f} L{W} {H} L0 {H} Z" fill="hsl(38 16% 80%)"/>'
    body += f'<rect x="0" y="{shore-10:.0f}" width="{W}" height="12" fill="hsl(38 14% 88%)"/>'
    for i in range(18):
        body += f'<circle cx="{rng.uniform(0,W):.0f}" cy="{rng.uniform(shore+16,H):.0f}" r="{rng.uniform(2,6):.1f}" fill="hsl(38 18% 70% / .45)"/>'
    for i in range(7):
        x = rng.uniform(40, W - 80)
        body += f'<rect x="{x:.0f}" y="{rng.uniform(shore+22, H-28):.0f}" width="{rng.uniform(30,70):.0f}" height="12" rx="3" fill="hsl(38 14% 72% / .55)"/>'

    # the membrane halls, sitting on the platform and rising into the sky
    trains = rng.randint(3, 5)
    for i in range(trains):
        x = lerp(90, W - 420, i / max(1, trains - 1)) + rng.uniform(-12, 12)
        w = rng.uniform(96, 130)
        h = rng.uniform(150, 230)
        top = shore - h
        body += (f'<rect x="{x:.0f}" y="{top:.0f}" width="{w:.0f}" height="{h:.0f}" rx="4" fill="hsl(200 14% 95%)" stroke="hsl(200 14% 72%)"/>'
                 f'<rect x="{x:.0f}" y="{top:.0f}" width="{w:.0f}" height="10" rx="3" fill="hsl(200 16% 84%)"/>')
        for k in range(int((h - 22) // 24)):
            body += f'<rect x="{x+10:.0f}" y="{shore-24-k*24:.0f}" width="{w-20:.0f}" height="13" rx="6.5" fill="hsl(200 18% 84%)" stroke="hsl(200 14% 74%)" stroke-width=".8"/>'
    # high pressure pipework tying the halls together
    body += f'<rect x="70" y="{shore-16:.0f}" width="{W-480:.0f}" height="7" rx="3.5" fill="hsl(200 18% 74%)"/>'

    # the product tank: how much of the intake leaves as drinking water
    tw, th = 120, 240
    tx, ty = W - 250, shore - th
    fill = lerp(0.18, 1.0, lvl)
    defs += f'<clipPath id="tk"><rect x="{tx}" y="{ty:.0f}" width="{tw}" height="{th}" rx="16"/></clipPath>'
    body += f'<rect x="{tx}" y="{ty:.0f}" width="{tw}" height="{th}" rx="16" fill="hsl(200 16% 96%)" stroke="hsl(200 14% 74%)"/>'
    body += f'<rect x="{tx}" y="{ty + th * (1 - fill):.0f}" width="{tw}" height="{th * fill:.0f}" fill="hsl(190 70% 62%)" clip-path="url(#tk)"/>'
    body += f'<rect x="{tx}" y="{ty + th * (1 - fill):.0f}" width="{tw}" height="3" fill="hsl(190 80% 86%)" clip-path="url(#tk)"/>'
    body += f'<rect x="{tx-8}" y="{ty-12:.0f}" width="{tw+16}" height="14" rx="5" fill="hsl(200 14% 86%)"/>'
    # a stack, because the plant runs on power
    body += (f'<rect x="{W-96}" y="{shore-250:.0f}" width="26" height="250" fill="hsl(200 12% 90%)"/>'
             f'<rect x="{W-96}" y="{shore-250:.0f}" width="26" height="16" fill="hsl(14 46% 64%)"/>')
    return defs, body


SCENES = {"Reservoir": reservoir, "Aquifer": aquifer, "Glacier": glacier, "Desalination": desal}


def plate(row):
    rng = random.Random(row["t"])
    defs, body = SCENES[row["c"]](rng, row["lvl"])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img" aria-label="{row["n"]}, drawn from its published figures">'
            f'<title>{row["n"]}</title><defs>{defs}</defs>{body}</svg>')


def main():
    rows = read_data()
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for r in rows:
        path = os.path.join(OUT, r["t"] + ".svg")
        open(path, "w", encoding="utf-8").write(plate(r))
        made[r["t"]] = "media/plates/%s.svg" % r["t"]
    js = ('/* Generated by scripts/plates.py. One drawing per source, built from its\n'
          ' * class and its fill level. A photograph in media/sources/ takes over.\n */\n\n'
          'const PLATES = %s;\n' % json.dumps(made, indent=2, sort_keys=True))
    open(os.path.join(ROOT, "plates.js"), "w", encoding="utf-8").write(js)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print("plates: %d, %.0f KB total, %.1f KB each" % (len(made), total / 1024, total / 1024 / len(made)))


if __name__ == "__main__":
    main()
