# Photographic finish: lens softness, bloom, gentle vignette, film grain.
import sys
from PIL import Image, ImageFilter, ImageChops
import random
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
soft = im.filter(ImageFilter.GaussianBlur(5))
base = Image.blend(im, soft, 0.42)                       # take the CG edge off
glow = im.filter(ImageFilter.GaussianBlur(28))
base = ImageChops.screen(base, Image.blend(Image.new('RGB', im.size, 'black'), glow, 0.22))  # bloom
W, H = im.size
vig = Image.radial_gradient('L').resize((W, H)).filter(ImageFilter.GaussianBlur(80))
vig = vig.point(lambda v: 255 - int(v * 0.10))
base = ImageChops.multiply(base, Image.merge('RGB', [vig] * 3))
noise = Image.effect_noise((W, H), 18).convert('RGB')
base = Image.blend(base, ImageChops.overlay(base, noise), 0.10)  # fine grain
from PIL import ImageEnhance
base = ImageEnhance.Color(base).enhance(1.18)
base = ImageEnhance.Contrast(base).enhance(1.06)
base.save(dst, quality=88)
print('saved', dst, base.size)
