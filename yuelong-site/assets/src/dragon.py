"""Generates the Dragon Gate illustration's gate (a Chinese paifang) and dragon as SVG.

The dragon follows a smooth spine through a few control points: its body is a filled
outline offset along the normals, with scales, a belly line and dorsal spines placed along
it, and a head drawn in local coordinates and turned to the spine's final direction.
A mask path along the same spine lets the page draw the dragon in from tail to head.

    python3 assets/src/dragon.py            prints the SVG fragment for index.html
    python3 assets/src/dragon.py --preview  writes dragon-preview.svg next to this file
"""
import math, sys, os

BEIGE, LIGHT, DEEP, INK = '#D9C3A0', '#EFE3CD', '#A48B67', '#0B0B0B'

# --- spine -------------------------------------------------------------------------------
CTRL = [(300, 178), (270, 152), (252, 120), (262, 90), (294, 78), (326, 92), (350, 88), (376, 60),
        (410, 44), (440, 50)]


def catmull(pts, n=40):
    out = []
    p = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1])
    return out


S = catmull(CTRL)
L = [0.0]
for a, b in zip(S, S[1:]):
    L.append(L[-1] + math.dist(a, b))
TOTAL = L[-1]


def width(u):                       # u in 0..1 along the body: thin tail, full middle, neck
    if u < 0.62:
        return 1.2 + 11.5 * math.sin(math.pi / 2 * (u / 0.62)) ** 0.9
    return 12.7 - 5.2 * ((u - 0.62) / 0.38) ** 1.3


def normal(i):
    a, b = S[max(0, i - 1)], S[min(len(S) - 1, i + 1)]
    dx, dy = b[0] - a[0], b[1] - a[1]
    m = math.hypot(dx, dy) or 1
    return -dy / m, dx / m


def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def path(points, close=False):
    d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in points)
    return d + (' Z' if close else '')


left, right = [], []
for i, (x, y) in enumerate(S):
    nx, ny = normal(i)
    w = width(L[i] / TOTAL)
    left.append((x + nx * w, y + ny * w))
    right.append((x - nx * w, y - ny * w))
body = path(left + right[::-1], close=True)
belly = path([(x - nx * width(L[i] / TOTAL) * 0.55, y - ny * width(L[i] / TOTAL) * 0.55)
              for i, (x, y) in enumerate(S) for nx, ny in [normal(i)]][6:-4])

# scales: small arcs across the back, every few pixels along the spine
scales = []
step, next_at = 6.5, 14
for i, (x, y) in enumerate(S):
    if L[i] < next_at or L[i] > TOTAL - 10:
        continue
    next_at += step
    u = L[i] / TOTAL
    w = width(u) * 0.62
    nx, ny = normal(i)
    tx, ty = ny, -nx                    # tangent, pointing back toward the tail
    a = (x + nx * w, y + ny * w)
    c = (x + tx * -w * 0.9, y + ty * -w * 0.9)
    b = (x - nx * w * 0.2, y - ny * w * 0.2)
    scales.append(f'M{fmt(a[0])} {fmt(a[1])} Q{fmt(c[0])} {fmt(c[1])} {fmt(b[0])} {fmt(b[1])}')

# dorsal spines along the outer edge
spines = []
next_at = 20
for i, (x, y) in enumerate(S):
    if L[i] < next_at or L[i] > TOTAL - 16:
        continue
    next_at += 11
    u = L[i] / TOTAL
    w = width(u)
    nx, ny = normal(i)
    j = min(len(S) - 1, i + 3)
    bx, by = S[j]
    h = 3 + w * 0.55
    base1 = (x + nx * w, y + ny * w)
    base2 = (bx + normal(j)[0] * width(L[j] / TOTAL), by + normal(j)[1] * width(L[j] / TOTAL))
    tip = ((x + bx) / 2 + nx * (w + h) + (x - bx) * 0.6, (y + by) / 2 + ny * (w + h) + (y - by) * 0.6)
    spines.append(path([base1, tip, base2], close=True))

