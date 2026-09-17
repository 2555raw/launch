#!/usr/bin/env python3
"""A plate for every reserve, cut from the photograph and its extension.

These are not photographs of Lake Mead or of the Ogallala. No image of those
places can be fetched from this machine and none is invented here: each plate
is a crop of the one photograph the project has, or of the landscape that was
rendered to continue from it, chosen so the kind of place is right. Water held
in a wooded valley for a reservoir, worked ground for an aquifer, cold water and
rock for a glacier, concrete and shore for a plant. The ticker picks the crop,
so no two are the same view.

Drop a real photograph in media/sources/<TICKER>.jpg and it takes the plate's
place everywhere. That is the way to get the real thing in here.

    npm run plates
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "media", "plates")
MEDIA = os.path.join(ROOT, "media")
W, H = 960, 600

# Regions worth cutting from, as fractions of each source frame. The world
# frame is 1600x6300 and holds the whole descent, so most of these are in it.
# Regions of the photograph worth cutting from. Everything here is the
# photograph itself: the rendered extension is softer than a photograph and it
# showed at card size, so the plates come out of the real frame.
REGIONS = {
    "Reservoir": [
        ("source", .62, .00, .99, .26),     # the reservoir above the wall
        ("source", .55, .06, .95, .38),     # the crest, its road and the water
        ("source", .74, .20, .99, .55),     # the arm of the lake behind it
        ("source", .30, .16, .64, .48),     # the face of the wall in shade
        ("source", .66, .30, .99, .62),     # water against the far bank
        ("source", .50, .00, .80, .22),     # the head of the reservoir
    ],
    "Aquifer": [
        ("source", .00, .16, .28, .52),     # the wooded slope
        ("source", .00, .50, .26, .92),     # forest lower down
        ("source", .26, .00, .56, .22),     # trees over the crest road
        ("source", .10, .28, .38, .66),     # canopy and rock
        ("source", .56, .70, .88, .99),     # the wooded shoulder by the track
        ("source", .02, .60, .30, .99),
    ],
    "Glacier": [
        ("source", .42, .24, .70, .58),     # the sheets leaving the gates
        ("source", .46, .30, .66, .52),     # the face of the spill
        ("source", .30, .50, .60, .80),     # the plunge pool and its mist
        ("source", .36, .38, .58, .64),
        ("source", .12, .74, .46, .99),     # white water over the basin
        ("source", .40, .20, .62, .44),
    ],
    "Desalination": [
        ("source", .62, .52, .98, .86),     # the apron, the track and the shore
        ("source", .55, .30, .90, .64),     # the crest running down to it
        ("source", .10, .72, .50, .99),     # the basin and its wall
        ("source", .70, .40, .99, .74),
        ("source", .26, .48, .52, .80),     # rock and structures below the dam
        ("source", .58, .18, .86, .48),
    ],
}

GRADE = {
    "Reservoir": dict(sat=1.0, bright=1.0, tint=None, k=0.0),
    "Aquifer": dict(sat=1.02, bright=1.02, tint="#c0a15a", k=0.05),
    "Glacier": dict(sat=0.32, bright=1.1, tint="#cfe2ee", k=0.24),
    "Desalination": dict(sat=0.86, bright=1.0, tint="#8fa7b4", k=0.1),
}


def read_sources():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    rows = [{"t": m.group(1), "n": m.group(2), "c": m.group(3)} for m in
            re.finditer(r'\{ t: "(\w+)",\s*n: "([^"]+)",\s*c: "([^"]+)"', src)]
    lv = dict((m.group(1), float(m.group(2))) for m in
              re.finditer(r"(\w+):\s*([\d.]+)", re.search(r"BASE_LEVEL\s*=\s*\{(.*?)\}", src, re.S).group(1)))
    for r in rows:
        r["lvl"] = lv.get(r["t"], .5)
    return rows


def cut(frames, spec, rng):
    """Take a crop of the named frame, jittered, and fit it to the plate."""
    name, x0, y0, x1, y1 = spec
    im = frames[name]
    fw, fh = im.size
    # jitter the window a little so two reserves on the same region differ
    jx = (x1 - x0) * .18
    jy = (y1 - y0) * .18
    x0 = max(0.0, x0 + float(rng.uniform(-jx, jx)))
    x1 = min(1.0, x1 + float(rng.uniform(-jx, jx)))
    y0 = max(0.0, y0 + float(rng.uniform(-jy, jy)))
    y1 = min(1.0, y1 + float(rng.uniform(-jy, jy)))
    box = [x0 * fw, y0 * fh, x1 * fw, y1 * fh]

    # keep the plate's aspect by growing the short side of the window
    want = W / H
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw / bh > want:
        need = bw / want
        cy = (box[1] + box[3]) / 2
        box[1], box[3] = cy - need / 2, cy + need / 2
    else:
        need = bh * want
        cx = (box[0] + box[2]) / 2
        box[0], box[2] = cx - need / 2, cx + need / 2
    box[0] = max(0, min(box[0], fw - 8)); box[2] = max(box[0] + 8, min(box[2], fw))
    box[1] = max(0, min(box[1], fh - 8)); box[3] = max(box[1] + 8, min(box[3], fh))

    crop = im.crop([int(v) for v in box]).resize((W, H), Image.LANCZOS)
    if rng.random() < .5:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    return np.asarray(crop, np.float32) / 255.0


def grade(img, sat, bright, tint, k, level):
    g = img.mean(axis=-1, keepdims=True)
    out = np.clip((g + (img - g) * sat) * bright, 0, 1)
    if tint:
        t = np.array([int(tint.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
        out = out * (1 - k) + t[None, None, :] * k
    # a reserve that is low reads drier and flatter than one that is full
    dry = (1 - level) * .28
    out = out * (1 - dry * .35) + np.array([.68, .62, .48], np.float32)[None, None, :] * dry * .35
    m = out.mean(axis=(0, 1), keepdims=True)
    return np.clip(m + (out - m) * (1.06 - dry * .2), 0, 1)


def vignette(img):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w - .5, yy / h - .5
    vig = 1 - .22 * np.clip((u * u * 2.2 + v * v * 1.5) * 1.6, 0, 1)
    return np.clip(img * vig[..., None], 0, 1)


def main():
    frames = {"source": Image.open(os.path.join(MEDIA, "source.jpg")).convert("RGB"),
              "world": Image.open(os.path.join(MEDIA, "world.jpg")).convert("RGB")}
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        os.remove(os.path.join(OUT, old))

    made = {}
    seen = {}
    for row in read_sources():
        seed = sum(ord(c) * (i + 3) for i, c in enumerate(row["t"])) * 977
        rng = np.random.default_rng(seed)
        pool = REGIONS[row["c"]]
        # spread the entries of a class over its regions before repeating any
        n = seen.get(row["c"], 0)
        seen[row["c"]] = n + 1
        img = cut(frames, pool[n % len(pool)], rng)
        img = grade(img, level=row["lvl"], **GRADE[row["c"]])
        img = vignette(img)
        out = Image.fromarray((img * 255).astype(np.uint8), "RGB")
        out = out.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))
        name = row["t"] + ".jpg"
        out.save(os.path.join(OUT, name), quality=82, optimize=True, progressive=True)
        made[row["t"]] = "media/plates/" + name

    open(os.path.join(ROOT, "plates.js"), "w", encoding="utf-8").write(
        "/* Generated by scripts/plates.py. One plate per reserve, cut from\n"
        " * media/source.jpg and media/world.jpg. Not a photograph of that place:\n"
        " * drop one in media/sources/<TICKER>.jpg and it takes over.\n */\n\n"
        "const PLATES = %s;\n" % json.dumps(made, indent=2, sort_keys=True))
    total = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
    print("plates: %d, %.0f KB total, %.0f KB each" % (len(made), total / 1024, total / 1024 / len(made)))


if __name__ == "__main__":
    main()
