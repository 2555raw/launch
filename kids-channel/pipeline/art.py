"""Illustrations for each scene, and the frames, thumbnail and vertical layout built from them.

Three ways to get an illustration, chosen by ART_PROVIDER (or automatically):
- openai: an image model, when OPENAI_API_KEY is set. Best looking, costs per image.
- svg:    Claude draws the scene as flat vector art, rendered locally. No extra key needed.
- basic:  a simple drawn background with the mascot. Offline, used for demos and as a last resort.
"""

import base64
import io
import os
import random
import unicodedata

import cairosvg
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .claude import ask_json
from .config import HEIGHT, ROOT, SHORT_HEIGHT, SHORT_WIDTH, WIDTH

FONT_PATH = ROOT / "assets" / "fonts" / "Fredoka.ttf"

SVG_SCHEMA = {
    "type": "object",
    "properties": {"svg": {"type": "string"}},
    "required": ["svg"],
    "additionalProperties": False,
}

SVG_SYSTEM = """You are an illustrator for a children's YouTube channel. You draw scenes as a single \
self-contained SVG document that will be rasterized to a 1920x1080 video frame.

Technical rules (the renderer is CairoSVG):
- Root element: <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">.
- Use only rect, circle, ellipse, path, polygon, polyline, line, g, defs, linearGradient, radialGradient, \
stop, use, and transform attributes.
- No <text>, <image>, <filter>, <foreignObject>, <style>, <script>, CSS animation, or external references.
- Fill the whole canvas: start with a full-size background.

Art rules: flat, rounded, friendly shapes; bright pastel palette with strong contrast between the \
subject and the background; one clear focal subject in the center area; the mascot drawn exactly as \
described every time; generous detail (at least 40 shapes) so the scene feels finished, not abstract; \
nothing scary."""


def provider() -> str:
    chosen = os.environ.get("ART_PROVIDER")
    if chosen:
        return chosen
    return "openai" if os.environ.get("OPENAI_API_KEY") else "svg"


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_PATH), size)
    f.set_variation_by_name("Bold")
    return f


def illustrate(config: dict, visual: str, out_png, kind: str | None = None) -> None:
    """Write a WIDTH x HEIGHT illustration of `visual` to out_png."""
    kind = kind or provider()
    if kind == "openai":
        try:
            img = _openai_image(config, visual)
        except Exception as e:  # fall through to Claude-drawn art rather than fail the episode
            print(f"    imagen OpenAI falló ({e}); uso SVG")
            return illustrate(config, visual, out_png, "svg")
    elif kind == "svg":
        img = _svg_image(config, visual)
    else:
        img = basic_scene(seed=hash(visual))
    img.convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS).save(out_png)


def _svg_image(config: dict, visual: str) -> Image.Image:
    prompt = f"""Mascot: {config['mascot']}
Style: {config['style']}

Draw this scene:
{visual}"""
    last_error = None
    for _ in range(3):
        try:
            svg = ask_json(SVG_SYSTEM, prompt, SVG_SCHEMA, effort="medium", max_tokens=32000)["svg"]
            png = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=WIDTH,
                                   output_height=HEIGHT, unsafe=False)
            return Image.open(io.BytesIO(png))
        except Exception as e:
            last_error = e
    print(f"    SVG falló 3 veces ({last_error}); uso el fondo básico")
    return basic_scene(seed=hash(visual))


def _openai_image(config: dict, visual: str) -> Image.Image:
    prompt = (f"{config['style']} Recurring mascot: {config['mascot']} Scene: {visual} "
              "No text, letters or numbers anywhere in the image. 16:9 composition.")
    r = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={"model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"), "prompt": prompt,
              "size": "1536x1024", "quality": os.environ.get("OPENAI_IMAGE_QUALITY", "medium"), "n": 1},
        timeout=300,
    )
    r.raise_for_status()
    data = base64.b64decode(r.json()["data"][0]["b64_json"])
    img = Image.open(io.BytesIO(data)).convert("RGB")
    # 1536x1024 is 3:2; crop the middle to 16:9.
    h = int(img.width * 9 / 16)
    top = (img.height - h) // 2
    return img.crop((0, top, img.width, top + h))


