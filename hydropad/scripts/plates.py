#!/usr/bin/env python3
"""Render one plate per water source.

Photographs of these places belong to the people who took them and cannot be
fetched from this machine, so each source gets a rendered frame instead, built
from its own figures: the class decides the scene, the published fill level
decides how much water is in it, and the ticker seeds the terrain so no two
look alike. A photograph dropped in media/sources/ still takes over.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from terrain import Frame, col, rgb, mix, sky_gradient, ridgeline

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "media", "plates")
W, H = 960, 600


def read_sources():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    rows = [{"t": m.group(1), "n": m.group(2), "c": m.group(3)} for m in
            re.finditer(r'\{\s*t:\s*"(\w+)".*?n:\s*"([^"]+)".*?c:\s*"([^"]+)"', src)]
    lv = dict((m.group(1), float(m.group(2))) for m in
              re.finditer(r"(\w+):\s*([\d.]+)", re.search(r"BASE_LEVEL\s*=\s*\{(.*?)\}", src, re.S).group(1)))
    for r in rows:
        r["lvl"] = lv.get(r["t"], .5)
    return rows


def hills(f, bands):
    """Ranges receding into haze, each lit from the same side."""
    sky = f.img.copy()
    for i, (base, amp, freq, tint, haze) in enumerate(bands):
        line = ridgeline(f, base, amp, freq, f.seed * 31 + i)
        m = (f.v > line[None, :]).astype(np.float32)
        tex = f.noise(11 + i * 7, 5, 60 + i, aspect=1.5)
        lit = f.shade(f.smooth(tex, 1.6) * (56 - i * 14), strength=1.05)
        c = rgb(col(tint)) * (0.5 + 0.8 * lit[..., None])
        if i == 0:
            snow = (f.v < line[None, :] + 0.05) & (f.v > line[None, :]) & (tex > .5)
            c = np.where(snow[..., None], rgb(col("#edf4f7")) * (.8 + .3 * lit[..., None]), c)
        f.put(m, mix(c, sky, haze), soft=1.1)


def tree(f, cx, base, ht, tex, tint="#3f6b32"):
    """A crown with a lit side and a trunk under it."""
    ar = f.w / f.h
    trunk = (np.abs(f.u - cx) < .0035) & (f.v < base) & (f.v > base - ht * .45)
    f.put(trunk, rgb(col("#48381f")), soft=.6)
    cy = base - ht * .68
    rx, ry = ht * .38 / ar, ht * .46
    d = ((f.u - cx) / rx) ** 2 + ((f.v - cy) / ry) ** 2
    crown = d < 1
    lit = np.clip(1.25 - np.sqrt(np.clip(d, 0, 4)) - (f.u - cx) / rx * .5 - (f.v - cy) / ry * .45, 0, 1)
    c = rgb(col(tint)) * (.5 + .85 * lit[..., None]) * (.85 + .3 * tex[..., None])
    f.put(crown, np.clip(c, 0, 1), soft=.9)


def water_body(f, mask, top_v, bot_v, shallow, deep, sun_u=.68, chop=16.0):
    k = np.clip((f.v - top_v) / max(1e-4, bot_v - top_v), 0, 1)
    body = rgb(col(shallow)) * (1 - k[..., None]) + rgb(col(deep)) * k[..., None]
    rip = f.noise(24, 4, 11, aspect=chop)
    body = body + (rip[..., None] - .5) * .17 * (.3 + k[..., None])
    glare = np.exp(-((f.u - sun_u) ** 2) * 20) * np.clip(rip - .6, 0, 1) * 4.2
    body = body + rgb(col("#ffffff")) * glare[..., None] * (.25 + k[..., None] * .5)
    f.put(mask, np.clip(body, 0, 1), soft=1.0)


# ---------------------------------------------------------------- reservoir

def reservoir(f, lvl):
    f.img[:] = sky_gradient(f, "#4f9fd4", "#d3e6ef")
    f.img += rgb(col("#fff2d2")) * np.exp(-(((f.u - .7) ** 2) * 7 + ((f.v - .04) ** 2) * 20) * 4)[..., None] * .8
    cloud = f.noise(4, 5, 3, aspect=2.6)
    cover = f.smooth(np.clip((cloud - .52) * 3.4, 0, 1) * np.clip(1.4 - f.v * 4.6, 0, 1), 5)
    f.put(cover * .9, rgb(col("#ffffff")) * (.86 + .14 * f.shade(f.smooth(cloud, 8) * 24, strength=.8)[..., None]), soft=0)
    hills(f, [(.30, .07, 2.2, "#5d7791", .6), (.36, .05, 3.6, "#4f6b83", .42)])

    crest = .50 - .03 * lvl
    surface = crest - .015 - .10 * lvl                 # a full lake sits higher
    wall_l, wall_r = .21, .79
    # the lake, seen over the crest
    lake = ((f.v > surface) & (f.v < crest)
            & (f.u > .05 + (1 - (f.v - surface) / max(1e-4, crest - surface)) * .08)
            & (f.u < .95 - (1 - (f.v - surface) / max(1e-4, crest - surface)) * .08))
    water_body(f, lake, surface, crest, "#8fd0e4", "#14638a", chop=13.0)

    # the canyon, coming down to the abutments
    brow = f.noise(5, 4, 55, aspect=3.0)
    rl = .08 + (crest - .08) * np.clip(f.u / (wall_l + .04), 0, 1) ** .85 + (brow - .5) * .04
    rr = .06 + (crest - .06) * np.clip((1 - f.u) / (1 - wall_r + .04), 0, 1) ** .85 + (brow - .5) * .04
    rock = f.noise(17, 6, 21, aspect=2.0)
    bed = np.sin(f.v * 58 + rock * 13 + f.u * 6) * .5 + .5
    lit = f.shade(f.smooth(rock * .86 + bed * .14, 2.2) * 58, strength=.85)
    for side, ridge, edge, tint, key in ((0, rl, wall_l, "#6d5c48", 1.15), (1, rr, wall_r, "#554839", .62)):
        foot = edge + .04 + np.clip((f.v - crest) / .5, 0, 1) * .15
        m = ((f.v > ridge) & (f.u < foot)) if side == 0 else ((f.v > ridge) & (f.u > 1 - (1 - edge) - .04 - np.clip((f.v - crest) / .5, 0, 1) * .15))
        c = rgb(col(tint)) * (.5 + .72 * lit[..., None]) * key
        # the band a drawn-down lake leaves on the rock it used to cover
        if lvl < .7:
            ring = np.clip(1 - np.abs(f.v - (crest + .04 * (1 - lvl))) / .05, 0, 1)
            c = mix(c, rgb(col("#d9cfb4")), (ring * .5 * (1 - lvl))[..., None])
        haze = np.clip((crest + .1 - f.v) * 1.6, 0, 1)[..., None] * .4
        f.put(m, mix(c, sky_gradient(f, "#4f9fd4", "#d3e6ef"), haze), soft=1.1)

    # the wall
    toe = .88
    cy = crest + .03 * np.sin(np.pi * np.clip((f.u - wall_l) / (wall_r - wall_l), 0, 1))
    ty = toe + .03 * np.sin(np.pi * np.clip((f.u - wall_l) / (wall_r - wall_l), 0, 1))
    inset = .03 * np.clip((f.v - cy) / (ty - cy + 1e-6), 0, 1)
    wall = (f.v >= cy) & (f.v <= ty) & (f.u > wall_l + inset) & (f.u < wall_r - inset)
    grain = f.noise(160, 4, 33)
    across = np.clip((f.u - wall_l) / (wall_r - wall_l), 0, 1)
    down = np.clip((f.v - crest) / (toe - crest), 0, 1)
    conc = rgb(col("#b9c3c5")) * (.78 + .34 * grain[..., None])
    conc = conc * (1 - .34 * down[..., None])
    conc = conc * (.6 + .62 * np.clip(1.35 - np.abs(across - .26) * 1.25, 0, 1))[..., None]
    conc = conc * (1 - .42 * (np.clip(1 - (f.v - cy) / .03, 0, 1) * (f.v > cy))[..., None])
    f.put(wall, np.clip(conc, 0, 1), soft=.9)
    f.put((np.abs(f.v - cy) < .012) & (f.u > wall_l - .02) & (f.u < wall_r + .02), rgb(col("#e9eff0")), soft=.8)

    # what is going over it, and where it lands
    gates = max(1, int(round(lvl * 4)))
    spill = np.zeros((f.h, f.w), np.float32)
    for g in range(gates):
        c0 = .5 + (g - (gates - 1) / 2) * .13
        spill = np.maximum(spill, np.clip(1 - np.abs(f.u - c0) / .045, 0, 1))
    fall = (wall & (spill > .2))
    streak = f.noise(40, 4, 71, aspect=.12)
    f.put(fall * spill, np.clip(rgb(col("#eef7fa")) * (.8 + .4 * streak[..., None]), 0, 1), soft=.9)
    # the river below
    bank = f.noise(9, 4, 61, aspect=.5) * .03
    river = (f.v > ty - .012) & (f.u > wall_l - .1 + (f.v - toe) * .35 + bank) & (f.u < wall_r + .1 - (f.v - toe) * .35 - bank)
    water_body(f, river, toe, 1.0, "#2e88a6", "#0c4258", chop=9.0)
    foam = np.clip(spill * 1.4, 0, 1) * np.clip(1 - np.abs(f.v - (toe + .02)) / .07, 0, 1) * river
    f.put(foam * .8, rgb(col("#ffffff")), soft=4)
    mist = np.clip((f.v - .7) / .25, 0, 1) * np.clip(1 - np.abs(f.u - .5) / .5, 0, 1) * (.5 + .5 * f.noise(7, 4, 88, aspect=2.2))
    f.img += (rgb(col("#dfeaef")) - f.img) * f.smooth(mist, 18)[..., None] * .35


# ------------------------------------------------------------------ aquifer

def aquifer(f, lvl):
    f.img[:] = sky_gradient(f, "#6fb2dd", "#dceaf1")
    cloud = f.noise(4, 5, 5, aspect=3.0)
    f.put(f.smooth(np.clip((cloud - .55) * 3.2, 0, 1) * np.clip(1.6 - f.v * 7, 0, 1), 4) * .85,
          rgb(col("#ffffff")), soft=0)
    r = np.random.default_rng(f.seed)
    soil = f.noise(18, 5, 9, aspect=2.2)
    roll = (f.noise(4, 3, 77, aspect=4.0) - .5) * .035          # the ground is not flat
    ground = .30 + roll
    f.put(f.v > ground, rgb(col("#6f8f4a")) * (.66 + .55 * soil[..., None]), soft=1.2)
    # a worked field, in rows going away from the viewer
    rows_ = np.sin((f.v - ground) * 320 + f.u * 6) * .5 + .5
    f.put((f.v > ground) & (f.v < ground + .055) & (rows_ > .62), rgb(col("#7c9a52")), soft=.7)
    for _ in range(int(r.integers(5, 9))):
        tree(f, float(r.uniform(.04, .96)), float(.30 + r.uniform(-.02, .02)), float(r.uniform(.09, .16)), soil)

    # strata, each one a different rock, and none of them level
    tops = [.052, .14, .25, .43, 1.4]
    tints = ["#6a533c", "#8a6e4c", "#b09a72", "#5d4c38", "#40342a"]
    prev = ground
    for i in range(len(tops) - 1):
        wob = (f.noise(5, 3, 300 + i, aspect=5.0) - .5) * .045
        edge = ground + tops[i] + wob
        nxt = ground + tops[i + 1] + wob
        band = (f.v >= edge) & (f.v < nxt)
        tex = f.noise(20 + i * 9, 5, 100 + i, aspect=5.0)
        lit = f.shade(f.smooth(tex, 1.8) * 38, strength=.7)
        c = rgb(col(tints[i])) * (.62 + .66 * lit[..., None])
        f.put(band, c, soft=1.0)
        # the seam between two beds
        f.put(np.clip(1 - np.abs(f.v - edge) / .004, 0, 1) * .5, rgb(col("#2e241a")), soft=.8)
        prev = edge

    # the saturated zone, filled to the water table
    top, bot = ground + tops[2], 1.0
    table = bot - (bot - top - .02) * lvl
    sat = f.v > np.asarray(table)
    k = np.clip((f.v - table) / np.maximum(1e-4, bot - table), 0, 1)
    body = rgb(col("#3ba7c9")) * (1 - k[..., None]) + rgb(col("#0d4a68")) * k[..., None]
    caustic = f.noise(30, 4, 13, aspect=3.0)
    body = body + (caustic[..., None] - .5) * .16
    f.put(sat, np.clip(body, 0, 1), soft=1.0)
    # the grains the water sits between
    grav = f.noise(90, 3, 17, aspect=1.0)
    grains = np.clip((grav - .62) * 6, 0, 1) * (f.v > top)
    f.put(grains * .35, rgb(col("#e6dcc6")) * (.7 + .5 * f.shade(f.smooth(grav, 1.1) * 60)[..., None]), soft=.7)
    # the table itself, which is a measurement
    f.put(np.clip(1 - np.abs(f.v - table) / .006, 0, 1) * .9, rgb(col("#cdeef8")), soft=.7)
    # the drawdown cone is easier to read with a dashed original level
    f.put(np.clip(1 - np.abs(f.v - float(np.max(table))) / .0025, 0, 1)
          * (np.sin(f.u * 190) > .1) * .45, rgb(col("#eaf7fb")), soft=.6)

    # a well down to it
    wx = float(np.random.default_rng(f.seed + 7).uniform(.2, .8))
    # pumping pulls the table down in a cone around the well
    table = table + np.clip(1 - np.abs(f.u - wx) / .3, 0, 1) ** 2 * .06 * lvl
    casing = (np.abs(f.u - wx) < .012) & (f.v > ground - .07)
    bore = (np.abs(f.u - wx) < .006) & (f.v > ground - .05)
    f.put(casing, rgb(col("#b9bdb8")), soft=.7)
    f.put(bore, rgb(col("#17323d")), soft=.6)
    f.put((np.abs(f.u - wx) < .035) & (np.abs(f.v - (ground - .085)) < .018), rgb(col("#9aa39b")), soft=.8)


# ------------------------------------------------------------------ glacier

def glacier(f, lvl):
    """A tidewater glacier: the valley floor is ice, the walls are rock, and the
    front stands in the water it calves into."""
    f.img[:] = sky_gradient(f, "#5ea8d8", "#dfeef5")
    cloud = f.noise(4, 5, 5, aspect=3.0)
    f.put(f.smooth(np.clip((cloud - .56) * 3.2, 0, 1) * np.clip(1.5 - f.v * 6, 0, 1), 5) * .8,
          rgb(col("#ffffff")), soft=0)
    hills(f, [(.18, .10, 1.8, "#8397ab", .5), (.27, .07, 3.0, "#5e7186", .3)])

    front = .58 + .16 * lvl                      # a glacier in balance reaches further
    valley = .30                                  # where the ice starts, under the peaks
    ice = f.noise(22, 5, 23, aspect=2.4)
    lit = f.shade(f.smooth(ice, 2.0) * 50, strength=1.0)
    # rock walls closing in from both sides, so the ice runs in a valley
    margin = .30 - .24 * np.clip((f.v - valley) / (front - valley), 0, 1)
    # the walls come down from the skyline, not from a ruled line
    brow = ridgeline(f, valley - .04, .045, 3.4, f.seed * 17 + 5)[None, :]
    wall = (f.v > brow) & (np.minimum(f.u, 1 - f.u) < margin)
    rockn = f.noise(15, 6, 31, aspect=2.2)
    rlit = f.shade(f.smooth(rockn, 2.0) * 60, strength=.9)
    f.put(wall, rgb(col("#5f5648")) * (.5 + .74 * rlit[..., None]) * (.72 + .5 * (1 - f.u)[..., None]), soft=1.2)

    body_m = (f.v > np.maximum(brow, valley - .02)) & (f.v < front) & (np.minimum(f.u, 1 - f.u) > margin)
    depth = np.clip((f.v - valley) / max(1e-4, front - valley), 0, 1)
    body = rgb(col("#dbeef7")) * (.74 + .46 * lit[..., None])
    body = mix(body, rgb(col("#68bcdc")), depth[..., None] * .4)
    f.put(body_m, np.clip(body, 0, 1), soft=1.2)

    # crevasses open across the direction of flow, wider near the front
    cre = np.sin((f.v - valley) * 54 + ice * 5 + (f.u - .5) ** 2 * 26) * .5 + .5
    f.put(np.clip((cre - .84) * 6, 0, 1) * body_m * (.3 + .7 * depth) * .8,
          rgb(col("#2f88ad")), soft=.9)
    # and the rubble the ice carries at its edges
    mor = np.clip(1 - np.abs(np.minimum(f.u, 1 - f.u) - margin) / .025, 0, 1) * body_m
    f.put(mor * .5, rgb(col("#6d6354")), soft=1.1)

    # the front: a cliff of ice standing in the water
    jag = .018 + .022 * f.noise(26, 3, 29, aspect=6.0)
    face = (f.v > front - jag) & (f.v < front + jag * .5) & body_m.any(axis=0)[None, :]
    face = face & (np.minimum(f.u, 1 - f.u) > margin)
    f.put(face, rgb(col("#eef9fc")) * (.82 + .3 * lit[..., None]), soft=.8)
    f.put(face & (f.v > front), rgb(col("#3c93b6")), soft=.9)

    sea = (f.v > front + jag * .5) | ((f.v > front) & (np.minimum(f.u, 1 - f.u) <= margin))
    water_body(f, sea, front, 1.0, "#59b6cf", "#0b4a63", chop=11.0)

    r = np.random.default_rng(f.seed + 3)
    ar = f.w / f.h
    for _ in range(int(r.integers(5, 10))):
        bx, by = float(r.uniform(.06, .94)), float(r.uniform(front + .06, .96))
        s0 = float(r.uniform(.02, .05)) * (.5 + (by - front) * 1.8)
        dx = (f.u - bx) / (s0 / ar)
        dy = (f.v - by) / (s0 * .55)
        berg = (np.abs(dx) + np.abs(dy) * 1.6 < 1) & (f.v < by + s0 * .3)
        f.put(berg, rgb(col("#eaf7fb")) * (.82 + .28 * np.clip(1 - dx, 0, 1)[..., None]), soft=.8)
        f.put(((np.abs(dx) < 1) & (f.v > by + s0 * .3) & (f.v < by + s0 * .9)) * .3,
              rgb(col("#cfe9f2")), soft=1.4)


# ------------------------------------------------------------- desalination

def desal(f, lvl):
    f.img[:] = sky_gradient(f, "#6cb0d8", "#f0e2c8")
    f.img += rgb(col("#ffd9a0")) * np.exp(-(((f.u - .62) ** 2) * 9 + ((f.v - .22) ** 2) * 26) * 4)[..., None] * .7
    horizon = .30
    water_body(f, f.v > horizon, horizon, 1.0, "#5fb2cd", "#0d4c69", sun_u=.62, chop=15.0)
    # distance eats the contrast of the sea near the horizon
    f.img += (rgb(col("#dbe9ee")) - f.img) * np.clip(1 - (f.v - horizon) / .09, 0, 1)[..., None] * .55
    # the sun lays a path across the water towards the viewer
    path = (np.clip(1 - np.abs(f.u - .62) / (.05 + (f.v - horizon) * .7), 0, 1)
            * np.clip(f.noise(34, 3, 67, aspect=9.0) - .42, 0, 1) * 3.4 * (f.v > horizon))
    f.put(np.clip(path, 0, 1) * .8, rgb(col("#fff2d8")), soft=1.0)
    shore = .84
    # surf breaking along the shore
    surf = f.noise(40, 4, 63, aspect=8.0)
    f.put(np.clip(1 - np.abs(f.v - (shore - .012)) / .022, 0, 1) * np.clip(surf * 1.6 - .3, 0, 1),
          rgb(col("#f2fbfd")), soft=1.0)
    apron = f.v > shore
    grit = f.noise(60, 4, 41)
    f.put(apron, rgb(col("#b9b09c")) * (.72 + .45 * grit[..., None]), soft=1.2)
    r = np.random.default_rng(f.seed + 11)
    n = int(r.integers(4, 7))
    wear = f.noise(70, 4, 52)
    for i in range(n):
        x0 = .07 + i * (.60 / max(1, n - 1)) + float(r.uniform(-.015, .015))
        wd, ht = float(r.uniform(.075, .115)), float(r.uniform(.24, .44))
        hall = (np.abs(f.u - x0) < wd / 2) & (f.v > shore - ht) & (f.v < shore)
        side = np.clip(.5 - (f.u - x0) / wd, 0, 1)            # lit on the left, shaded on the right
        body = rgb(col("#dce3e5")) * (.64 + .52 * side[..., None]) * (.9 + .2 * wear[..., None])
        f.put(hall, np.clip(body, 0, 1), soft=.8)
        # the membrane vessels stacked inside, seen as ribs
        vessels = np.sin((f.v - shore) * 190) * .5 + .5
        f.put(hall & (vessels > .68) & (f.v > shore - ht + .03), rgb(col("#b6c0c2")) * (.7 + .5 * side[..., None]), soft=.6)
        f.put(hall & (f.v < shore - ht + .014), rgb(col("#97a4a6")), soft=.6)
        if i % 2 == 0:                                        # a stack over every other hall
            st = (np.abs(f.u - (x0 + wd * .32)) < .006) & (f.v > shore - ht - .12) & (f.v < shore - ht)
            f.put(st, rgb(col("#c8d0d1")), soft=.6)
            f.put(st & (f.v < shore - ht - .1), rgb(col("#c4705a")), soft=.5)
    # a pipe rack tying the halls together
    f.put(np.clip(1 - np.abs(f.v - (shore - .03)) / .006, 0, 1) * ((f.u > .05) & (f.u < .72)),
          rgb(col("#aab5b7")), soft=.7)
    # the product tank: the share of the intake that leaves drinkable
    tx, tw, th = .82, .12, .34
    tank = (np.abs(f.u - tx) < tw / 2) & (f.v > shore - th) & (f.v < shore)
    f.put(tank, rgb(col("#e7ecee")), soft=.8)
    fill = .18 + .82 * lvl
    f.put(tank & (f.v > shore - th * fill), rgb(col("#3fb0cf")), soft=.7)
    f.put(tank & (np.abs(f.v - (shore - th * fill)) < .005), rgb(col("#c9f0fa")), soft=.5)
    # intake and brine outfall, running away from the viewer
    for x0, x1, c in ((.22, .34, "#c3ced1"), (.66, .78, "#d7c9b4")):
        t = np.clip((f.v - horizon - .05) / (shore - horizon - .05), 0, 1)
        line = np.clip(1 - np.abs(f.u - (x1 + (x0 - x1) * t)) / .012, 0, 1) * (f.v > horizon + .04) * (f.v < shore)
        f.put(line * .75, rgb(col(c)), soft=.9)


SCENES = {"Reservoir": reservoir, "Aquifer": aquifer, "Glacier": glacier, "Desalination": desal}


def main():
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.endswith(".svg"):
            os.remove(os.path.join(OUT, old))
    made = {}
    for row in read_sources():
        seed = sum(ord(c) * (i + 3) for i, c in enumerate(row["t"])) * 977
        f = Frame(W, H, seed)
        SCENES[row["c"]](f, row["lvl"])
        f.grade()
        name = row["t"] + ".jpg"
        f.save(os.path.join(OUT, name), quality=82)
        made[row["t"]] = "media/plates/" + name
    open(os.path.join(ROOT, "plates.js"), "w", encoding="utf-8").write(
        "/* Generated by scripts/plates.py. One rendered frame per source, built\n"
        " * from its class and its published fill level. A photograph in\n"
        " * media/sources/ takes its place.\n */\n\n"
        "const PLATES = %s;\n" % json.dumps(made, indent=2, sort_keys=True))
    total = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
    print("plates: %d, %.0f KB total, %.0f KB each" % (len(made), total / 1024, total / 1024 / len(made)))


if __name__ == "__main__":
    main()
