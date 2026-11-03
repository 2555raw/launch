import sys
from PIL import Image, ImageFilter, ImageChops, ImageEnhance
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size; k = W / 1600
base = Image.blend(im, im.filter(ImageFilter.GaussianBlur(3 * k)), 0.35)
# bloom from the bright rims
bright = im.point(lambda v: max(0, v - 120) * 2)
glow = bright.filter(ImageFilter.GaussianBlur(22 * k))
base = ImageChops.screen(base, Image.blend(Image.new('RGB', im.size), glow, 0.55))
wide = im.filter(ImageFilter.GaussianBlur(60 * k))
base = ImageChops.screen(base, Image.blend(Image.new('RGB', im.size), wide, 0.12))
vig = Image.radial_gradient('L').resize((W, H)).filter(ImageFilter.GaussianBlur(120 * k)).point(lambda v: 255 - int(v * .28))
base = ImageChops.multiply(base, Image.merge('RGB', [vig] * 3))
base = Image.blend(base, ImageChops.overlay(base, Image.effect_noise((W, H), 16).convert('RGB')), 0.08)
base = ImageEnhance.Color(base).enhance(1.1)
base.save(dst, quality=88); print('saved', dst, base.size)
