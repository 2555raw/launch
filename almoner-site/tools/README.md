# Hero render

`img/hero-glass.*` is a Three.js render made offline (`scene2.html`, `render2.js`, finished in `post2.py`): thick bevelled slabs with a custom glossy shader (volume shading, specular, glowing fresnel rims) in the Corody palette.
iridescence, a softbox studio environment) made offline, then finished in `post.py`
(lens softness, bloom, grain) and a final colour grade.

To re-render: `npm i three@0.170.0` in this folder, then `node render.js raw.png`
and `python3 post.py raw.png final.jpg`. These files are not served by the site.
