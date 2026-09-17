"""Cut the mark down to the sizes the pages ask for.

A plain resize is wrong twice over. Alpha has to be averaged premultiplied,
or every half-transparent pixel drags a black fringe in behind it; and the
mark is a glass ring — thin bright strokes around a hollow middle — so at
36px an honest average of stroke and hole lands on grey, which is exactly
what the sidebar was drawing. Below a certain size the strokes need their
light back: gain lifts the colour, and body thickens the alpha, so the ring
still reads as a ring when it is smaller than a fingernail.

    python3 scripts/icons.py            # write the sizes
    python3 scripts/icons.py --preview  # and a sheet of them on the site's ground

The master stays untouched: logo.png is the artwork, everything else here
is derived from it.
"""
import sys, os
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(HERE, "..", "media", "brand")
MASTER = os.path.join(BRAND, "logo.png")
GROUND = (11, 21, 18)  # --bg, the sidebar's own floor

# Small enough that the strokes are thinner than a pixel get the most help.
STEPS = {32: (1.45, 1.34), 48: (1.40, 1.30), 64: (1.35, 1.25),
         128: (1.15, 1.10), 256: (1.0, 1.0), 512: (1.0, 1.0)}


def shrink(im, n, gain, body):
    a = np.array(im.convert("RGBA")).astype(np.float64) / 255.0
    rgb, al = a[..., :3], a[..., 3:]
    pre = np.concatenate([rgb * al, al], axis=2)  # premultiply, then average
    small = np.array(Image.fromarray((pre * 255).round().astype(np.uint8), "RGBA")
                     .resize((n, n), Image.LANCZOS)).astype(np.float64) / 255.0
    sa = np.clip(small[..., 3:], 0, 1)
    srgb = np.divide(small[..., :3], sa, out=np.zeros_like(small[..., :3]), where=sa > 1e-4)

    srgb = np.clip(srgb * gain, 0, 1)
    sa = np.clip(sa * body, 0, 1)

    out = np.concatenate([srgb, sa], axis=2)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")


def main():
    master = Image.open(MASTER)
    made = []
    for n, (gain, body) in sorted(STEPS.items()):
        im = shrink(master, n, gain, body)
        p = os.path.join(BRAND, f"logo-{n}.png")
        im.save(p, optimize=True)
        made.append((n, p, im))
        print(f"logo-{n}.png  {os.path.getsize(p):>7,} bytes")

    if "--preview" in sys.argv:
        sheet = Image.new("RGBA", (520, 120), GROUND + (255,))
        x = 20
        for n, _, im in made:
            for w in (36, n):
                if w > 72:
                    continue
                c = im.resize((w, w), Image.LANCZOS)
                sheet.alpha_composite(c, (x, 60 - w // 2))
                x += w + 14
        out = os.path.join(BRAND, "..", "..", "logo-sizes.png")
        sheet.resize((1040, 240), Image.NEAREST).save(out)
        print("preview:", os.path.abspath(out))


main()
