# The film

A piece for Mauvya: title cards cut against footage of the real page, over an
original soundtrack. 1280x720, 30fps, H.264 + AAC.

```bash
# 1. stage a servable copy with the typefaces beside it, and serve it
python3 video/stage.py /tmp/mauvya-serve
cp video/card.html /tmp/mauvya-serve/
cd /tmp/mauvya-serve && python3 -m http.server 8899

# 2. shoot it
node video/cards.js   video/cards           # the titles
node video/capture.js video/raw             # all beats
node video/capture.js video/raw app docs    # or re-shoot some

# 3. cut it
python3 video/build.py video/raw video/cards video/mauvya.mp4
```

Needs `playwright`, `numpy` and `imageio-ffmpeg`, and a Chromium at
`$CHROMIUM` (default `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).

## The parts

| File | What it does |
| --- | --- |
| `stage.py` | Copies `public/` somewhere servable and pulls the Google faces down beside it. |
| `capture.js` | Drives the page and records a clip per beat. One context each, the terms gate answered before load, and a manifest of where each action starts. |
| `card.html` | The title cards, in the site's own type and palette. |
| `cards.js` | Screenshots one card per title. |
| `music.py` | Synthesises the soundtrack. |
| `build.py` | Normalises every clip, chains them with crossfades, writes the music to the length the picture came out at, and muxes. |

## Notes

**The music is original**, synthesised by `music.py` rather than sampled or
licensed: a minimal piece in E minor at 112 BPM built around a sonar ping,
arranged so the parts arrive as the picture does. Nothing in the film is anyone
else's audio.

**Fonts.** The page loads Instrument Serif, Archivo and IBM Plex Mono from
Google, which a recording environment behind a proxy may not reach; the footage
then comes out in Georgia and a system mono, which is most of the brand gone.
`stage.py` fetches the same faces once and rewrites the stylesheet link, so the
film is shot in the real type. `card.html` reads that same local stylesheet,
which is why it has to be served from the staged copy rather than opened on its
own.

**Smooth scrolling** is disabled during capture. The page sets
`scroll-behavior: smooth`, which turns every jump in the capture script into a
slow travel from the top of the document, and every shot then opens on the hero.

**The accent picker** is in the markup but hidden by the stylesheet, which
leaves the theme button as the only control on screen. The `theme` beat shoots
that instead.

**zoompan** counts `d` in output frames per *input* frame, so a looped still
needs `d=1` with the zoom driven by the frame counter. `d=frames` yields minutes
of video from one PNG.
