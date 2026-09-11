# Ovanto

A static marketing site for a fictional product: passkey native wallet
infrastructure for Bitcoin and EVM, an Ordinals creator studio, and a
universal name (`ova.id`).

The design takes its cues from the developer infrastructure landing pages in
this category — near black ground, a centred hero, pill buttons and a metallic
product render — but every line of copy, every asset and all of the code here
is original. It is not affiliated with any existing company.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The whole page: hero, products, demo, developers, pricing, FAQ, footer |
| `styles.css` | Tokens, layout, the CSS keycap render, responsive rules |
| `app.js` | Smooth scrolling, mobile menu, code tabs, the wallet demo, the form |
| `assets/mark.svg` | The logo mark, also used as the favicon |

No build step and no dependencies. Open `index.html` in a browser, or serve
the folder:

```sh
python3 -m http.server --directory ovanto-site 8000
```

## Things to know

- **The demo mints nothing.** `app.js` generates addresses locally so the flow
  feels real offline. There is no network call anywhere on the page.
- **The signup form posts nowhere.** It validates the address and says so.
- **The numbers are placeholders.** Stats, pricing and the customer names in
  the marquee are invented for the layout.
- Fonts come from Google Fonts; the page falls back to system faces offline.
- The keycaps in the hero are CSS, not an image: a rotated slab with three
  `transform: translateZ` keys, so they stay sharp at any size.
