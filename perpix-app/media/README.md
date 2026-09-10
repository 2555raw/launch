# media

The 54-second teaser and the article about the app. Both are reproducible from
here; neither the rendered video nor the audio is committed, because a 9 MB
binary does not belong in a repository that is otherwise 300 KB.

## What is here

```
record.mjs          drives the app in a real browser and records four takes
cards.mjs           renders the overlay cards, so they carry the app's own type
music.py            synthesises the backing track
edit.py             cuts the takes to the music's grid and concatenates them
finish.py           overlays the cards, punches the section cuts, adds the track
inside-perpix.html  the article
```

## Making the video

It needs three things this repository does not carry: a browser, a full ffmpeg,
and the two fonts. The reasons are worth stating rather than hiding in a script.

- **A browser.** `record.mjs` uses Playwright and drives the real application —
  the video is the app being used, not a mockup. It also injects a pointer,
  because Playwright dispatches real mouse events but draws no cursor.
- **A full ffmpeg.** The one Playwright ships is video-only: no audio encoders
  and no transition filters. Any ffmpeg 6 or newer with `libx264`, `aac`,
  `zoompan` and `overlay` will do.
- **Inter and JetBrains Mono**, served locally. The app asks Google for them,
  and a recording made where that request fails is a recording of the fallback
  font. `record.mjs` answers the request itself, so the type in the video is the
  type in the app.

Then, roughly:

```bash
# serve the app and the fonts from one root, so /fonts/... resolves
python3 -m http.server 8899          # with app/ and fonts/ inside
node record.mjs                      # four takes into takes/
node cards.mjs                       # eight overlay cards into cards/
python3 music.py                     # music.wav
python3 edit.py                      # segs/cut.mp4
python3 finish.py                    # perpix.mp4
```

## Why the edit is written in beats

The track is 124 BPM, so a beat is 0.4839 s and a bar is four of those. The
segment table in `edit.py` is written in beats rather than seconds for one
reason: the cut is made to the music, not laid alongside it. The nine
perpetuals get half a bar each and the drop lands on the first of them, which is
arithmetic rather than luck.

## Two things about the track

It is synthesised, not licensed. I could not license a song, and shipping
someone else's would be worse than shipping none, so `music.py` generates one:
a four-on-the-floor kick, an offbeat hat, a plucked bass and an arpeggio over
i-VI-III-VII in A minor. Original and royalty-free, and it is not a hit. To use
a real track instead, drop it in as `music.wav` and re-run `finish.py` — nothing
else changes, though the beat grid in `edit.py` assumes 124 BPM and would want
re-timing.
