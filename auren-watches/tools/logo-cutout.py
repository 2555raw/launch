"""Prepares the AUREN logo files from the original artwork (auren-logo-original.png).

auren-logo.png           the full logo, background removed, at 3x
auren-symbol-<c>.png     the watch silhouette alone, in black, sand and white
"""
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

BRAND = Path(__file__).resolve().parent.parent / 'public' / 'brand'
src = Image.open(BRAND / 'auren-logo-original.png').convert('RGB')
big = src.resize((src.width * 3, src.height * 3), Image.LANCZOS)
a = np.asarray(big).astype(float)

# the grey around the note is #EDE8E4; flood it in from the edges
d = np.sqrt(((a - np.array([0xED, 0xE8, 0xE4], float)) ** 2).sum(-1))
bg = d < 12
H, W = bg.shape
outside = np.zeros_like(bg)
q = deque((y, x) for y in range(H) for x in (0, W - 1) if bg[y, x])
q.extend((y, x) for x in range(W) for y in (0, H - 1) if bg[y, x])
for y, x in q:
    outside[y, x] = True
while q:
    y, x = q.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < H and 0 <= nx < W and bg[ny, nx] and not outside[ny, nx]:
            outside[ny, nx] = True
            q.append((ny, nx))

# keep only the note itself: specks left in the grey are not part of the logo
inside = np.zeros_like(bg)
q = deque([(H // 2, W // 2)])
inside[H // 2, W // 2] = True
while q:
    y, x = q.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < H and 0 <= nx < W and not outside[ny, nx] and not inside[ny, nx]:
            inside[ny, nx] = True
            q.append((ny, nx))
outside = ~inside

mask = Image.fromarray(np.where(outside, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
logo = big.convert('RGBA')
logo.putalpha(mask)
logo = logo.crop(logo.getbbox())
logo.save(BRAND / 'auren-logo.png')
print('auren-logo.png', logo.size)

lum = np.asarray(big.convert('L')).astype(float)
sil = np.clip((120 - lum) / 80, 0, 1)
sil[outside] = 0
sm = Image.fromarray((sil * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
box = sm.getbbox()
for name, col in (('black', (0, 0, 0)), ('sand', (0xEF, 0xD5, 0xB2)), ('white', (0xF7, 0xF7, 0xF5))):
    im = Image.new('RGBA', big.size, col + (0,))
    im.putalpha(sm)
    im.crop(box).save(BRAND / f'auren-symbol-{name}.png')
    print(f'auren-symbol-{name}.png', im.crop(box).size)
