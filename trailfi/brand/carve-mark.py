"""Hide the Stepit mark in the mountain photo as exposed rock, shadowed ledges and snow, half lost in fog.

Works only on the photo's own pixels: the mark darkens snow towards the rock colour already in the scene,
with patchy, eroded strength, snow caught on the upper lips of each ledge, and mist drifting over the top tier.
"""
import re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
CX, CY, W = map(float, sys.argv[3:6])
STRENGTH = float(sys.argv[6]) if len(sys.argv) > 6 else 0.4
MIST = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5
DUST = float(sys.argv[10]) if len(sys.argv) > 10 else 0.75
rng = np.random.default_rng(11)

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32) / 255
H_, W_ = img.shape[:2]
yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)

def fractal(scales, amps):
    out = np.zeros((H_, W_), np.float32)
    for s, a in zip(scales, amps):
        n = nd.gaussian_filter(rng.standard_normal((H_, W_)).astype(np.float32), s)
        out += a * n / (n.std() + 1e-6)
    return out

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

# The mark, drawn with a little perspective: the face leans back, so upper tiers are narrower and squashed,
# and the whole shape tilts with the slope.
P = "M108.0 6.0L177.5 42.1L177.5 84.7L108.0 47.4ZM284.0 6.0L214.5 42.1L214.5 84.7L284.0 47.4ZM59.0 69.0L177.5 127.1L177.5 169.7L59.0 110.4ZM333.0 69.0L214.5 127.1L214.5 169.7L333.0 110.4ZM6.0 132.0L177.5 214.0L177.5 256.6L6.0 173.4ZM386.0 132.0L214.5 214.0L214.5 256.6L386.0 173.4Z"
k = W / 392
tilt = np.deg2rad(-6)
def place(x, y):
    u, v = x - 196, y - 131.5
    depth = 1 - 0.18 * (1 - y / 263)          # upper tiers further away
    u, v = u * depth, v * 0.86
    ru = u * np.cos(tilt) - v * np.sin(tilt)
    rv = u * np.sin(tilt) + v * np.cos(tilt)
    return CX + ru * k, CY + rv * k
m = Image.new("L", (W_, H_), 0)
d = ImageDraw.Draw(m)
for poly in re.findall(r"M([^Z]+)Z", P):
    pts = [tuple(map(float, p.split())) for p in poly.replace("L", " L ").split(" L ")]
    d.polygon([place(x, y) for x, y in pts], fill=255)
mask = np.asarray(m).astype(np.float32) / 255
mask = nd.grey_dilation(mask, size=(max(1, int(10 * k)),) * 2)

# Edges follow the terrain: warp by the photo's own structure plus fine noise, then erode irregularly.
lum = img.mean(axis=2)
slum = nd.gaussian_filter(lum, 3)
gy, gx = np.gradient(slum)
warp = 22.0
dx = gx * warp + fractal([2, 7], [0.7, 1.6])
dy = gy * warp + fractal([2, 7], [0.7, 1.6])
mask = nd.map_coordinates(mask, [yy + dy, xx + dx], order=1)
mask = nd.gaussian_filter(mask, 1.2)
erosion = fractal([1.5, 5, 14], [0.4, 0.8, 1.0])
mask = mask * smooth(-2.4, -0.6, erosion)          # bites taken out of the shape

# Strength varies: strongest where there is snow to expose rock through, patchy everywhere,
# fading out upwards into the fog and at the outer ends of each tier.
snowiness = smooth(0.35, 0.75, nd.gaussian_filter(lum, 2))
patch = smooth(-1.2, 1.2, fractal([3, 10, 30], [0.4, 0.7, 1.0]))
top = CY - 131.5 * k * 0.86
fog_fade = smooth(top - 0.02 * W, top + 0.38 * W, yy)
ends = np.exp(-(((xx - CX) / (W * 0.62)) ** 2))
strength = STRENGTH * mask * (0.55 + 0.45 * snowiness) * (0.7 + 0.3 * patch) * (0.25 + 0.75 * fog_fade) * (0.55 + 0.45 * ends)

