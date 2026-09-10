# media

The toolchain for the 54-second teaser. The rendered video and the audio are not
committed, because a 9 MB binary does not belong in a repository that is
otherwise 300 KB — everything needed to produce them again is here instead.

## What is here

```
record.mjs          drives the app in a real browser and records four takes
chrome.mjs          draws the desktop and the window the recording sits inside
cards.mjs           renders the overlay cards, so they carry the app's own type
music.py            synthesises the backing track
edit.py             cuts the takes to the music's grid and concatenates them
finish.py           frames it, tilts it, flashes the cuts, adds the cards and the track
```

## The window

`chrome.mjs` renders one 1920x1080 PNG: a desktop, a menu bar, and a window with
traffic lights — opaque everywhere except a hole exactly where the recording
goes. Overlaying it on top of the scaled recording gives rounded corners, a
title bar and a desktop in one composite, with no alpha mask to keep in sync.

Two things it does not do. There is no vendor logo on the menu bar and no
copy of anyone's wallpaper: the traffic lights and the rounded window are the
generic convention, and the desktop underneath is drawn here. And the window is
titled rather than given a URL bar, because a URL bar would have to show a
domain, and putting a domain in a video is a claim about who owns it.

The hole is not "a transparent div". The desktop is painted behind it, so a
transparent block still screenshots as desktop — the first attempt produced a
window with the wallpaper inside it. Everything is wrapped and clipped with an
even-odd `clip-path` instead, which punches the content rect out of every layer
at once.

## Seen from above

`finish.py` scales the framed composite 4% oversize, applies `perspective` with
the top corners pulled in, then crops back to frame. The oversize is the point:
a tilt opens up the corners, and without it they would be black. The amount is
deliberately small — the application is dense text, and a strong tilt trades
legibility for an effect.

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
node chrome.mjs                      # chrome.png, the desktop and the window
node cards.mjs                       # the overlay cards into cards/
python3 music.py                     # music.wav
python3 edit.py                      # segs/cut.mp4, at 1600x900
python3 finish.py                    # perpix.mp4
```

`record.mjs` takes the takes to record as an argument — `node record.mjs b`
re-records only the market — and writes each run's timing marks next to the
video. `edit.py` reads those marks, so a re-recorded take does not need any
timing edited by hand.

## Why the edit is written in beats

The track is 140 BPM, so a beat is 0.4286 s and a bar is four of those. The
segment table in `edit.py` is written in beats rather than seconds for one
reason: the cut is made to the music, not laid alongside it. The nine
perpetuals get a beat and a half each and the drop lands on the first of them,
which is arithmetic rather than luck.

Alternating shots are punched in with a centre crop rather than a zoom, so the
change from wide to tight happens on the beat instead of easing across it. Every
cut also gets a single white frame. That is what a flash cut is, and it is worth
saying how not to do it: `fade=t=in` renders every frame *before* its start time
as the fade colour, so four of them chained turned the first forty-six seconds
of the first version white.

## Two things about the track

It is synthesised, not licensed. A song could not be obtained here, and
shipping someone else's on an unverifiable claim would be worse than shipping
none, so `music.py` generates one: a clipped kick, a distorted saw bass on
sixteenths, an offbeat clap, and a snare roll into the drop, in F minor.
Original and royalty-free, and it is not a hit.

To use a real track instead, drop it in as `music.wav` and re-run `finish.py` —
nothing else changes. The beat grid in `edit.py` assumes 140 BPM, so a track at
another tempo wants `BEAT` changed there and the segments re-cut; that is one
constant and one script.
