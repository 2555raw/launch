# PANDEMIK

An experimental web piece about the COVID-19 pandemic, built as a digital
installation rather than an informative site: a corrupted volume someone
recovers on an old machine and walks through, sector by sector.

Deaths → hospital → masks → vaccines → memory.

Opening the page puts three doors in front of you, in this order:

1. **The caution card**, film-rating style, before anything else loads: the piece
   flashes, glitches, shows illness, death and blood, and floor three is built to
   frighten.
2. **The cookie banner**, which sets no cookies, admits it sets no cookies, and
   asks for your immortal soul in the second checkbox. Accepting writes
   `SOUL: FORFEITED` in the corner of the screen and does nothing else. Rejecting
   works too, and the page carries on the same either way.
3. **The recovery sequence**, the old machine mounting the volume.

Then the menu, with two ways in:

- **Play PANDEMIK** — four floors of the sealed hospital, seen from the ceiling
  camera, with a task list on each one.
- **Read the archive** — the five records the game is built on, as one
  cinematic scroll.

## PANDEMIK

They sealed the building with you inside and you were exposed on the way in. The
reading in the corner of the screen is your infection and it only climbs. **One
dose of the vaccine is left in the hospital**, on the fourth floor, in a first
aid kit, inside one of twelve cabinets — and nobody wrote down which one. That
dose is the whole game: reach it and you live, and there is no other way out of
the building. Every floor hands you a short list of tasks; tick the list off and
the way up opens.

| | | |
|---|---|---|
| 01 | LOBBY | Bodies on the tiles, a reception desk and four lifts. Restart the generator, find the lift keycard in the drawers, call the one lift out of four that still answers. |
| 02 | WARD | An escape room: a note on the corridor wall says where the stairwell key is, and six lockers say it is not in them. |
| 03 | ICU | Something up here is still walking, and it paths around the beds after you. Find a blade in the theatre, put it down in three hits, then force the fire door. |
| 04 | STORES | Twelve cabinets across six rooms. Open them until the first aid kit turns up. Inside it is the dose. |

You walk at 46 px/s and it walks at 33, so you can always outrun it — you just
cannot stand still. If it reaches you, you die and the hospital resets: back to
the front doors with nothing in your pockets and one more on the death counter.
The five archive records are hidden on wall terminals along the way, optional
and worth finding.

### Playing it

Nothing has to be memorised. The controls sit on screen the whole time
(`WASD` or the arrow keys walk, `E` uses what you are stood in front of — hold it
for the slow jobs, tap it to swing the blade, `ESC` leaves a record). The task
list is top left and ticks itself off; the next thing to do is arrowed on screen
with its name, and blinks red on the plan in the bottom right. Each floor opens
with a card telling you where you are and how many tasks it wants.

It is meant to be finished, not to beat you: you walk at 46 px/s and it walks at
30, it stands still in the dark until you come within 120 px or pick up the
blade, a hit knocks it back and stuns it for a second, and the delivery log in
the fourth-floor corridor names the room the kit was signed into, so the twelve
cabinets become two or three.

### First clear takes 50% of the creator fees

Beat the four floors, post the clear on X with the coin's contract address, and
the **first verified post takes half the creator fees**. One winner, checked in
the order the posts land. The end screen carries your time and death count, has
a **POST IT ON X** button with the text already written, and asks for a public
wallet address so the payout has somewhere to go.

Paste the contract address once, at the top of `floor.js`:

```js
const COIN = { ticker: 'PANDEMIK', ca: '' };   // ← the CA goes here
```

Until it is filled in, the end screen says *CA to be announced* rather than
inventing one. Three things the page will not do: ask for a seed phrase or a
private key (it refuses anything that looks like one), pretend a payment
happened, or send your address anywhere — it has no server, so the claim is
copied to your clipboard and kept in `localStorage` for you to send on. Wiring it
to a real endpoint is a few lines in `floor.js` whenever you want it.

## How it is made

Everything inside the frame is drawn pixel by pixel on a **384 × 216** canvas
that the browser scales up without smoothing. No images, no web fonts, no
libraries: the type is a hand-written 5 × 7 bitmap face, and the beds, monitors,
faces and props are sprites or rectangles one pixel wide.

In the archive, each chapter turns its own scroll into a `0..1` progress value,
and that number is the whole script of the scene. On the floor, the same value
is how far you have held the read key.

```
index.html   the shell: startup, menu and the two modes
styles.css   the cabinet: CRT monitor, scan lines, file browser chrome, controls
engine.js    bitmap type, sprites, textures and the five scenes
archive.js   the archive — mounts the scenes on the scrolling chapters
floor.js     the game — four floor plans, camera, tasks, guide, pursuer, claim
main.js      caution card, cookie gate, startup, screen noise, one animation loop
build.js     bundles all of the above into dist/index.html
```

`engine.js` never touches the DOM: a scene is handed a canvas, a `0..1` progress
value and the time. That is why the same five scenes serve both modes.

## Open it

Any of these works — it is plain static HTML with no build step required:

```
open index.html               # straight from disk
npx http-server .             # or serve the folder
open dist/index.html          # the whole piece as one 85 kB file
```

`dist/index.html` is generated by `node build.js`: one self-contained file with
the stylesheet and every script inlined. Drop it on any host, or paste its
contents into a page of your own.

Wheel or swipe to move through the archive; keys `1`–`5` jump between sectors.
In PANDEMIK, `WASD` or the arrow keys walk, `E` uses whatever you are stood in
front of — hold it for the slow jobs, tap it to swing the blade — and `ESC`
leaves a record. Touch screens get a d-pad and an action button. The system
preference for reduced motion is respected.

## The five sectors

| | | |
|---|---|---|
| 01 | DEATHS / LOSSES | An empty room, a counter, and a field where each dot is a thousand people. |
| 02 | ISOLATION / HOSPITAL | An endless corridor in perspective, closed doors, failing fluorescents. |
| 03 | MASKS | Eighteen faces that arrive corrupted and are lost like damaged data. |
| 04 | VACCINES | An old game inventory: the items unlock, the certainty does not. |
| 05 | MEMORY | Thousands of pixels going out until one is left. |

The same five scenes are what the wall terminals play inside PANDEMIK, and
record 05 is the ending that runs once the vaccine is in you.

## The figures

They are material for the story, rounded and closed at 2023: around 7,010,000
deaths reported to the WHO, an excess mortality estimate of 14.9 million for
2020 and 2021, and more than 13,500 million doses administered. The page says
so in its own footer: it is a visual piece, not a data dashboard.
