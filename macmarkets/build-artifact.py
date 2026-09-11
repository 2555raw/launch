#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file for publishing as an Artifact.

The Artifact host serves a single file and supplies its own <!doctype>, <html>,
<head> and <body>, so this writes the page content only, with the stylesheet and
script inlined.

    python3 macmarkets/build-artifact.py   ->   macmarkets/artifact.html
"""

import pathlib
import re

HERE = pathlib.Path(__file__).parent


def main():
    html = (HERE / "index.html").read_text()
    css = (HERE / "styles.css").read_text()
    js = (HERE / "app.js").read_text()

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
    body = body.replace('<script src="app.js"></script>', "").strip()

    # A viewer on the default "system" appearance gets no data-theme stamp, so the
    # explicit light palette is mirrored into a prefers-color-scheme block.
    light = re.search(r':root\[data-theme="light"\] \{.*?\n\}', css, re.S).group(0)
    mirrored = light.replace(':root[data-theme="light"]', ':root:not([data-theme="dark"])')
    css = css.replace(
        light,
        light + "\n\n@media (prefers-color-scheme: light) {\n" + mirrored + "\n}",
    )

    out = """<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
<noscript><style>.modal-layer,.stage,.dock{{display:none}}.nojs{{display:block!important}}</style></noscript>

<script>
/* Settle the appearance before the desktop paints. */
(function () {{
  var t;
  try {{ t = localStorage.getItem("markets.theme"); }} catch (e) {{ t = null; }}
  if (!t) t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
}})();
</script>

{body}

<script>
{js}
</script>
""".format(title=title, css=css.strip(), body=body, js=js.strip())

    target = HERE / "artifact.html"
    target.write_text(out)
    print("wrote", target, len(out), "bytes")


if __name__ == "__main__":
    main()
