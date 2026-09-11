# Nomia — site

Static landing page for **Nomia**, the payment rail for autonomous agents: identity per agent,
spend policies and multi-rail settlement behind a single API.

No build step, no dependencies. Plain HTML, CSS and vanilla JS.

## Structure

```
index.html   the whole page: status strip, hero, stats, how it works, features,
             developers, dashboard, use cases, pricing, FAQ, closing call and footer
styles.css   the design system (palette, type, layout) and the responsive rules
app.js       theme, mobile menu, anchor navigation, active section, code tabs,
             scroll reveal and the per-agent spend mockup
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploy by dropping the folder on any static host (Netlify, Vercel, GitHub Pages, S3,
Cloudflare Pages).

## Design

Two palettes with two different jobs, and the split is the whole idea.

**The dusty-rose family is the brand ground.** The four bands of the swatch live in the CSS as
`--rose-1` … `--rose-4`. They set the page colour (a warm plum-black pulled from the same hue,
not a neutral grey), the rose-tinted body text and borders, the hero glow, the rail beside the
headline and the line across the top of the closing card.

**Electric green `#00E5A0` is the accent, and it only ever means money in motion:** live figures,
in-progress states, the primary button, the spend bars, keywords in the code. Nothing else is
allowed to be green — the moment the accent spreads across the page it stops meaning anything.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--rose-1` … `--rose-4` | `#A87377` `#C88A8C` `#E3ABA8` `#F7D6D2` | same | the swatch: glow, rail, step numbers, icons, tags |
| `--bg` / `--bg-alt` | `#150E0F` / `#1A1214` | `#FBF1EF` / `#F6E6E3` | page ground and alternating bands |
| `--card` / `--card-hi` / `--surface` | `#1F1719` / `#271D1F` / `#2E2225` | `#FFFFFF` / `#FDF6F5` / `#F3E1DE` | cards, hover state, tracks |
| `--ink` / `--prose` / `--muted` / `--dim` | `#FDF4F3` / `#DCC6C5` / `#B08C8D` / `#8A6668` | `#2B1B1D` / `#4A3234` / `#7A5C5E` / `#9C7B7C` | text, body copy, secondary, micro-labels |
| `--line` / `--line-hi` | `#2C1F21` / `#3F2D30` | `#EFDCD9` / `#DFC3BF` | borders and hover borders |
| `--accent-fill` | `#00E5A0` | `#00E5A0` | button and bar fills, in both themes |
| `--accent` | `#00E5A0` | `#00845F` | accent **text**: figures, links, keywords |

The two accent tokens exist for contrast, not for taste. Dark ink on `#00E5A0` clears 11:1, so the
electric green stays on the fills in both themes; but `#00E5A0` as small text on the blush ground
only reaches about 1.6:1, so accent type in the light theme drops to `#00845F`, which clears 4.5:1.

Type: **Inter** for everything and **JetBrains Mono** for figures, code and labels. Micro-labels
use `.nm-label` — 10.5px mono, uppercase, `0.16em` tracking.

## Interactive parts (`app.js`)

- **Theme** — dark by default, with a switch and `localStorage` memory (wrapped in `try/catch`, so
  a browser that blocks storage still renders the page).
- **Navigation** — `data-scroll="<id>"` on any element scrolls to that section with the nav height
  taken out; an `IntersectionObserver` marks the active link.
- **Mobile menu** — the burger drops the links below the bar.
- **Code tabs** — TypeScript, Python, cURL and MCP; they swap the panel and the filename in the
  console bar.
- **Dashboard** — `AGENTS` in `app.js` is the only source of per-agent spend: name, id, spent and
  ceiling. The bar fills to the percentage of the ceiling used.

## Animation

One entrance on scroll (`.nm-rise`), driven by an `IntersectionObserver`. The hidden state is
scoped to `.nm-js`, a class the script adds, so with no JS — or with `prefers-reduced-motion` —
the page renders complete on the first paint. Nothing loops.

This was deliberately **not** built with `animation-timeline: view()`: a `cover`-based range can
never complete for the sections at the bottom of the document, which left the closing call to
action permanently faded.

## Before going live

- **Every number is sample data.** The status strip, the stats block, today's summary and the
  `AGENTS` list are illustrative; the footer and the dashboard say so.
- "Get started", "Docs" and the legal links (`#legal`) are still anchors.
- The protocols in the compatibility strip (x402, AP2, MCP, USDC, SEPA Instant, ERC-4337) state an
  intent to be compatible, not signed agreements: confirm them before publishing.
- The fees (0.4% of settled) and the plan limits are placeholders.
