# PayLink, version 1.1

Static site for **PayLink**: launch a coin on Pons and point its creator fees at any PayPal or
Venmo address. Every trade pays real dollars into that account, and the person getting paid
never holds a wallet.

Rebuilt from the reference screenshots, page for page, with one change: the accent is orange
instead of green.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html     home: hero, who can be paid, why PayPal, tokens and merchants, what PYUSD does,
               the fee flow, the calculator, three steps, straight answers, the notice
launch.html    the launch form
link.html      link a token you already launched
explore.html   every linked token, with a filter (the top bar search lands here)
fees.html      what PayLink charges, the platform address, every transfer
proof.html     the seven live checks, fees sitting in the escrow, the contracts touched
docs.html      how it works, finding your PYUSD address, what can go wrong, contracts
styles.css     the design system (palette, type, shell, cards) and the responsive rules
app.js         stamps the sidebar and top bar on every page; theme, Ctrl K search,
               the calculator, the demo forms, the scroll reveal
favicon.svg    the link mark
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Design

A near-black app shell: a fixed sidebar, a top bar with search, and one reading column of cards.

| Token | Value | Role |
| --- | --- | --- |
| `bg` | `#0A0A0A` | page ground |
| `card` | `#121212` | every card |
| `surface` | `#1B1B1B` | active nav item, icon squares |
| `line` | `#222222` | every border |
| `accent` | `#FF8A1F` | the orange: the primary action, money, active state |
| `blue` | `#5B8CFF` | the 80% branch, the "a friend" pill |
| `violet` | `#9A7BFF` | the "a group" pill |
| `warn` | `#F0B23A` | the 20% branch, the notice, the "taken so far" figure |

Type: **Inter** for everything, **JetBrains Mono** for addresses, figures and labels. The
light palette deepens the orange so small accent text still clears 4.5:1 on the paper ground.

## Honest limits

The site has no backend. The fees and proof pages show the snapshot the reference was taken
from; the launch and link forms validate the address and stop there, and "Connect wallet"
asks the browser wallet for an account if one is installed. Wiring those up to Pons and the
payout worker is the next version.
