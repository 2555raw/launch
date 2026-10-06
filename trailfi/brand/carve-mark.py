"""Carve the Stepit mark into the mountain face of the hero photo, half hidden by cloud."""
import re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
CX, CY, W = float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])  # mark centre and width, in source pixels
rng = np.random.default_rng(7)

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32) / 255
H_, W_ = img.shape[:2]

# 1. The mark as a soft mask (rounded like the real logo).
P = "M108.0 6.0L177.5 42.1L177.5 84.7L108.0 47.4ZM284.0 6.0L214.5 42.1L214.5 84.7L284.0 47.4ZM59.0 69.0L177.5 127.1L177.5 169.7L59.0 110.4ZM333.0 69.0L214.5 127.1L214.5 169.7L333.0 110.4ZM6.0 132.0L177.5 214.0L177.5 256.6L6.0 173.4ZM386.0 132.0L214.5 214.0L214.5 256.6L386.0 173.4Z"
k = W / 392
ox, oy = CX - 196 * k, CY - 131.5 * k
SS = 4
m = Image.new("L", (W_ * SS // 4, H_ * SS // 4), 0)  # same size, drawn directly
m = Image.new("L", (W_, H_), 0)
d = ImageDraw.Draw(m)
for poly in re.findall(r"M([^Z]+)Z", P):
    pts = [tuple(map(float, p.split())) for p in poly.replace("L", " L ").split(" L ")]
    d.polygon([(ox + x * k, oy + y * k) for x, y in pts], fill=255)
mask = np.asarray(m).astype(np.float32) / 255
mask = nd.grey_dilation(mask, size=(max(1, int(12 * k)),) * 2)  # rounded corners like the stroke

# 2. Rough, rocky edges: displace the mask with fractal noise.
def fractal(shape, scales, amps):
    out = np.zeros(shape, np.float32)
    for s, a in zip(scales, amps):
        n = rng.standard_normal(shape).astype(np.float32)
        n = nd.gaussian_filter(n, s)
        n /= n.std() + 1e-6
        out += a * n
    return out
yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
dx = fractal((H_, W_), [3, 9], [0.6, 1.2])
dy = fractal((H_, W_), [3, 9], [0.6, 1.2])
mask = nd.map_coordinates(mask, [yy + dy, xx + dx], order=1)
mask = nd.gaussian_filter(mask, 1.1)

# 3. Carve: inside the mark the rock catches snow (brighter, keeps the photo's texture),
#    and the edges get light from the upper left and shade on the lower right.
lum = img.mean(axis=2, keepdims=True)
detail = lum - nd.gaussian_filter(lum, (4, 4, 0))
MODE = sys.argv[6] if len(sys.argv) > 6 else 'snow'
if MODE == 'none':
    snow = img
elif MODE == 'rock':  # bare dark rock showing through the snow
    snow = np.clip(img * 0.32 + 0.03 + detail * 2.0, 0, 1)
else:
    snow = np.clip(img + (0.84 - img) * 0.55 + detail * 2.4, 0, 1)
patchy = np.clip(0.78 + 0.22 * fractal((H_, W_), [2, 6], [0.5, 1.0]) / 1.5, 0.45, 1)
a = (mask * patchy)[..., None]
out = img * (1 - a * 0.85) + snow * a * 0.85
soft = nd.gaussian_filter(mask, 2.2)
gy, gx = np.gradient(soft)
light = -(gx * -0.6 + gy * -0.8)  # light from the upper left
light = light / (np.abs(light).max() + 1e-6)
if MODE == 'rock': light = -light * 0.6
out = np.clip(out + light[..., None] * 0.22, 0, 1)

# 4. Clouds drifting across the top of the mark: fractal noise, densest over the upper bars.
top = oy
cloud = fractal((H_, W_), [6, 18, 48], [0.25, 0.5, 1.0])
cloud = (cloud - cloud.min()) / (cloud.max() - cloud.min())
cloud = np.clip((cloud - 0.35) * 1.9, 0, 1)
ex = (xx - CX) / (W * 0.85)
ey = (yy - (top + W * 0.08)) / (W * 0.26)
band = np.exp(-(ex ** 2 + ey ** 2) * 1.6)
alpha = np.clip(cloud * band * 1.7, 0, 0.95)[..., None]
cloud_col = np.array([0.80, 0.82, 0.83], np.float32)
out = out * (1 - alpha) + cloud_col * alpha

Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT, quality=93)
fade = np.clip((yy - top) / (W * 0.42), 0, 1) ** 1.4  # the upper bars sink into the cloud
vis = np.clip(mask * fade * (1 - alpha[..., 0] * 0.6), 0, 1)
rgba = np.zeros((H_, W_, 4), np.uint8); rgba[..., 3] = (vis * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(OUT.rsplit('.', 1)[0] + '-mask.png')
print("ok", OUT)