# a pair of small clawed legs
def leg(u, side, length=18):
    i = min(range(len(S)), key=lambda k: abs(L[k] / TOTAL - u))
    x, y = S[i]; nx, ny = normal(i)
    w = width(u)
    sx, sy = x - nx * w * side, y - ny * w * side
    ex, ey = sx - nx * length * side + (S[i - 4][0] - x) * 0.6, sy - ny * length * side + (S[i - 4][1] - y) * 0.6
    claws = ' '.join(f'M{fmt(ex)} {fmt(ey)} l{fmt(dx)} {fmt(dy)}' for dx, dy in
                     [(-nx * 5 * side - 3, -ny * 5 * side), (-nx * 6 * side, -ny * 6 * side + 2), (-nx * 5 * side + 3, -ny * 5 * side + 3)])
    return f'M{fmt(sx)} {fmt(sy)} Q{fmt((sx + ex) / 2 - nx * 4 * side)} {fmt((sy + ey) / 2 - ny * 4 * side)} {fmt(ex)} {fmt(ey)}', claws


legs = []

# --- head, drawn pointing along +x, then rotated to the spine's last direction ----------
HEAD = {
    'jaw': 'M-2 -8 C6 -13 18 -12 26 -8 C31 -6 36 -5 40 -3 C42 -1 41 2 38 3 L26 4 L34 9 C30 12 20 12 10 10 C3 9 -3 5 -4 0 Z',
    'mouth': 'M26 4 L16 5',
    'horns': 'M4 -10 C-4 -20 -14 -24 -26 -22 M10 -11 C4 -22 -4 -30 -16 -32',
    'mane': 'M0 -6 C-8 -12 -14 -12 -22 -16 M-1 -2 C-10 -4 -16 -2 -26 -4 M0 3 C-8 5 -14 8 -22 12',
    'whiskers': 'M38 1 C48 8 44 20 58 26 M36 -3 C48 -10 50 -22 64 -24',
    'brow': 'M12 -9 L20 -8',
}
EYE = (17, -5)
ex, ey = S[-1]
bx, by = S[-8]
ang = math.degrees(math.atan2(ey - by, ex - bx))
head_tf = f'translate({fmt(ex)} {fmt(ey)}) rotate({fmt(ang)}) scale(1.25)'

# reveal mask path: the spine itself, tail to head
spine_d = path(S)

# --- clouds (xiangyun): scrolled curls, drawn as strokes ------------------------------
def cloud(cx, cy, s):
    return (f'M{fmt(cx - 34 * s)} {fmt(cy)} H{fmt(cx + 30 * s)} '
            f'M{fmt(cx - 22 * s)} {fmt(cy)} a{fmt(9 * s)} {fmt(9 * s)} 0 1 1 {fmt(12 * s)} {fmt(-10 * s)} '
            f'a{fmt(11 * s)} {fmt(11 * s)} 0 1 1 {fmt(20 * s)} {fmt(4 * s)} a{fmt(7 * s)} {fmt(7 * s)} 0 1 1 {fmt(6 * s)} {fmt(10 * s)} '
            f'M{fmt(cx - 10 * s)} {fmt(cy - 10 * s)} a{fmt(4 * s)} {fmt(4 * s)} 0 1 0 {fmt(5 * s)} {fmt(-5 * s)}')


CLOUDS = [cloud(186, 96, 1.0), cloud(456, 112, 0.85), cloud(330, 28, 0.6)]

# --- the paifang -------------------------------------------------------------------------
def roof(cx, y, half, depth, lift):
    """a hipped roof with upturned eaves: top ridge at y, eaves at y+depth"""
    l, r = cx - half, cx + half
    return (f'M{fmt(l - lift * 1.6)} {fmt(y + depth - lift)} '
            f'Q{fmt(l + half * 0.12)} {fmt(y + depth)} {fmt(l + half * 0.22)} {fmt(y + depth * 0.35)} '
            f'L{fmt(r - half * 0.22)} {fmt(y + depth * 0.35)} '
            f'Q{fmt(r - half * 0.12)} {fmt(y + depth)} {fmt(r + lift * 1.6)} {fmt(y + depth - lift)} '
            f'L{fmt(r - half * 0.05)} {fmt(y + depth + 5)} L{fmt(l + half * 0.05)} {fmt(y + depth + 5)} Z')


def tiles(cx, y, half, depth):
    xs = [cx - half * 0.72 + k * (half * 1.44 / 12) for k in range(13)]
    return ' '.join(f'M{fmt(x)} {fmt(y + depth * 0.45)} L{fmt(x)} {fmt(y + depth + 3)}' for x in xs)


