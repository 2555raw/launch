"""The profile picture: the mark glowing in electric blue inside dark storm clouds, filled with the clouds' own
texture and with frayed, vapour like edges, the same treatment the Stepit picture had."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, MASK, OUT = sys.argv[1:4]
SIZE = 1254
rng = np.random.default_rng(7)
bg = np.asarray(Image.open(SRC).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32) / 255
H, W = bg.shape[:2]

def fractal(scales, amps):
    out = np.zeros((H, W), np.float32)
    for s, a in zip(scales, amps):
        n = nd.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), s)
        out += a * n / (n.std() + 1e-6)
    return out

# Moody, cool sky: darker and slightly blue.
lum = bg @ np.array([0.299, 0.587, 0.114], np.float32)
sky = np.clip(lum[..., None] * np.array([0.78, 0.86, 1.0]) * 0.72, 0, 1)

# The mark, about half the picture, with frayed edges.
mw = int(SIZE * 0.5)
mk = np.asarray(Image.open(MASK).convert("L").resize((mw, mw), Image.LANCZOS)).astype(np.float32) / 255
mask = np.zeros((H, W), np.float32)
o = (SIZE - mw) // 2
mask[o:o + mw, o:o + mw] = mk
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
wx, wy = fractal([6, 18], [0.6, 1.0]) * 3, fractal([6, 18], [0.6, 1.0]) * 3
mask = nd.map_coordinates(mask, [yy + wy, xx + wx], order=1)
fray = fractal([1.5, 4, 10], [0.4, 0.7, 1.0])
mask = nd.gaussian_filter(mask, 2.2)
mask = np.clip((mask - 0.5) * 1.6 + 0.5 + 0.18 * fray * (mask * (1 - mask) * 4), 0, 1)
mask = nd.gaussian_filter(mask, 1.2)

# Fill: electric blue lit by the cloud texture underneath, brighter in the thick parts.
tex = np.clip(lum / max(lum[mask > 0.5].mean(), 1e-3), 0.55, 1.6)[..., None]
light, deep = np.array([0.61, 0.76, 1.0]), np.array([0.18, 0.48, 1.0])
t = np.clip((tex - 0.55) / 1.05, 0, 1)
fill = np.clip(deep + (light - deep) * t, 0, 1) * np.clip(0.7 + 0.35 * tex, 0, 1.25)

# Glow: a soft blue light spilling into the clouds around the mark.
glow = nd.gaussian_filter(mask, 26) * 0.55 + nd.gaussian_filter(mask, 70) * 0.35
out = sky + np.array([0.18, 0.48, 1.0]) * glow[..., None] * 0.9
out = out + (fill - out) * mask[..., None]
img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
img.resize((800, 800), Image.LANCZOS).save(OUT)
print("ok")
