# The film

A 37 second piece for Payence: title cards cut against footage of the real page,
over an original soundtrack. 1280x720, 30fps, H.264 + AAC.

```bash
# 1. serve a copy of the page (the flat snapshot is easiest)
npm run snapshot && python3 scripts/assemble-snapshot.py /tmp/serve/index.html
cd /tmp/serve && python3 -m http.server 8899

# 2. shoot it
node video/capture.js video/raw            # all beats
node video/capture.js video/raw monitor    # or re-shoot one
node video/cards.js video/cards

# 3. cut it
python3 video/build.py video/raw video/cards video/payence.mp4
```

## The parts

| File | What it does |
| --- | --- |
| `capture.js` | Drives the page and records a clip per beat. One context each, the gate and the notice answered before load, and a manifest of where each action starts. |
| `card.html` | The title cards, in the site's own type and palette. |
| `cards.js` | Screenshots one card per title. |
| `music.py` | Synthesises the soundtrack. |
| `build.py` | Normalises every clip, chains them with crossfades, writes the music to the length the picture came out at, and muxes. |

## Notes

**The music is original**, synthesised by `music.py` rather than sampled or
licensed: a minimal piece in A minor at 124 BPM, arranged so the parts arrive as
the picture does. Nothing in the film is anyone else's audio.

**Fonts.** The page loads Archivo and JetBrains Mono from Google, which a
recording environment may not reach; the footage then comes out in a fallback
face. Serve the same faces locally (`@fontsource/archivo`,
`@fontsource/jetbrains-mono` are dev dependencies) and inject the `@font-face`
rules into the served copy before shooting.

**Smooth scrolling** is disabled during capture. The page sets
`scroll-behavior: smooth`, which turns every jump in the capture script into a
slow travel from the top of the document, and every shot then opens on the hero.

**zoompan** counts `d` in output frames per *input* frame, so a looped still
needs `d=1` with the zoom driven by the frame counter. `d=frames` yields minutes
of video from one PNG.
