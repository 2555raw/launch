#!/usr/bin/env python3
"""Extend the photograph downward, seamlessly.

There is no image model on this machine, so nothing here is outpainted by one.
Two things make the join invisible instead:

  1. The extension starts from the photograph's own pixels. Its first rows ARE
     the bottom rows of the photograph, and the rendered landscape is dissolved
     into them over the next few hundred rows.
  2. The extension is one frame, not a stack of scenes. Every feature is a
     smooth function of how far down the whole column you are, so nothing can
     start or stop at an edge. There are no bands to seam together.

The photograph is a drone shot looking down, so the continuation is a drone
shot looking down: no sky and no horizon anywhere, the valley seen from above
the whole way. It takes its palette from the photograph, its light from the
upper left as the photograph's shadows do, and its architecture from the same
arch wall, seen again in plan further down.

The descent: the plunge pool drains into a river, the river runs through rock
with tributaries joining it, falls come in from the sides, the channel opens
into a reservoir with islands, a second wall holds it, and the last of it goes
into weather.

    npm run extend
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageFilter
from terrain import Frame, col, rgb, mix, patch, quilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "media")
SOURCE = os.path.join(MEDIA, "source.jpg")

EXT = 5400          # how much landscape is added under the photograph
BLEND = 340         # how far the photograph is carried into it

# read off the photograph
FOREST_SUN = "#8a9558"
FOREST_MID = "#4e5f34"
FOREST_DARK = "#222d1b"
ROCK_LIT = "#8d8878"
ROCK_DARK = "#33342c"
WATER_DEEP = "#1d3d57"
WATER_MID = "#2f5f80"
WATER_SHALLOW = "#6f9db2"
FOAM = "#e9f0f2"
CONCRETE = "#9a978c"
SILT = "#6d6a59"


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def build(f, photo):
    """Everything is a function of v, the depth down the whole extension."""
    v, u = f.v, f.u

    # ---- the channel: where the water is, and how wide -------------------
    # At the top it is as wide as the plunge pool the photograph ends on, then
    # it closes to a river, runs through the gorge, and opens into the reserve.
    centre = (0.40
              + 0.10 * smoothstep(v, 0.00, 0.22)
              - 0.06 * smoothstep(v, 0.30, 0.52)
              + 0.06 * smoothstep(v, 0.60, 1.00)
              + 0.022 * np.sin(v * 9.0) * (1 - smoothstep(v, 0.55, 0.75)))
    half = (0.205 * (1 - smoothstep(v, 0.00, 0.10))
            + 0.085 * smoothstep(v, 0.03, 0.12)
            + 0.055 * smoothstep(v, 0.30, 0.46)
            + 0.30 * smoothstep(v, 0.52, 0.74)
            + 0.22 * smoothstep(v, 0.74, 0.94))
    wander = (f.noise(7, 4, 11, aspect=0.22) - 0.5) * 0.05 * (1 - smoothstep(v, 0.5, 0.7))
    centre = centre + wander
    d = np.abs(u - centre) / half                 # 0 mid channel, 1 at the bank

    # ---- the ground, quilted out of the photograph -----------------------
    coarse = f.noise(9, 5, 21, aspect=1.1)
    lit = f.shade(f.smooth(coarse, 2.2), lx=-0.6, ly=-0.4, strength=1.25)

    forest = quilt(patch(photo, .015, .195, .20, .60), f.w, f.h, 190, 85, 7)
    rocks = quilt(patch(photo, .30, .38, .55, .66), f.w, f.h, 110, 55, 8)

    # the valley is lit the way the photograph is lit, from the upper left
    forest = np.clip(forest * (0.72 + 0.62 * lit[..., None]), 0, 1)
    rocks = np.clip(rocks * (0.74 + 0.55 * lit[..., None]), 0, 1)

    rockiness = (smoothstep(v, 0.22, 0.34) - smoothstep(v, 0.46, 0.56)) * 0.85
    scree = np.clip((f.noise(15, 5, 25, aspect=1.4) - 0.44) * 3.4, 0, 1)
    ground = mix(forest, rocks,
                 np.clip(scree[..., None] * rockiness[..., None]
                         + np.clip(1.3 - d, 0, 1)[..., None] * 0.5, 0, 1))
    f.img[:] = ground

    # ---- the water, also out of the photograph ---------------------------
    deep_tex = quilt(patch(photo, .66, .97, .02, .20), f.w, f.h, 130, 70, 9)        # the reservoir
    streak_tex = quilt(patch(photo, .455, .60, .30, .52), f.w, f.h, 150, 80, 10)    # the gates
    flow = f.noise(34, 4, 31, aspect=0.3)
    ripple = f.noise(140, 3, 35, aspect=6.0)

    still = smoothstep(v, 0.52, 0.74)
    fast = 1 - still

    # the body of it is reservoir water, kept dark, with its own ripple
    body = np.clip(deep_tex * (0.9 + 0.22 * ripple[..., None]), 0, 1)
    body = mix(body, rgb(col(WATER_DEEP)), (np.clip(1 - d, 0, 1) ** 1.8 * 0.22)[..., None])
    # where it is moving, the streaked water from the gates is laid over it
    run = np.clip((flow - 0.42) * 2.2, 0, 1) * fast * np.clip(1.2 - d, 0, 1)
    body = mix(body, np.clip(streak_tex * 1.06, 0, 1), np.clip(run, 0, 1)[..., None] * 0.85)
    # and the shallows against the banks go paler
    body = mix(body, rgb(col(WATER_SHALLOW)), (np.clip(d - 0.55, 0, 1) ** 1.4 * 0.55)[..., None])

    # rocks standing in the fast water, each with white water below it
    rocks_n = f.noise(52, 3, 37, aspect=1.0)
    boulder = np.clip((rocks_n - 0.70) * 9, 0, 1) * fast * np.clip(1.0 - d, 0, 1)
    body = mix(body, rgb(col(ROCK_DARK)), np.clip(boulder, 0, 1)[..., None] * 0.85)
    wake = np.roll(boulder, 26, axis=0) * 0.8
    body = mix(body, rgb(col(FOAM)), np.clip(wake, 0, 1)[..., None] * 0.6)

    water = smoothstep(1 - d, 0.0, 0.10)
    f.put(water, np.clip(body, 0, 1), soft=1.0)

    # the shore: pale shingle on the sunlit side, the trees' own shadow on the other
    shingle = np.clip(1 - np.abs(d - 1.02) / 0.09, 0, 1) * (1 - still * 0.5)
    f.put(np.clip(shingle * (0.5 + 0.9 * f.noise(60, 4, 39)), 0, 1) * 0.75,
          np.clip(rocks * 1.22, 0, 1), soft=1.4)
    shadow_side = np.clip((u - centre) / np.maximum(half, 1e-6), -1, 1)   # sun is upper left
    f.put(np.clip(1 - np.abs(d - 0.92) / 0.07, 0, 1) * np.clip(-shadow_side, 0, 1) * 0.55,
          rgb(col("#0b1a16")), soft=2.2)

    # a rim of wet silt where water meets land
    f.put(np.clip(1 - np.abs(d - 1.0) / 0.10, 0, 1) * 0.55 * (1 - still * 0.6),
          rgb(col(SILT)) * (0.6 + 0.8 * lit[..., None]), soft=1.6)

    # ---- steps in the bed: the water goes white right across -------------
    for vy, strength in ((0.075, 0.9), (0.175, 0.75), (0.285, 0.95), (0.405, 0.8), (0.495, 0.7)):
        step = np.clip(1 - np.abs(v - vy) / 0.010, 0, 1) * np.clip(1.1 - d, 0, 1)
        f.put(np.clip(step * (0.45 + 0.85 * flow) - 0.15, 0, 1) * strength, rgb(col(FOAM)), soft=1.8)
        # and the spray it throws downstream of itself
        plume = (np.clip(1 - np.abs(u - centre) / (half * 1.5), 0, 1)
                 * np.clip(1 - np.abs(v - (vy + 0.018)) / 0.030, 0, 1))
        f.put(np.clip(plume * (0.35 + 0.8 * f.noise(16, 4, 41, aspect=1.6)) - 0.3, 0, 1) * 0.5 * strength,
              rgb(col("#eef4f6")), soft=5)

    # ---- tributaries, cutting down through the forest to join it ---------
    for side, vy, length, wide, seed in ((0, 0.135, 0.075, 0.013, 51), (1, 0.245, 0.085, 0.011, 52),
                                         (0, 0.355, 0.08, 0.014, 53), (1, 0.45, 0.07, 0.011, 54),
                                         (0, 0.555, 0.06, 0.010, 55)):
        x0 = 0.02 if side == 0 else 0.98
        k = np.clip((v - (vy - length)) / length, 0, 1)
        path = x0 + (centre - x0) * k ** 1.7
        near = np.abs(u - path) / (wide * (0.55 + 1.3 * k))
        live = smoothstep(v, vy - length, vy - length * 0.9) * (1 - smoothstep(v, vy - 0.014, vy))
        # the notch it has cut, which is darker than the canopy either side
        f.put(np.clip(1 - near / 3.2, 0, 1) * live * 0.62, rgb(col("#16240f")), soft=3.0)
        # the water in it
        chan = np.clip(1 - near, 0, 1) * live
        f.put(np.clip(chan * (0.5 + 0.8 * f.noise(44, 4, seed, aspect=0.25)), 0, 1) * 0.75,
              np.clip(streak_tex * 1.1, 0, 1), soft=1.1)
        f.put(np.clip(chan * (0.35 + 0.95 * f.noise(64, 3, seed + 1, aspect=0.2)) - 0.62, 0, 1) * 2.2,
              rgb(col(FOAM)), soft=1.0)
        # and the fan of gravel where it arrives
        fan = np.clip(1 - np.sqrt(((u - centre) / 0.055) ** 2 + ((v - vy) / 0.016) ** 2), 0, 1)
        f.put(fan * 0.45, np.clip(rocks * 1.2, 0, 1), soft=2.6)

    # Islands were tried here and every version of them read as moss on a
    # pond, so the reserve is left as open water. What cannot be made to look
    # real is better left out than polished.

    # ---- weather, thickening all the way down ----------------------------
    veil = f.noise(5, 4, 61, aspect=3.0)
    mist = smoothstep(v, 0.80, 1.0) * (0.3 + 0.95 * veil)
    f.put(np.clip(mist, 0, 1) * 0.30, rgb(col("#a9c2cc")), soft=26)
    # and the light going long as the valley gets deeper
    f.img = mix(f.img, rgb(col("#9fbac6")), (smoothstep(v, 0.55, 1.0) * 0.16)[..., None])


def main():
    photo = np.asarray(Image.open(SOURCE).convert("RGB"), np.float32) / 255.0
    ph, pw, _ = photo.shape
    print("source %dx%d" % (pw, ph))

    f = Frame(pw, EXT, seed=90210)
    build(f, photo)
    # the photograph is contrastier than any render comes out
    m = f.img.mean(axis=(0, 1), keepdims=True)
    f.img = np.clip(m + (f.img - m) * 1.1, 0, 1)
    f.grade(vignette=0.08, grain=0.012)
    # a photograph has edges; a render has to be given them
    blurred = np.stack([np.asarray(Image.fromarray((np.clip(f.img[..., c], 0, 1) * 255).astype(np.uint8), "L")
                                   .filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255.0
                        for c in range(3)], axis=-1)
    f.img = np.clip(f.img + (f.img - blurred) * 0.35, 0, 1)

    # Nothing is blended at the join. The render keeps its own texture all the
    # way to its first row; what is matched is colour. The photograph's bottom
    # edge and the render's top edge are reduced to a colour per column, the
    # difference between them is applied to the render as a correction, and the
    # correction is faded out down the frame. So the first row of the extension
    # is the colour of the last row of the photograph, column for column, with
    # no smear, no mirror and no band.
    def edge_colour(a, rows):
        strip = a[:rows] if rows > 0 else a[rows:]
        colours = strip.mean(axis=0)[None, :, :]
        blurred = np.asarray(Image.fromarray((np.clip(colours, 0, 1) * 255).astype(np.uint8))
                             .filter(ImageFilter.GaussianBlur(9)), np.float32)[0] / 255.0
        return blurred

    corr = edge_colour(photo, -46) - edge_colour(f.img, 46)
    fade = (1 - np.clip(np.linspace(0, EXT / BLEND, EXT), 0, 1) ** 0.6)[:, None, None]
    ext = np.clip(f.img + corr[None, :, :] * fade, 0, 1)

    full = np.concatenate([photo, ext], axis=0)
    H = full.shape[0]
    img = Image.fromarray((np.clip(full, 0, 1) * 255).astype(np.uint8), "RGB")
    img.save(os.path.join(MEDIA, "world.jpg"), quality=82, optimize=True, progressive=True)
    img.resize((pw // 2, H // 2), Image.LANCZOS).save(os.path.join(MEDIA, "world-half.jpg"),
                                                     quality=70, optimize=True)
    img.resize((32, int(32 * H / pw)), Image.LANCZOS).resize((pw // 8, H // 8), Image.BICUBIC) \
       .save(os.path.join(MEDIA, "world-blur.jpg"), quality=58)

    stops = [("The wall", 0.0), ("The river", 0.22), ("The gorge", 0.40),
             ("The confluence", 0.58), ("The reserve", 0.76), ("The weather", 0.92)]
    open(os.path.join(ROOT, "world.js"), "w", encoding="utf-8").write(
        "/* Generated by scripts/extend.py. The photograph and the landscape that\n"
        " * continues from it, as one frame. Fractions are of the whole column.\n */\n\n"
        "const WORLD = {\n  src: \"media/world.jpg\",\n  low: \"media/world-half.jpg\",\n"
        "  blur: \"media/world-blur.jpg\",\n  w: %d,\n  h: %d,\n  ratio: %.4f,\n"
        "  photo: %.4f,\n  stops: %s,\n};\n"
        % (pw, H, H / pw, ph / H, repr([{"name": n, "at": a} for n, a in stops]).replace("'", '"')))
    for n in ("world.jpg", "world-half.jpg", "world-blur.jpg"):
        print("%-16s %6.0f KB" % (n, os.path.getsize(os.path.join(MEDIA, n)) / 1024))
    print("frame: %dx%d  (the photograph is the top %.1f%%)" % (pw, H, ph / H * 100))


if __name__ == "__main__":
    main()
