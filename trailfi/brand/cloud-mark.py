"""Hide the Stepit mark in the clouds: denser, brighter vapour where the tiers are, thinner sky in the gaps,
torn into wisps by warped fractal noise so it reads as a cloud formation, not a shape."""
import re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
CX, CY, W, STRENGTH = map(float, sys.argv[3:7])
SEED = int(sys.argv[7]) if len(sys.argv) > 7 else 5
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

P = "M108.0 6.0L177.5 42.1L177.5 84.7L108.0 47.4ZM284.0 6.0L214.5 42.1L214.5 84.7L284.0 47.4ZM59.0 69.0L177.5 127.1L177.5 169.7L59.0 110.4ZM333.0 69.0L214.5 127.1L214.5 169.7L333.0 110.4ZM6.0 132.0L177.5 214.0L177.5 256.6L6.0 173.4ZM386.0 132.0L214.5 214.0L214.5 256.6L386.0 173.4Z"
k = W / 392
tilt = np.deg2rad(4)  # clouds drift with the wind, a slight lean
def place(x, y):
    u, v = (x - 196) * k, (y - 131.5) * k * 0.9
    return CX + u * np.cos(tilt) - v * np.sin(tilt), CY + u * np.sin(tilt) + v * np.cos(tilt)
m = Image.new("L", (W_, H_), 0)
d = ImageDraw.Draw(m)
for poly in re.findall(r"M([^Z]+)Z", P):
    pts = [tuple(map(float, p.split())) for p in poly.replace("L", " L ").split(" L ")]
    d.polygon([place(x, y) for x, y in pts], fill=255)
mask = np.asarray(m).astype(np.float32) / 255

# Wind: stretch and tear the shape sideways with large, soft warps, then let fine noise fray the edges.
wx = fractal([14, 40], [0.7, 1.0]) * 15 + 7 * np.sin(yy / 19.0)
wy = fractal([14, 40], [0.7, 1.0]) * 7
mask = nd.map_coordinates(mask, [yy + wy, xx + wx], order=1)
fray = fractal([2, 6, 16], [0.35, 0.7, 1.0])
mask = nd.gaussian_filter(mask, 5.5)
mask = smooth(0.05, 0.95, mask + 0.45 * fray * mask * (1 - mask) * 4)   # wispy, uneven edges
mask = nd.gaussian_filter(mask, 3)

# Density varies like real vapour: thick in places, almost gone in others, fading toward the outer tips.
density = smooth(-1.4, 1.2, fractal([5, 14, 40], [0.4, 0.7, 1.0]))
ends = np.exp(-(((xx - CX) / (W * 0.7)) ** 2))
amount = STRENGTH * mask * (0.35 + 0.65 * density) * (0.6 + 0.4 * ends)

# Cloud colour and texture come from the photo's own brightest cloud; gaps get a touch of the thinner, darker sky.
lum = img.mean(axis=2)
cloud_col = np.percentile(img.reshape(-1, 3)[lum.reshape(-1) > np.percentile(lum, 97)], 60, axis=0)
texture = (fractal([1.5, 4], [0.5, 1.0]) * 0.02)[..., None]
cloud = np.clip(cloud_col + texture, 0, 1)
out = img + (cloud - img) * amount[..., None]

halo = np.clip(nd.gaussian_filter(nd.grey_dilation(mask, size=(int(18 * k) | 1,) * 2), 4) - mask, 0, 1)
out = out * (1 - (halo * STRENGTH * 0.06 * (0.5 + 0.5 * density))[..., None])

# A thin veil of mist over everything so the formation sits inside the cloud layer, not on top of it.
veil = smooth(-0.6, 1.4, fractal([10, 30], [0.6, 1.0])) * np.exp(-(((xx - CX) / (W * 0.8)) ** 2 + ((yy - CY) / (W * 0.45)) ** 2))
out = out + (cloud_col - out) * (veil * STRENGTH * 0.35)[..., None]

Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT, quality=94)
print("ok", cloud_col)