def basic_scene(seed: int = 0) -> Image.Image:
    """A cheerful landscape with the owl mascot, drawn without any API."""
    rnd = random.Random(seed)
    skies = [((135, 206, 250), (224, 247, 255)), ((255, 214, 165), (255, 245, 225)),
             ((190, 170, 255), (240, 232, 255)), ((150, 230, 200), (230, 255, 245))]
    top, bottom = rnd.choice(skies)
    img = Image.new("RGB", (WIDTH, HEIGHT))
    d = ImageDraw.Draw(img)
    for y in range(HEIGHT):
        t = y / HEIGHT
        d.line([(0, y), (WIDTH, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    d.ellipse((1500, 90, 1720, 310), fill=(255, 221, 87))
    for _ in range(3):
        x, y = rnd.randint(80, 1300), rnd.randint(60, 260)
        for dx, dy, r in ((0, 30, 55), (50, 0, 70), (110, 30, 55)):
            d.ellipse((x + dx - r, y + dy - r, x + dx + r, y + dy + r), fill=(255, 255, 255))
    d.ellipse((-300, 700, 1100, 1500), fill=(120, 200, 120))
    d.ellipse((800, 760, 2300, 1560), fill=(98, 180, 104))
    for _ in range(14):
        x, y = rnd.randint(40, WIDTH - 40), rnd.randint(860, 1040)
        c = rnd.choice([(255, 120, 150), (255, 200, 60), (140, 120, 255), (255, 255, 255)])
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=c)
    _owl(d, 960, 640, 1.0)
    return img


def _owl(d: ImageDraw.ImageDraw, cx: int, cy: int, s: float) -> None:
    def e(x0, y0, x1, y1, **kw):
        d.ellipse((cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s), **kw)
    lilac, light = (178, 140, 230), (226, 208, 250)
    e(-190, -230, 190, 230, fill=lilac)
    e(-120, -40, 120, 210, fill=light)
    d.polygon([(cx - 170 * s, cy - 190 * s), (cx - 120 * s, cy - 300 * s), (cx - 70 * s, cy - 215 * s)], fill=lilac)
    d.polygon([(cx + 170 * s, cy - 190 * s), (cx + 120 * s, cy - 300 * s), (cx + 70 * s, cy - 215 * s)], fill=lilac)
    for side in (-1, 1):
        x = side * 75
        e(x - 62, -150, x + 62, -26, fill=(255, 255, 255), outline=(250, 205, 40), width=int(14 * s))
        e(x - 26, -112, x + 26, -60, fill=(40, 30, 60))
        e(x - 8, -104, x + 6, -90, fill=(255, 255, 255))
    d.line((cx - 13 * s, cy - 88 * s, cx + 13 * s, cy - 88 * s), fill=(250, 205, 40), width=int(10 * s))
    d.polygon([(cx - 22 * s, cy - 20 * s), (cx + 22 * s, cy - 20 * s), (cx, cy + 16 * s)], fill=(255, 150, 60))
    d.rounded_rectangle((cx - 170 * s, cy + 40 * s, cx + 170 * s, cy + 100 * s), radius=int(28 * s), fill=(255, 140, 70))
    d.rounded_rectangle((cx + 60 * s, cy + 70 * s, cx + 120 * s, cy + 200 * s), radius=int(20 * s), fill=(255, 140, 70))


def plain(text: str) -> str:
    """Drop emoji and symbols the font has no glyph for (they would render as boxes)."""
    kept = "".join(c for c in text if unicodedata.category(c) not in ("So", "Sk", "Cs", "Co")
                   and c not in "\u200d\ufe0f")
    return " ".join(kept.split())


def _outlined_text(d, xy, text, f, fill=(255, 255, 255), stroke=(60, 30, 110), anchor="mm"):
    d.text(xy, text, font=f, fill=fill, stroke_width=max(4, f.size // 12), stroke_fill=stroke, anchor=anchor)


def _fit(d, text, max_width, start, minimum=40):
    size = start
    while size > minimum and d.textlength(text, font=font(size)) > max_width:
        size -= 6
    return font(size)


def frame(art_png, text: str, out_png) -> None:
    """The scene illustration with its big on-screen word(s) at the bottom."""
    img = Image.open(art_png).convert("RGB")
    text = plain(text)
    if text:
        d = ImageDraw.Draw(img)
        f = _fit(d, text.upper(), WIDTH - 300, 150)
        w = d.textlength(text.upper(), font=f)
        pad = 50
        box = (WIDTH / 2 - w / 2 - pad, HEIGHT - 230, WIDTH / 2 + w / 2 + pad, HEIGHT - 60)
        d.rounded_rectangle(box, radius=80, fill=(255, 255, 255), outline=(255, 180, 60), width=10)
        _outlined_text(d, (WIDTH / 2, HEIGHT - 145), text.upper(), f, fill=(255, 120, 60), stroke=(255, 255, 255))
    img.save(out_png)


def thumbnail(art_png, text: str, out_jpg) -> None:
    """1280x720, art filling the frame, huge outlined words on the right."""
    img = Image.open(art_png).convert("RGB").resize((1280, 720), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    text = plain(text).upper()
    words = text.split()
    lines = [" ".join(words[:2]), " ".join(words[2:])] if len(words) > 2 else [text]
    lines = [line for line in lines if line]
    f = min((_fit(d, line, 520, 170) for line in lines), key=lambda x: x.size)
    total = len(lines) * f.size * 1.05
    y = 360 - total / 2 + f.size / 2
    for line in lines:
        _outlined_text(d, (1000, y), line, f, fill=(255, 230, 60), stroke=(70, 30, 120))
        y += f.size * 1.05
    img.save(out_jpg, quality=92)


def vertical(art_png, title: str, out_png) -> None:
    """A 1080x1920 frame for Shorts: blurred fill, the art in the middle, title on top."""
    art = Image.open(art_png).convert("RGB")
    bg = art.resize((int(SHORT_HEIGHT * WIDTH / HEIGHT), SHORT_HEIGHT)).filter(ImageFilter.GaussianBlur(40))
    left = (bg.width - SHORT_WIDTH) // 2
    canvas = bg.crop((left, 0, left + SHORT_WIDTH, SHORT_HEIGHT))
    fg = art.resize((SHORT_WIDTH, int(SHORT_WIDTH * HEIGHT / WIDTH)), Image.LANCZOS)
    canvas.paste(fg, (0, (SHORT_HEIGHT - fg.height) // 2))
    d = ImageDraw.Draw(canvas)
    words, lines, cur = plain(title).split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if d.textlength(trial, font=font(96)) > SHORT_WIDTH - 120 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    lines.append(cur)
    y = 330 - (len(lines) - 1) * 55
    for line in lines[:3]:
        _outlined_text(d, (SHORT_WIDTH / 2, y), line, font(96))
        y += 110
    canvas.save(out_png)
