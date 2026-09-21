# Crypto Kitchen — site

Landing page for **Crypto Kitchen**, a play-to-earn diner with its own token, `$SIZZLE`. The look
is a mobile cooking game (Cooking City, Cooking Madness): cream panels with a toasted border,
glossy pill buttons, gold coins, a teal counter and a plum night sky with warm lights.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the whole page: HUD/nav, hero, price ticker, menu (tokenomics), stations
             (features), Order Rush (the game), levels (roadmap), leaderboard, how to
             buy, FAQ, closing call and footer
styles.css   the game palette, the chrome (panels, buttons, coins, bars) and the
             responsive rules
app.js       navigation, the ticker and leaderboard data, the coin counter, the
             contract copy button and the Order Rush game
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host.

## Design

Everything is chunky and rounded; nothing is thin, grey or flat.

| Token | Value | Role |
| --- | --- | --- |
| `--night` / `--night-2` | `#2A1245` / `#3D1C63` | the dining room: page background, arcade screen |
| `--teal` / `--teal-deep` / `--teal-light` | `#3BC9C4` / `#1F8F8B` / `#A8F0E6` | counters: the hero counter, the teal section bands, the arcade counter |
| `--cream` / `--cream-2` | `#FFF6E0` / `#FFE7B3` | panels and their inner lip |
| `--toast` | `#8A4A1E` | every border and hard drop shadow |
| `--gold` / `--gold-mid` / `--gold-deep` | `#FFD23F` / `#F5A623` / `#C77800` | coins, kickers, the ticker, the HUD |
| `--red` / `--green` | `#F0433C` / `#4BE04A` | primary buttons (red = play/buy, green = go), the patience bar |
| `--orange` / `--pink` / `--purple` | `#FF8A1F` / `#FF5DA2` / `#7B4DD8` | station hues, customer faces, pizza slices |

Type: **Lilita One** for every heading, button and figure — outlined with a `paint-order: stroke`
stroke in the `--toast` brown, with a `text-shadow` fallback — and **Nunito** 700–900 for body copy.

Food is emoji, on purpose: it renders everywhere without an asset folder and reads as cartoon
at any size. The coin (`.coin`) is CSS: a radial gold disc, a dark bevel, a `$` stamped in.

## Order Rush (`app.js`)

A 60-second shift. Customers walk up wanting one or two dishes; tap the matching station (or
press `1`–`4`) and the dish cooks for a moment, then goes to the first customer waiting for it.
A full order pays the dish price plus a tip that shrinks as the patience bar drains; each serve
in a row raises the combo (×5 doubles the pay). A dish nobody is waiting for burns (−3). A
customer whose bar empties leaves and resets the combo.

Tunables live at the top of the game block: `DISHES` (emoji, cook time, pay), `SHIFT`,
`MAX_CUSTOMERS`, `PATIENCE`, `BURN_PENALTY`. Customers spawn faster and get less patient as the
shift goes on.

The score goes into the coin counter in the HUD and the best score under the arcade; both are
kept in `localStorage` (wrapped in `try/catch`, so a browser that blocks storage still plays).
The clock pauses while the tab is hidden. Nothing goes on-chain.

## Before going live

- **Every number is sample data**: the hero stats, the ticker prices, the APYs on the stations,
  the leaderboard and the contract address. The footer says so.
- The buy/chart buttons, the whitepaper, audit and social links are anchors.
- Motion respects `prefers-reduced-motion`: the float, bob, steam, ticker and pulse loops stop,
  and the scroll reveal renders complete on first paint.
