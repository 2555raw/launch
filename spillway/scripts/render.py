#!/usr/bin/env python3
"""Render the backdrop instead of drawing it.

Photographs of dams belong to the people who took them and cannot be fetched
from this machine, and flat vector art does not survive being shown at the size
of a screen. So the scene is rendered: value noise for the rock, the water and
the concrete, a light direction, shading from the surface normals, haze with
distance, and grain over the whole thing.

Geometry is in fractions of the frame and has to agree with scene.js, which
paints the live water on top of it.
"""
import math, os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W, H = 1920, 1080

# the contract with scene.js
CREST, TOE, POOLY = 0.47, 0.86, 0.885
WALL_L, WALL_R = 0.225, 0.775
LAKE = dict(top=0.335, left=0.055, right=0.945)
CHUTE = dict(l=0.435, r=0.565, fl=0.415, fr=0.585)

rng = np.random.default_rng(70490)
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = X / W, Y / H


def smooth(a, s):
    """Gaussian blur through PIL, which is faster than doing it in numpy."""
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), dtype=np.float32) / 255.0


def noise(scale, octaves=5, seed=0, aspect=1.0):
    """Value noise over octaves. scale is rows in the coarsest grid; aspect
    stretches each cell sideways, which is what makes water look like water."""
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        # aspect is how much wider than tall a cell of the grid is
        gh = max(2, int(scale * (2 ** o)))
        gw = max(2, int(gh / aspect * W / H))
        g = r.random((gh, gw)).astype(np.float32)
        layer = np.asarray(Image.fromarray((g * 255).astype(np.uint8), "L")
                           .resize((W, H), Image.BICUBIC), dtype=np.float32) / 255.0
        out += layer * amp
        total += amp
        amp *= 0.5
    return out / total


def shade(height, lx=-0.55, ly=-0.45, strength=1.0):
    """Light a height field from the upper left."""
    gy, gx = np.gradient(height)
    n = 1.0 / np.sqrt(gx * gx + gy * gy + 1e-4)
    lit = (-gx * lx - gy * ly) * n
    return np.clip(0.5 + lit * strength, 0, 1)


