"""Make the green mark in the cloud image more visible; pixels outside the mark stay untouched."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src, out_path, amt = sys.argv[1], sys.argv[2], float(sys.argv[3])
a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
g = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
gs = nd.gaussian_filter(g, 2)
t = np.clip((gs - 0.03) / (0.065 - 0.03), 0, 1)
core = t > 0.5
lab, n = nd.label(core)
sizes = nd.sum(core, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 6000])  # only the six tiers, not stray green haze
keep = nd.binary_dilation(keep, iterations=6)
mask = nd.gaussian_filter(t * t * (3 - 2 * t) * keep, 1.2)

lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
inside = mask > 0.5
m = lum[inside].mean()
tex = np.clip(lum / m, 0.5, 1.6)[..., None]                    # keep the cloud texture inside the mark
lime = np.array([0.77, 0.98, 0.43], np.float32)
target = np.clip(lime * (0.62 + 0.38 * (tex - 1) * 1.6 + 0.0), 0, 1) * np.clip(0.55 + 0.45 * tex, 0, 1.2)
out = a + (target - a) * (mask * amt)[..., None]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(out_path, quality=95)
print("ok", float(m), float(mask.max()))
