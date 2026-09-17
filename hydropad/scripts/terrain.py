"""The bits every rendered image here needs: noise, light, and putting one
thing on top of another. Kept in one place so the backdrop and the source
plates are lit the same way and look like they belong together.
"""
import numpy as np
from PIL import Image, ImageFilter


class Frame:
    def __init__(self, w, h, seed=0):
        self.w, self.h = w, h
        self.rng = np.random.default_rng(seed)
        self.seed = seed
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        self.u, self.v = xx / w, yy / h
        self.img = np.zeros((h, w, 3), np.float32)

    # ---------------------------------------------------------------- noise
    def smooth(self, a, s):
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
        return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), np.float32) / 255.0

    def noise(self, scale, octaves=5, seed=0, aspect=1.0):
        """Value noise over octaves. scale is rows in the coarsest grid and
        aspect is how much wider than tall a cell is, which is what makes
        water read as water and strata as strata."""
        r = np.random.default_rng(self.seed * 1013 + seed)
        out = np.zeros((self.h, self.w), np.float32)
        amp, total = 1.0, 0.0
        for o in range(octaves):
            gh = max(2, int(scale * (2 ** o)))
            gw = max(2, int(gh / aspect * self.w / self.h))
            g = (r.random((gh, gw)) * 255).astype(np.uint8)
            layer = np.asarray(Image.fromarray(g, "L").resize((self.w, self.h), Image.BICUBIC),
                               np.float32) / 255.0
            out += layer * amp
            total += amp
            amp *= 0.5
        return out / total

    # ---------------------------------------------------------------- light
    def shade(self, height, lx=-0.55, ly=-0.45, strength=1.0):
        gy, gx = np.gradient(height)
        n = 1.0 / np.sqrt(gx * gx + gy * gy + 1e-4)
        return np.clip(0.5 + (-gx * lx - gy * ly) * n * strength, 0, 1)

    # ------------------------------------------------------------ compositing
    def put(self, mask, rgb, soft=1.0):
        m = self.smooth(np.asarray(mask, np.float32), soft)[..., None] if soft else np.asarray(mask, np.float32)[..., None]
        self.img = self.img * (1 - m) + rgb * m

    def grade(self, vignette=0.26, grain=0.014, gamma=1.03):
        vig = 1 - vignette * np.clip(((self.u - .5) ** 2 * 2.4 + (self.v - .5) ** 2 * 1.5) * 1.5, 0, 1)
        self.img *= vig[..., None]
        self.img = np.clip(self.img, 0, 1) ** (1 / gamma)
        self.img += (self.rng.random((self.h, self.w, 1)).astype(np.float32) - .5) * grain
        self.img = np.clip(self.img, 0, 1)

    def save(self, path, quality=84):
        Image.fromarray((self.img * 255).astype(np.uint8), "RGB").save(
            path, quality=quality, optimize=True, progressive=True)


def patch(photo, x0, x1, y0, y1):
    h, w, _ = photo.shape
    return photo[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)].copy()


def quilt(src, w, h, tile, overlap, seed):
    """Fill w x h with random crops of src, feathered into each other.

    The extension has to have the photograph's grain, and no amount of value
    noise has photographic grain. So the ground down there is made of the
    ground up here: crops of the real canopy, the real water and the real white
    water, laid down at random offsets and flipped, with the joins ramped out.
    """
    r = np.random.default_rng(seed)
    sh, sw, _ = src.shape
    tile = min(tile, sh - 2, sw - 2)
    step = max(8, tile - overlap)
    out = np.zeros((h + tile, w + tile, 3), np.float32)
    acc = np.zeros((h + tile, w + tile, 1), np.float32)
    ramp = np.minimum(np.linspace(0, 1, tile) * (tile / max(1, overlap)), 1.0).astype(np.float32)
    ramp = np.minimum(ramp, ramp[::-1])
    mask = (ramp[:, None] * ramp[None, :])[..., None] + 1e-4
    for y in range(0, h + 1, step):
        for x in range(0, w + 1, step):
            sy = int(r.integers(0, sh - tile))
            sx = int(r.integers(0, sw - tile))
            crop = src[sy:sy + tile, sx:sx + tile]
            if r.random() < .5:
                crop = crop[:, ::-1]
            if r.random() < .5:
                crop = crop[::-1]
            out[y:y + tile, x:x + tile] += crop * mask
            acc[y:y + tile, x:x + tile] += mask
    return (out[:h, :w] / acc[:h, :w]).astype(np.float32)



def col(hexv):
    hexv = hexv.lstrip("#")
    return np.array([int(hexv[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def rgb(c):
    return c[None, None, :]


def mix(a, b, k):
    return a * (1 - k) + b * k


def sky_gradient(f, top, bottom, power=1.5):
    t = (1 - f.v[..., None]) ** power
    return rgb(col(top)) * t + rgb(col(bottom)) * (1 - t)


def ridgeline(f, base, amp, freq, seed):
    """A skyline as a value per column."""
    r = np.random.default_rng(seed)
    xs = np.linspace(0, 1, f.w, np.float32)
    prof = np.zeros(f.w, np.float32)
    a, fr = 1.0, freq
    for _ in range(5):
        ph = r.random() * 10
        prof += a * (np.sin(xs * fr * 2 * np.pi + ph) + .5 * np.sin(xs * fr * 3.7 * np.pi + ph * 2))
        a *= .5
        fr *= 2.05
    return base + prof / np.abs(prof).max() * amp
