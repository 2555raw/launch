"""Hide the brand mark in the clouds: denser, brighter vapour where the tiers are, thinner sky in the gaps,
torn into wisps by warped fractal noise so it reads as a cloud formation, not a shape."""
import re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
CX, CY, W, STRENGTH = map(float, sys.argv[3:7])
SEED = int(sys.argv[7])
rng = np.random.default_rng(SEED)

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

# The mark comes in as a white on black mask image (any square size), placed at CX, CY and W pixels wide,
# squashed a touch and leaned with the wind like a real cloud bank.
MASK = sys.argv[8]
k = W / 514
mk = Image.open(MASK).convert("L").resize((int(W), int(W * 0.9)), Image.LANCZOS)
# Widen the slits between the four pieces so they survive as clear sky once the edges turn to vapour.
from PIL import ImageFilter
mk = mk.filter(ImageFilter.MinFilter(9)).rotate(-4, resample=Image.BICUBIC, expand=True)
m = Image.new("L", (W_, H_), 0)
m.paste(mk, (int(CX - mk.width / 2), int(CY - mk.height / 2)))
mask = np.asarray(m).astype(np.float32) / 255

# Wind: stretch and tear the shape sideways with large, soft warps, then let fine noise fray the edges.
wx = fractal([14, 40], [0.7, 1.0]) * 5 + 2.5 * np.sin(yy / 23.0)
wy = fractal([14, 40], [0.7, 1.0]) * 3
mask = nd.map_coordinates(mask, [yy + wy, xx + wx], order=1)
fray = fractal([2, 6, 16], [0.35, 0.7, 1.0])
mask = nd.gaussian_filter(mask, 3.0)
mask = smooth(0.05, 0.95, mask + 0.45 * fray * mask * (1 - mask) * 4)   # wispy, uneven edges
mask = nd.gaussian_filter(mask, 2.4)

# Density varies like real vapour: thick in places, almost gone in others, fading toward the outer tips.
density = smooth(-1.4, 1.2, fractal([5, 14, 40], [0.4, 0.7, 1.0]))
ends = np.exp(-(((xx - CX) / (W * 0.7)) ** 2))
amount = STRENGTH * mask * (0.5 + 0.5 * density) * (0.75 + 0.25 * ends)

# Cloud colour and texture come from the photo's own brightest cloud; gaps get a touch of the thinner, darker sky.
lum = img.mean(axis=2)
cloud_col = np.percentile(img.reshape(-1, 3)[lum.reshape(-1) > np.percentile(lum, 97)], 60, axis=0)
texture = (fractal([1.5, 4], [0.5, 1.0]) * 0.02)[..., None]
# Real clouds are lit from above: billows catch light on top and fall into grey shadow underneath,
# with big soft swirls of brighter and darker vapour across the whole formation.
soft = nd.gaussian_filter(mask, 9)
underside = np.clip(soft - nd.shift(soft, (-16, 0), order=1, mode="nearest"), 0, 1)
topside = np.clip(soft - nd.shift(soft, (16, 0), order=1, mode="nearest"), 0, 1)
swirl = fractal([8, 22, 60], [0.4, 0.7, 1.0])
shade = np.clip(0.9 + 0.08 * swirl - 0.55 * underside + 0.3 * topside, 0.7, 1.08)[..., None]
cloud = np.clip(cloud_col * shade + texture, 0, 1)
out = img + (cloud - img) * amount[..., None]

halo = np.clip(nd.gaussian_filter(nd.grey_dilation(mask, size=(int(18 * k) | 1,) * 2), 4) - mask, 0, 1)
out = out * (1 - (halo * STRENGTH * 0.06 * (0.5 + 0.5 * density))[..., None])

# A thin veil of mist over everything so the formation sits inside the cloud layer, not on top of it.
veil = smooth(-0.6, 1.4, fractal([10, 30], [0.6, 1.0])) * np.exp(-(((xx - CX) / (W * 0.8)) ** 2 + ((yy - CY) / (W * 0.45)) ** 2))
out = out + (cloud_col - out) * (veil * STRENGTH * 0.35)[..., None]

Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT, quality=94)
print("ok", cloud_col)