GATE = f'''<g class="dn-paifang">
              <!-- side bays -->
              <rect x="172" y="184" width="9" height="66" fill="{DEEP}"/>
              <rect x="379" y="184" width="9" height="66" fill="{DEEP}"/>
              <rect x="176" y="196" width="40" height="7" fill="{DEEP}"/>
              <rect x="344" y="196" width="40" height="7" fill="{DEEP}"/>
              <path d="{roof(196, 168, 30, 16, 5)}" fill="{BEIGE}"/>
              <path d="{roof(364, 168, 30, 16, 5)}" fill="{BEIGE}"/>
              <!-- main bay -->
              <rect x="212" y="150" width="12" height="100" fill="{BEIGE}"/>
              <rect x="336" y="150" width="12" height="100" fill="{BEIGE}"/>
              <rect x="206" y="160" width="148" height="9" rx="2" fill="{BEIGE}"/>
              <rect x="214" y="206" width="132" height="6" rx="2" fill="{DEEP}"/>
              <rect x="256" y="172" width="48" height="28" rx="2" fill="{INK}" stroke="{BEIGE}" stroke-width="2"/>
              <path d="M280 178l8 8-8 8-8-8z" fill="{BEIGE}"/>
              <path d="{roof(280, 116, 78, 30, 9)}" fill="{BEIGE}"/>
              <path d="{tiles(280, 116, 78, 30)}" stroke="{DEEP}" stroke-width="1.4" opacity=".7"/>
              <path d="M242 127 H318" stroke="{BEIGE}" stroke-width="5" stroke-linecap="round"/>
              <path d="M238 127 q-6 -8 -2 -14 M322 127 q6 -8 2 -14" stroke="{BEIGE}" stroke-width="3" stroke-linecap="round" fill="none"/>
              <circle cx="280" cy="121" r="4" fill="{BEIGE}"/>
            </g>'''

DRAGON = f'''<g class="dn-dragon">
              <defs>
                <linearGradient id="gScale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LIGHT}"/><stop offset="1" stop-color="{BEIGE}"/></linearGradient>
                <mask id="dnReveal" maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="520">
                  <path class="dn-dragon-reveal" pathLength="1" d="{spine_d}" fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
                </mask>
              </defs>
              <g class="dn-clouds" stroke="{BEIGE}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".55">
                {''.join(f'<path d="{c}"/>' for c in CLOUDS)}
              </g>
              <g mask="url(#dnReveal)">
                <g stroke="{BEIGE}" stroke-width="3" stroke-linecap="round" fill="none">
                  {''.join(f'<path d="{a}"/><path d="{b}" stroke-width="2"/>' for a, b in legs)}
                </g>
                <g fill="{DEEP}">{''.join(f'<path d="{d}"/>' for d in spines)}</g>
                <path d="{body}" fill="url(#gScale)"/>
                <path d="{belly}" stroke="{LIGHT}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9"/>
                <path d="{' '.join(scales)}" stroke="{DEEP}" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".75"/>
              </g>
              <g transform="{head_tf}"><g class="dn-dragon-head">
                <path d="{HEAD['mane']}" stroke="{DEEP}" stroke-width="3" stroke-linecap="round" fill="none"/>
                <path d="{HEAD['horns']}" stroke="{BEIGE}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
                <path d="{HEAD['jaw']}" fill="url(#gScale)"/>
                <path d="{HEAD['mouth']} {HEAD['brow']}" stroke="{DEEP}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
                <circle cx="{EYE[0]}" cy="{EYE[1]}" r="2.6" fill="{INK}"/>
                <circle cx="{EYE[0] + 0.8}" cy="{EYE[1] - 0.8}" r=".8" fill="{LIGHT}"/>
                <path d="{HEAD['whiskers']}" stroke="{LIGHT}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
              </g></g>
            </g>'''

if __name__ == '__main__':
    frag = ('<circle class="dn-gate-glow" cx="280" cy="150" r="140" fill="url(#gGlow)"/>\n\n            '
            + '<!-- the dragon, drawn in from behind the gate when the carp clears it -->\n            ' + DRAGON
            + '\n\n            <!-- the gate on the cliff top: a three-bay paifang -->\n            ' + GATE)
    if '--preview' in sys.argv:
        here = os.path.dirname(os.path.abspath(__file__))
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 520" width="1120" height="1040">'
               f'<defs><radialGradient id="gGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#EFE3CD" stop-opacity=".45"/>'
               f'<stop offset="1" stop-color="#EFE3CD" stop-opacity="0"/></radialGradient></defs>'
               f'<rect width="560" height="520" fill="#141210"/><rect x="210" y="246" width="140" height="210" fill="#1E262F"/>{frag}</svg>')
        open(os.path.join(here, 'dragon-preview.svg'), 'w').write(svg)
    else:
        print(frag)
