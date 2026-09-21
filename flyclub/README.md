# NEUROCLUB · 神经夜店

A digitized fruit fly works the bar of a nightclub. Pour beers, cocktails,
martinis and shots to the beat, under moving lights and lasers.
Pure front-end: HTML + CSS + vanilla JavaScript, no build step, no backend,
no assets. Open `index.html` and the club is open.

Bilingual: **EN / 中文** (toggle in the header, remembered between visits).

## The shift

- Customers walk up to the bar and ask for one of four drinks. Pour the right
  one before their patience bar runs out.
- A correct pour builds your **combo** (a tip multiplier up to ×3) and the
  crowd's **hype**; the wrong glass spills and resets the combo.
- Fill the hype bar → **SHOT ROUND**: everyone wants shots, tips double, the
  lasers go wild and the strobe kicks in.
- Fill the dopamine bar → **NEURAL OVERDRIVE**: double tips for 15 seconds.
- Keyboard: `1` beer · `2` shot · `3` cocktail · `4` martini.
- Best tips, best combo and total served are kept in `localStorage`.

## The club is all CSS

Nothing here is an image or a video:

- Five coloured light beams sweeping on independent cycles, and a six-line
  laser fan that speeds up during a shot round.
- A mirror ball built from a repeating conic gradient, with glints scattered
  across the viewport.
- Drifting haze, pulsing speakers, a perspective dancefloor whose grid scrolls
  and cycles hue, and a crowd of silhouettes bobbing on the beat.
- Neon bar edge, glowing bottle wall, flickering `OPEN BAR` sign.
- A strobe that fires on the downbeat while the shot round is running.

## The sound is synthesized live

There are no audio files. Pressing **Music on** starts a WebAudio graph that
schedules a 124 BPM four-on-the-floor: a pitch-swept sine kick, filtered noise
hats and claps, a sawtooth bassline through a decaying lowpass, and square-wave
stabs during shot rounds. A lookahead scheduler queues sixteenth notes and the
downbeats drive the visual pulse, so the club breathes with the track. With the
music off, the same pulse runs from a plain timer — the lights never stop.

## The fly

Drawn as inline SVG: compound eyes with a hex overlay, connectome-coloured
wings that flap on a 160 ms cycle, a thorax with synapse lines that fire, a bow
tie, and six limbs working a cocktail shaker on the beat. It reacts to every
pour, spill and walked-out customer, in whichever language is selected.

Inspired by the viral thread about the digitized fruit-fly connectome — the one
where the simulated fly supposedly drinks beer, trades crypto and plays DOOM.
This page is a toy, not a simulation, and is not affiliated with that research.

## Files

```
flyclub/
├── index.html   structure + the fly's inline SVG
├── styles.css   the whole club: lights, lasers, crowd, floor, UI
├── app.js       game loop, drinks, meters, WebAudio, i18n
└── README.md
```

`window.NeuroClub` exposes `state()`, `queue()`, `pour()`, `spawn()`,
`shotRound()`, `overdrive()` and `setLang()` for poking at it from the console.
