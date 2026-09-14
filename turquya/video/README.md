# The film

A 28 second piece for Turquya: title cards cut against footage of the real page,
over an original soundtrack. 1280x720, 30fps, H.264 + AAC.

```bash
# 1. serve a copy of the page, with the fonts local
cd <a directory holding index.html, card.html and the font files>
python3 -m http.server 8899

# 2. shoot it
SITE=http://127.0.0.1:8899/ node video/capture.js video/raw          # all beats
SITE=http://127.0.0.1:8899/ node video/capture.js video/raw tints    # or re-shoot one
CARD_URL=http://127.0.0.1:8899/card.html node video/cards.js video/cards

CAP_URL=http://127.0.0.1:8899/caption.html node video/overlays.js video/caps

# 3. cut it
python3 video/build.py video/raw video/cards video/turquya.mp4 video/caps
```

## The parts

| File | What it does |
| --- | --- |
| `capture.js` | Drives the page and records a clip per beat. One context each, the legal gate answered before load, and a manifest of where each action starts. |
| `card.html` | The title cards, in the site's own type and palette. |
| `cards.js` | Screenshots one card per title. |
| `caption.html` | The on-screen captions, transparent, same type and red. |
| `overlays.js` | Screenshots one PNG per caption. |
| `music.py` | Synthesises the soundtrack. |
| `build.py` | Trims every beat to a whole number of beats, chains them with hard cuts, writes the music to the length the picture came out at, and muxes. |

## Notes

**Every cut lands on a beat.** The soundtrack is 150 BPM, so a beat is exactly
0.4 seconds and exactly twelve frames at 30fps — which is the whole reason for
that tempo. `SEQUENCE` in `build.py` counts clip lengths in beats, never in
seconds. Twenty-five cuts in twenty-eight seconds, averaging 1.1s each; the
cuts are hard, because a crossfade on each of them would smear the edit into a
slideshow, and the cut landing on the kick is what makes it feel cut at all.

**The captions sit on the footage, not between it.** A title card costs a
second of the cut. A caption costs nothing, because the product is still on
screen underneath it — which is the point of a film that is meant to show the
thing working. `overlays.js` renders them to transparent PNGs in the site's own
type and red, and `build.py` composites one onto a shot with `overlay`.

**A shot can appear twice.** Two cuts taken from different seconds of the same
recording cost no extra footage and are most of what keeps the count up. The
`at` field in `SEQUENCE` picks how far into the beat's action window each one
starts.

**The music is original**, synthesised by `music.py` rather than sampled or
licensed: a minimal piece in A minor, arranged so the parts arrive as the
picture does — the floor drops at bar 3, which is the cut to the ticker.
Nothing in the film is anyone else's audio.

**The recorder paints 88 rows short.** Playwright hands back a canvas 1280x720
but the page only ever finishes painting the top 632 rows of it, so the raw
clips used to carry a neutral grey strip along the bottom. `capture.js` shoots
1280x808 and `build.py` trims the blind rows, which leaves a full 1280x720 of
real page at native resolution — nothing scaled, nothing lost off the sides.

**Time the beats from the context, not the page.** The recording starts when
the browser context does, not when the page loads. A manifest offset measured
from a later mark leaves `build.py` trimming from before the page has arrived,
and every shot then opens on an unscrolled, half-revealed hero.

**The storage keys carry the brand name.** `capture.js` answers the legal gate
by writing `<brand>-legal-v1` before the page loads. Rename the brand and
forget that line, and every shot comes out with the gate over it and every
click retrying against it until the beat times out.

**Fonts.** The page loads Familjen Grotesk, Public Sans and DM Mono from
Google, which a recording environment may not reach; the footage then comes out
in a fallback face. Serve the same faces from the same origin as the page and
point the stylesheet at them before shooting.

**Smooth scrolling** is disabled during capture. The page sets
`scroll-behavior: smooth`, which turns every jump in the capture script into a
slow travel from the top of the document, and every shot then opens on the hero.

**zoompan** counts `d` in output frames per *input* frame, so a looped still
needs `d=1` with the zoom driven by the frame counter. `d=frames` yields minutes
of video from one PNG.
