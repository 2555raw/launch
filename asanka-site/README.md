# Asanka — site

Online store for **Asanka**, a West African kitchen that sells hand-pounded fufu and
jollof rice: a menu with filters, a cart, delivery or pickup orders sent through WhatsApp,
and catering trays for events.

No build step, no dependencies. Plain HTML, CSS and vanilla JS. The site is in Spanish.

## Structure

```
index.html   the whole page: announcement bar, hero, menu, combo, how it works,
             our kitchen, catering, FAQ, closing call, footer and the cart drawer
styles.css   the design system (palette, type, layout), light/dark and the responsive rules
art.js       the dish illustrations (top-down SVG drawn in code) and the stickman
assets/      the profile picture: avatar.png (1000 px), avatar-400.png and its source
app.js       CONFIG and MENU, theme, navigation, filters, cart, checkout,
             catering quote, opening hours and the scroll reveal
```

## Run it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy it by dropping the folder on any static host (Netlify, Vercel, GitHub Pages,
Cloudflare Pages, Railway).

## How an order works

1. The customer adds dishes to the cart (it survives a reload through `localStorage`,
   wrapped in `try/catch`, so the page still works if the browser blocks storage).
2. In the drawer they pick delivery or pickup, a spice level, their details and a time.
   The times come from the opening hours in `CONFIG.hours`, starting 45 minutes
   from now for delivery and 25 for pickup.
3. "Revisar y enviar pedido" checks the form and shows a WhatsApp button that opens
   `wa.me` with the full summary (lines, subtotal, delivery fee, total, reference
   `AS-XXXXX`). It is a real link rather than `window.open`, so pop-up blockers and
   embedded viewers cannot swallow it. The business confirms from WhatsApp.

Delivery is free from `CONFIG.freeDelivery` (35 €), costs `CONFIG.deliveryFee`
(3.90 €) below that, and needs a minimum of `CONFIG.minDelivery` (15 €).

## Privacy and allergies

On the first visit a window asks two things before the page can be used:

- **Privacy.** "Aceptar y continuar" lets the page keep the cart, the allergies and the
  theme in `localStorage`. "Solo lo necesario" keeps them in memory for this visit only;
  the one thing written either way is the choice itself (`asanka-consent`). Name, phone
  and address are never stored: they only travel inside the WhatsApp message.
- **Allergies.** Chips for the allergens the kitchen uses (gluten, peanut, fish,
  shellfish, egg, dairy, sesame, soy). Every dish carries its `allergens`; a dish that
  contains one of the visitor's gets a warning badge, and a bar above the menu can hide
  them. The allergies also go into the WhatsApp order.

The footer's "Privacidad" and "Alérgenos" links, and "Cambiar" in the bar, reopen it.

## Vegan

The "Vegano" section and menu tab list the dishes flagged `vegan: true`: jollof vegetal,
the vegan groundnut soup and egusi, red red, kelewele, dodo and the drinks, plus a vegan
combo for two. They are cooked in separate pots; the copy says so, keep it true.

## Editing the menu

Everything the business changes lives at the top of `app.js`:

- `CONFIG`: currency and locale, WhatsApp number, phone, email, address, fees and
  opening hours per weekday.
- `MENU`: each dish with its category (`fufu`, `jollof`, `side`, `drink`), name, native
  name, price, spice level (0–3), `vegan`/`gf` flags, `popular` and the illustration
  (`art`).
- `EXTRAS`: the combo for two and the catering trays.

Illustrations are referenced as `fufu:<soup>` (`light`, `groundnut`, `palmnut`, `egusi`),
`jollof:<protein>` (`chicken`, `beef`, `fish`, `veg`), `side:<kelewele|dodo|shito|fufu>`,
`drink:<sobolo|ginger>` and `tray`. To use real photos, swap the `.as-card-art` contents
for an `<img>`.

## Design

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#FBF5EC` / `#F4EADB` | `#16100C` / `#1D1510` | cream ground and alternating bands |
| `--ink` / `--prose` / `--muted` | `#2A1A12` / `#4E3B30` / `#7A6152` | `#FBF1E4` / `#DCCAB8` / `#AB917D` | text |
| `--jollof` | `#C8391B` | `#FF7F57` | accent text: prices, links, active states |
| `--btn` | `#C8391B` | `#C8391B` | button fills; white on it clears 5.2:1 |
| `--palm` / `--leaf` | `#E9A23B` / `#2F6B3B` | `#E9A23B` / `#7CC08A` | supporting notes: gold and green |

Type: **Fraunces** for headings and prices, **Manrope** for the rest. The kente band
(`--kente`) is the only ornament. The theme follows the system until the visitor picks one.

## Before going live

- **The contact details are placeholders**: the WhatsApp number `34600000000`, the phone,
  `pedidos@asanka.example` and the address in `CONFIG`. The order goes to that number,
  so change it first.
- Prices, hours, the "45 min" and "0 conservantes" figures in the hero and the delivery
  radius in the FAQ are samples: confirm them.
- The social and legal links in the footer are still anchors to `#top`.
- There is no online payment: the site sends the order through WhatsApp and payment
  happens on delivery (cash, card or Bizum, as the FAQ says).
