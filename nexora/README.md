# Nexora — site

Landing page for **Nexora**, a fictional platform that gives AI agents their own financial layer:
virtual cards, spend policies, merchant locks and real-time transaction visibility.

Built as a brief-driven recreation of a fintech/AI landing structure, with an original identity.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion. No other runtime
dependencies.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build; the page prerenders as static
npm start
```

## Structure

```
app/
  layout.tsx        metadata (SEO/OpenGraph), fonts, skip link
  page.tsx          section order, and nothing else
  globals.css       base layer, the .shell/.label/.card component classes, reduced-motion
  icon.svg          favicon
components/
  ui/               Reveal, Button, Meter, Bits (Label + Status pills), VirtualCard
  sections/         one file per section, in page order
tailwind.config.ts  the palette, the type scale, the radii — the whole identity
```

## Design

An editorial layout on warm paper: hairline rules, wide margins, headlines set as large as the
grid allows, and a single loud colour. Black is used at full strength for surfaces and type, not
softened to grey.

| Token | Value | Role |
| --- | --- | --- |
| `canvas` | `#F4F1EA` | page ground, warm paper |
| `shell` | `#E8E3D8` | second surface: alternating bands and insets |
| `ink` | `#151515` | body type, and the ground for the dark sections |
| `muted` | `#66645F` | secondary copy, warm so it sits on the paper |
| `coral` | `#FF5C35` | the accent: money moving, live state, the one loud element |
| `violet` | `#6C63FF` | secondary accent, reserved for policy and machine decisions |
| `positive` | `#28A96B` | approved and healthy states |
| `hair` / `hairStrong` | `#151515` at 12% / 22% | every border on the page |

Type: **Archivo** across the board (400–800, tightened to `-0.045em` at display sizes) with
**JetBrains Mono** for figures, identifiers, labels and code. One scale, defined in
`tailwind.config.ts` as `label / title / display / mega`; nothing is set off-scale.

Colour is assigned by role, not by decoration: coral only ever marks money in motion or live
state, violet only marks policy, green only marks approval. That is why the page reads as a
product rather than a template.

## Motion

Framer Motion, kept deliberately quiet:

- `Reveal` — one rise as an element enters the viewport, `once: true`, never a loop.
- Buttons lift 2px on hover and settle on press.
- Meters fill to the value they report, once, when they come into view.
- Tabs cross-fade, and the underline travels between them with a shared `layoutId`.
- The hero card and the statement rule take a few pixels of parallax. Nothing else moves on scroll.
- The `LIVE` dot is the only looping animation on the page.

Every one of those is bypassed under `prefers-reduced-motion`, both in the components (via
`useReducedMotion`) and globally in `globals.css`.

## Accessibility

Skip link, one `h1`, semantic landmarks, real `button`/`a` elements throughout, `aria-expanded`
on the menu and the FAQ, `role="tablist"` with `aria-selected` and `aria-controls` on the platform
tabs, `role="progressbar"` with values on the meters, a labelled email input, and a coral
`:focus-visible` ring on everything focusable.

## Fonts

Loaded with a plain `<link>` to Google Fonts rather than `next/font`, so the production build
never depends on reaching Google's servers at build time. If you prefer self-hosted fonts, swap in
`next/font/local` and drop the link in `app/layout.tsx`.

## Publishing a flat snapshot

The page can be flattened into one self-contained HTML file — useful for sharing
a link to the design without deploying the app:

```bash
npm run snapshot                                        # static export
python3 scripts/assemble-snapshot.py nexora.html        # one file, CSS inlined
```

`NEXT_PUBLIC_SNAPSHOT=1` also changes two components: the platform tabs and the
FAQ render every panel with the closed ones `hidden`, instead of mounting only
the open one. A flat file has no React to mount the rest, and having the whole
content in the document is better for crawlers either way. The assembler then
inlines the stylesheet and restores the behaviour in ~120 lines of vanilla JS.

## Before going live

- **Every figure is sample data** — the activity feeds, spend monitor, limits and stats. The
  footer and two panels say so on the page.
- The nav, footer and form submit are inert: the email form sets local state, it does not post.
- Merchant names in the mockups (openai.com, aws.amazon.com, vercel.com, datadoghq.com) are
  illustrative examples of an allowlist, not partnerships.
