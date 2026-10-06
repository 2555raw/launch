"""Remove the mark from the cloud image by patching each side with the clouds just beyond it."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
H, W = a.shape[:2]
g = nd.gaussian_filter(a[..., 1] - (a[..., 0] + a[..., 2]) / 2, 3)
hole = nd.binary_dilation(g > 0.028, iterations=26)
lab, n = nd.label(hole); sizes = nd.sum(hole, lab, range(1, n + 1))
hole = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 20000])
xx = np.arange(W)[None, :].repeat(H, 0)
# Left half borrows from further left, right half from further right, crossfaded across the middle
# so there is no seam where the two meet.
rows = np.arange(H)[:, None]
left = a[rows, np.clip(xx - 330, 0, W - 1)]
right = a[rows, np.clip(xx + 330, 0, W - 1)]
ramp = np.clip((xx - (W // 2 - 110)) / 220, 0, 1)[..., None]
ramp = ramp * ramp * (3 - 2 * ramp)
patch = left * (1 - ramp) + right * ramp
soft = nd.gaussian_filter(hole.astype(np.float32), 18)[..., None]
out = a * (1 - soft) + patch * soft
gray = out.mean(axis=2, keepdims=True)
out = out * 0.85 + gray * 0.15
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(sys.argv[2], quality=93)
print("ok")
