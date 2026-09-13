#!/usr/bin/env python3
"""Stages a servable copy of the page with its typefaces alongside it.

    python3 video/stage.py /tmp/mauvya-serve
    cd /tmp/mauvya-serve && python3 -m http.server 8899

The page pulls Instrument Serif, Archivo and IBM Plex Mono from Google. A
recording environment behind a proxy often cannot reach them, and the footage
then comes out in Georgia and a system mono, which is most of the brand gone.
This fetches the same faces once, rewrites the stylesheet link to the local
copy, and leaves everything else untouched.
"""

import pathlib
import re
import shutil
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
PUBLIC = HERE.parent / "public"

# A browser user agent, or Google serves the ttf fallbacks instead of woff2.
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/mauvya-serve")
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(PUBLIC, out)

    html = (out / "index.html").read_text(encoding="utf-8")
    m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/css2[^"]+)">', html)
    if not m:
        print("no google fonts link found, serving as is")
        print(out)
        return

    fonts = out / "_fonts"
    fonts.mkdir()
    css = fetch(m.group(1)).decode("utf-8")
    for url in sorted(set(re.findall(r"https://fonts\.gstatic\.com[^)]+", css))):
        name = url.rsplit("/", 1)[-1]
        (fonts / name).write_bytes(fetch(url))
        css = css.replace(url, name)
    (fonts / "fonts.css").write_text(css, encoding="utf-8")

    html = html.replace(m.group(0), '<link rel="stylesheet" href="/_fonts/fonts.css">')
    (out / "index.html").write_text(html, encoding="utf-8")
    print(f"staged {out} with {len(list(fonts.glob('*.woff2')))} font files")
    print(out)


if __name__ == "__main__":
    main()