def col(hexv):
    hexv = hexv.lstrip("#")
    return np.array([int(hexv[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def put(img, mask, rgb):
    m = mask[..., None]
    return img * (1 - m) + rgb * m


def crest_y(xu):
    """The crest sags towards the middle: an arch seen from downstream."""
    k = np.clip((xu - WALL_L) / (WALL_R - WALL_L), 0, 1)
    return CREST + 0.028 * np.sin(np.pi * k)


def toe_y(xu):
    k = np.clip((xu - WALL_L) / (WALL_R - WALL_L), 0, 1)
    return TOE + 0.032 * np.sin(np.pi * k)


# ----------------------------------------------------------------- the sky
img = np.zeros((H, W, 3), np.float32)
sky = (col("#4f9fd4")[None, None, :] * (1 - v[..., None]) ** 1.5
       + col("#cfe4ee")[None, None, :] * (1 - (1 - v[..., None]) ** 1.5))
img[:] = sky

sun = np.exp(-(((u - 0.72) ** 2) * 6 + ((v - 0.06) ** 2) * 22) * 4)
img += col("#fff0c9")[None, None, :] * sun[..., None] * 0.85

# cloud, built from noise and lit from the same side as everything else
cl = noise(4, 6, 3, aspect=2.4)
cover = np.clip((cl - 0.5) * 3.2, 0, 1) * np.clip(1.5 - v * 5.0, 0, 1)
cover = smooth(cover, 6)
cl_shade = shade(smooth(cl, 9) * 26, strength=0.9)
cloud_rgb = col("#ffffff")[None, None, :] * (0.84 + 0.16 * cl_shade[..., None])
img = put(img, cover * 0.92, cloud_rgb)

# ----------------------------------------------------------------- ranges
for depth, (base_v, amp, freq, tint, haze) in enumerate([
        (0.30, 0.075, 2.3, "#5d7791", 0.62),
        (0.345, 0.055, 3.7, "#4f6b83", 0.44),
        (0.385, 0.040, 6.1, "#41596e", 0.28)]):
    r = np.random.default_rng(90 + depth)
    xs = np.linspace(0, 1, W, dtype=np.float32)
    prof = np.zeros(W, np.float32)
    a, f = 1.0, freq
    for o in range(5):
        ph = r.random() * 10
        prof += a * (np.sin(xs * f * 2 * np.pi + ph) + np.sin(xs * f * 3.7 * np.pi + ph * 2) * 0.5)
        a *= 0.5
        f *= 2.05
    prof = prof / np.abs(prof).max()
    ridge_v = base_v + prof * amp
    mask = (v > ridge_v[None, :]).astype(np.float32)
    mask = smooth(mask, 1.2)
    rock = noise(10 + depth * 8, 5, 200 + depth, aspect=1.4)
    lit = shade(smooth(rock, 1.5) * (70 - depth * 18), strength=1.3)
    rgb = col(tint)[None, None, :] * (0.55 + 0.75 * lit[..., None])
    if depth == 0:                       # snow on the highest tops
        snowline = (v < ridge_v[None, :] + 0.035) & (v > ridge_v[None, :])
        rgb = np.where((snowline & (rock > 0.5))[..., None], col("#eef5f8")[None, None, :] * (0.8 + 0.3 * lit[..., None]), rgb)
    rgb = rgb * (1 - haze) + sky * haze
    img = put(img, mask, rgb)

# the valley holds its own weather
img += (col("#dceaf0")[None, None, :] - img) * (np.clip((v - 0.24) / 0.16, 0, 1)
                                                * np.clip((0.44 - v) / 0.14, 0, 1))[..., None] * 0.55

# ----------------------------------------------------------------- the lake
cy = crest_y(u)
lake_m = ((v > LAKE["top"]) & (v < cy) & (u > LAKE["left"] + (1 - (v - LAKE["top"]) / (CREST - LAKE["top"])) * 0.07)
          & (u < LAKE["right"] - (1 - (v - LAKE["top"]) / (CREST - LAKE["top"])) * 0.07)).astype(np.float32)
lake_m = smooth(lake_m, 1.0)
depth_k = np.clip((v - LAKE["top"]) / (CREST - LAKE["top"]), 0, 1)
water = (col("#8fd0e4")[None, None, :] * (1 - depth_k[..., None])
         + col("#14638a")[None, None, :] * depth_k[..., None])
rip = noise(26, 4, 11, aspect=14.0)
water += (rip[..., None] - 0.5) * 0.16 * (0.35 + depth_k[..., None])
glare = np.exp(-((u - 0.72) ** 2) * 18) * np.clip(rip - 0.6, 0, 1) * 4.0
water += col("#ffffff")[None, None, :] * glare[..., None] * (0.25 + depth_k[..., None] * 0.55)
img = put(img, lake_m, np.clip(water, 0, 1))

# ----------------------------------------------------------------- the canyon
rock_n = noise(13, 6, 21, aspect=2.6)
strata = np.sin(v * 52 + rock_n * 11.0 + u * 4) * 0.5 + 0.5
rock_h = smooth(rock_n * 0.86 + strata * 0.14, 2.6)
rock_lit = shade(rock_h * 62, strength=0.85)
# the wall on the right faces away from the light
rock_key_l = 0.72 + 0.5 * np.clip(1 - u / (WALL_L + 0.1), 0, 1)
rock_key_r = 0.46 + 0.3 * np.clip((u - WALL_R) / 0.24, 0, 1)

brow = noise(5, 4, 55, aspect=3.0)
# the skyline of each wall, falling from the top of the frame to the abutment
ridge_l = 0.09 + (CREST - 0.09) * np.clip(u / (WALL_L + 0.03), 0, 1) ** 0.85 + (brow - 0.5) * 0.035
ridge_r = 0.07 + (CREST - 0.07) * np.clip((1 - u) / (1 - WALL_R + 0.03), 0, 1) ** 0.85 + (brow - 0.5) * 0.035
# and its foot, which widens below the crest as the walls come towards the viewer
foot_l = WALL_L + 0.03 + np.clip((v - CREST) / 0.5, 0, 1) * 0.16
foot_r = WALL_R - 0.03 - np.clip((v - CREST) / 0.5, 0, 1) * 0.16
lm = ((v > ridge_l) & (u < foot_l)).astype(np.float32)
rm = ((v > ridge_r) & (u > foot_r)).astype(np.float32)
lm, rm = smooth(lm, 1.1), smooth(rm, 1.1)
rock_rgb_l = col("#6d5c48")[None, None, :] * (0.5 + 0.72 * rock_lit[..., None]) * rock_key_l[..., None]
rock_rgb_r = col("#554839")[None, None, :] * (0.48 + 0.7 * rock_lit[..., None]) * rock_key_r[..., None]
# the band the lake leaves on the rock when it draws down
ring = np.clip(1 - np.abs(v - (CREST + 0.035)) / 0.038, 0, 1)
rock_rgb_l = rock_rgb_l * (1 - 0.45 * ring[..., None]) + col("#d9cfb4")[None, None, :] * 0.45 * ring[..., None]
rock_rgb_r = rock_rgb_r * (1 - 0.4 * ring[..., None]) + col("#d9cfb4")[None, None, :] * 0.4 * ring[..., None]
# distance hazes the rock too
haze_k = np.clip((CREST + 0.1 - v) * 1.6, 0, 1)[..., None] * 0.42
img = put(img, lm, rock_rgb_l * (1 - haze_k) + sky * haze_k)
img = put(img, rm, rock_rgb_r * (1 - haze_k) + sky * haze_k)

# ----------------------------------------------------------------- the dam
ty = toe_y(u)
inset = 0.029 * np.clip((v - cy) / (ty - cy + 1e-6), 0, 1)
wall_m = ((v >= cy) & (v <= ty) & (u > WALL_L + inset) & (u < WALL_R - inset)).astype(np.float32)
wall_m = smooth(wall_m, 0.9)

grain = noise(180, 4, 33, aspect=1.0)
down = np.clip((v - CREST) / (TOE - CREST), 0, 1)
# courses, poured one lift at a time, following the curve of the crest
lift = np.sin((v - cy) * 190) * 0.5 + 0.5
lift = np.clip((lift - 0.88) * 5.0, 0, 1)
# piers standing proud of the face
across = np.clip((u - WALL_L) / (WALL_R - WALL_L), 0, 1)
pier = np.sin(across * 9 * 2 * np.pi) * 0.5 + 0.5
pier = np.clip((pier - 0.94) * 11, 0, 1)

conc = col("#b9c3c5")[None, None, :] * (0.78 + 0.34 * grain[..., None])
conc = conc * (1 - 0.34 * down[..., None])                       # darker towards the toe
conc = conc * (1 - 0.07 * lift[..., None])                       # the seam between courses
conc = conc + col("#e7edee")[None, None, :] * pier[..., None] * 0.07
# the light rakes across the face
conc = conc * (0.6 + 0.62 * np.clip(1.35 - np.abs(across - 0.26) * 1.25, 0, 1))[..., None]
# the abutment throws a wedge of shade over the far side of the face
wedge = np.clip((across - 0.62) / 0.4, 0, 1) * np.clip((v - cy) / 0.16, 0, 1)
conc = conc * (1 - 0.3 * smooth(wedge, 14)[..., None])
# and the crest throws a shadow down it
over = np.clip(1 - (v - cy) / 0.035, 0, 1) * (v > cy)
conc = conc * (1 - 0.42 * over[..., None])
img = put(img, wall_m, np.clip(conc, 0, 1))

# the overflow bay: wet concrete is darker than dry
chute_l = CHUTE["l"] + (CHUTE["fl"] - CHUTE["l"]) * np.clip((v - CREST) / (TOE - CREST), 0, 1)
chute_r = CHUTE["r"] + (CHUTE["fr"] - CHUTE["r"]) * np.clip((v - CREST) / (TOE - CREST), 0, 1)
chute_m = (wall_m > 0.5) & (u > chute_l) & (u < chute_r)
img = np.where(chute_m[..., None], img * 0.8 + col("#8fadb8")[None, None, :] * 0.17, img)
# the bay is notched into the crest, and the notch is in shadow
notch = (np.abs(v - (cy - 0.006)) < 0.012) & (u > chute_l) & (u < chute_r)
img = np.where(notch[..., None], col("#5d757e")[None, None, :], img)
for edge in (chute_l, chute_r):
    rail = np.clip(1 - np.abs(u - edge) / 0.006, 0, 1) * (wall_m > 0.5)
    img = put(img, rail * 0.5, col("#cfd8d9")[None, None, :])

# the roadway along the crest
road = (np.abs(v - cy) < 0.012).astype(np.float32) * ((u > WALL_L - 0.02) & (u < WALL_R + 0.02))
img = put(img, smooth(road, 0.8), col("#e9eff0")[None, None, :])
rail = (np.abs(v - (cy - 0.016)) < 0.004).astype(np.float32) * ((u > WALL_L - 0.02) & (u < WALL_R + 0.02))
img = put(img, smooth(rail, 0.7) * 0.8, col("#aebabd")[None, None, :])

# ----------------------------------------------------------------- the river
bank = noise(9, 4, 61, aspect=0.5) * 0.03
river_m = ((v > ty - 0.012)
           & (u > WALL_L - 0.11 + (v - TOE) * 0.35 + bank)
           & (u < WALL_R + 0.11 - (v - TOE) * 0.35 - bank))
river_m = smooth(river_m.astype(np.float32), 1.6) > 0.5
riv_k = np.clip((v - TOE) / (1 - TOE), 0, 1)
riv = (col("#2e88a6")[None, None, :] * (1 - riv_k[..., None]) + col("#0c4258")[None, None, :] * riv_k[..., None])
flow = noise(22, 4, 44, aspect=11.0)
riv += (flow[..., None] - 0.5) * 0.2
foam = np.clip(1 - np.abs(u - (CHUTE["fl"] + CHUTE["fr"]) / 2) / 0.2, 0, 1) * np.clip(1 - np.abs(v - POOLY) / 0.09, 0, 1)
riv += col("#ffffff")[None, None, :] * np.clip(foam * flow * 1.6, 0, 1)[..., None] * 0.55
img = np.where(river_m[..., None], np.clip(riv, 0, 1), img)

# ----------------------------------------------------------------- grade
mist = (np.clip((v - 0.68) / 0.24, 0, 1)
        * np.clip(1 - np.abs(u - 0.5) / 0.55, 0, 1)
        * (0.5 + 0.5 * noise(7, 4, 88, aspect=2.2)))
img += (col("#dfeaef")[None, None, :] - img) * smooth(mist, 26)[..., None] * 0.42
vig = 1 - 0.3 * np.clip(((u - 0.5) ** 2 * 2.4 + (v - 0.5) ** 2 * 1.5) * 1.5, 0, 1)
img *= vig[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.04)
img += (rng.random((H, W, 1)).astype(np.float32) - 0.5) * 0.016     # film grain
img = np.clip(img, 0, 1)

scene = Image.fromarray((img * 255).astype(np.uint8), "RGB")
scene.save(os.path.join(ROOT, "media", "scene.jpg"), quality=86, optimize=True, progressive=True)

# a cheap first paint while the full frame arrives
scene.resize((48, 27), Image.LANCZOS).resize((W // 4, H // 4), Image.BICUBIC).save(
    os.path.join(ROOT, "media", "scene-blur.jpg"), quality=62)

for f in ("scene.jpg", "scene-blur.jpg"):
    p = os.path.join(ROOT, "media", f)
    print("%-16s %6.0f KB" % (f, os.path.getsize(p) / 1024))