# The mark reads as terrain: each tier is a snow-loaded ledge, and the gaps between them are dark rock crevices
# in shadow. Crevices = a thin band just outside the ledges; ledges = the mark itself.
rock_ref = nd.gaussian_filter(img, (25, 25, 0))
detail = (lum - nd.gaussian_filter(lum, 3))[..., None]
# Real rock texture borrowed from the dark cliff band below the slope, so crevices carry the photo's own rock and grain.
ROCK_DY = float(sys.argv[8]) if len(sys.argv) > 8 else 160
borrowed = np.stack([nd.map_coordinates(img[..., c], [np.clip(yy + ROCK_DY, 0, H_ - 1), xx], order=1) for c in range(3)], -1)
rock = np.clip(np.minimum(np.minimum(img, borrowed * 0.85 + 0.01), rock_ref * 0.42 + borrowed * 0.12) + detail * 0.9, 0, 1)
snow = np.clip(img + (0.9 - img) * 0.5 + detail * 1.2, 0, 1)
wide = nd.grey_dilation(mask, size=(int(16 * k) | 1,) * 2)
thin = nd.grey_dilation(mask, size=(int(7 * k) | 1,) * 2)
width_noise = smooth(-0.8, 0.8, fractal([4, 12], [0.6, 1.0]))      # crevices widen and narrow
ring = np.clip(thin + (wide - thin) * width_noise - mask, 0, 1)
ring = nd.gaussian_filter(ring, 0.6) * smooth(-2.2, -0.6, fractal([1.5, 6], [0.6, 1.0]))  # broken here and there
s_ring = strength_base = STRENGTH * ring * (0.55 + 0.45 * snowiness) * (0.6 + 0.4 * patch) * (0.2 + 0.8 * fog_fade) * (0.55 + 0.45 * ends)
BARS = len(sys.argv) > 9 and sys.argv[9] == 'bars'
TERRACE = len(sys.argv) > 9 and sys.argv[9] == 'terrace'
if TERRACE:
    # Tiers become bands of bare rock, gaps fill with snow: a contrast structure strong enough to read over busy terrain,
    # blended partially so the photo's own texture and grain stay on top.
    shape_fade = (0.25 + 0.75 * fog_fade) * (0.55 + 0.45 * ends) * (0.75 + 0.25 * patch)
    dust = smooth(-0.3, 0.9, fractal([1.2, 3, 8], [0.5, 0.8, 0.6]) + (detail[..., 0] * 6))
    a_bar = STRENGTH * mask * shape_fade * (1 - DUST * dust)
    a_gap = STRENGTH * ring * shape_fade * 0.9
    out = img + (rock - img) * a_bar[..., None]
    out = out + (snow - out) * a_gap[..., None]
elif BARS:
    # Each tier is an outcrop of bare rock with snow dusted across it in streaks, like the bands on the face above.
    dust = smooth(-0.3, 0.9, fractal([1.2, 3, 8], [0.5, 0.8, 0.6]) + (detail[..., 0] * 6))
    s_bar = strength * (1 - DUST * dust)
    out = img + (rock - img) * s_bar[..., None]
    out = out + (snow - out) * (s_ring * 0.5)[..., None]  # snow drifted into the gaps between tiers
else:
    out = img + (rock - img) * s_ring[..., None]
    out = out + (snow - out) * (strength * 0.45)[..., None]

# Snow caught on the upper lip of each ledge, and a soft shadow under it, lit from the upper left like the photo.
soft = nd.gaussian_filter(mask, 2.5)
sgy, sgx = np.gradient(soft)
lip = np.clip(sgy * 0.9 + sgx * 0.35, 0, None)
under = np.clip(-sgy * 0.9 - sgx * 0.35, 0, None)
lip /= lip.max() + 1e-6
under /= under.max() + 1e-6
fade3 = (fog_fade * (0.5 + 0.5 * patch))[..., None]
out = out + (np.array([0.9, 0.92, 0.93]) - out) * (lip[..., None] * 0.4 * STRENGTH * fade3)
out = out * (1 - under[..., None] * 0.3 * STRENGTH * fade3)

# Mist drifting across the upper tier, from the photo's own cloud colour.
cloud = fractal([5, 16, 45], [0.3, 0.6, 1.0])
cloud = smooth(-0.3, 1.4, cloud)
mist_band = np.exp(-(((xx - CX) / (W * 0.9)) ** 2 + ((yy - (top + 0.06 * W)) / (W * 0.2)) ** 2))
mist_a = (cloud * mist_band * MIST)[..., None]
mist_col = np.array([0.80, 0.82, 0.83], np.float32)
out = out * (1 - mist_a) + mist_col * mist_a

Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT, quality=94)
np.save(OUT + ".strength.npy", strength); np.save(OUT + ".mask.npy", mask)
print("ok", float(strength.max()), float(mask.max()))
