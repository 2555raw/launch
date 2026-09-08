# Demo video

`blendify-demo.mp4` — a 25 second tour of the landing page: 1440×900, H.264, AAC stereo.

The run drives a real Chromium over `../blendify-site` with a cursor drawn into the
page, and clicks through the interactive parts in order:

1. the hero trade-sizing pills (10 ETH, then 0.5 ETH) — the legs re-price
2. **Launch the app**, which scrolls down to the index builder
3. the builder chips — AAPL and TSLA in, BTC out, weights re-splitting each time
4. a scroll down to the calculators
5. the gas assumption (3 then 5 assets) and the leverage pills (5x)
6. back to the top, onto the X button in the nav, which opens
   `https://x.com/useBlendify` in a new tab

## The music

`make-music.js` writes the bed as `music.wav`. Every voice is synthesised in the
script — pad, plucked arpeggio, bass, kick, hats and a small reverb — so there is
no sample and no licence attached to it. Ten bars of 4/4 at 96 BPM over
Am7 – Fmaj7 – Cmaj7 – G – Am7, arranged to enter under the opening shot, fill out
across the middle, and thin back out over the closing one. It sits at about
-16 LUFS in the video; change `MUSIC_GAIN` in `record-demo.js` to move it.

The generator is seeded, so the same track comes out of every run.

## Re-recording

```bash
cd demo
npm install
sh fonts/fetch.sh     # optional, but keeps the first second from being unstyled
npm run demo
```

`npm run demo` writes `music.wav` on its first run and reuses it after that; delete
it to re-render, or run `node make-music.js` on its own while tuning the track.

The script serves the site itself on port 8123 (override with `PORT`), records, then
trims and re-times the capture to exactly 25 seconds.

## Two things worth knowing about the capture

Playwright writes one screencast frame per paint, so a heavy page produces a video
that runs slower than the wall clock — timings taken while driving the page do not
map onto the file. Both cut points are therefore read back out of the recording:
the first scene change for the head, the last frozen stretch for the tail.

That frozen tail exists because clicking the X link opens a new tab, which
backgrounds the page and stops the capture. The destination card is put up
*before* the click for the same reason.
