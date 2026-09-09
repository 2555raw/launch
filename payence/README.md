# Payence

Landing page for **Payence**, a fictional platform that gives AI agents their own financial layer:
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
tailwind.config.ts  the palette, the type scale, the radii: the whole identity
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
| `danger` | `#E5484D` | frozen and stopped states. A state colour, never the accent |
| `hair` / `hairStrong` | `#151515` at 12% / 22% | every border on the page |

Section kickers are set in Archivo (`.label`), not in mono. A tiny uppercase mono label above
every heading is one of the tells of a generated page. Mono stays where it means something:
figures, identifiers, code and card data. The hero carries no kicker at all: the page opens on
the headline.

Type: **Archivo** across the board (400–800, tightened to `-0.045em` at display sizes) with
**JetBrains Mono** for figures, identifiers, labels and code. One scale, defined in
`tailwind.config.ts` as `label / title / display / mega`; nothing is set off-scale.

Colour is assigned by role, not by decoration: coral only ever marks money in motion or live
state, violet only marks policy, green only marks approval. That is why the page reads as a
product rather than a template.

## Legal dialogs

`lib/legal.ts` holds the Terms of Service and Privacy Policy. Both documents are always in the
document and hidden when closed, so they are readable without JavaScript and indexable by
crawlers, and the flat snapshot opens them with a class toggle. Any element carrying
`data-legal="terms"` or `data-legal="privacy"` opens the matching dialog, so links can live
anywhere on the page without being wired up.

**The copy is a template written for a fictional product, and every dialog says so at the top.
It has not been reviewed by a lawyer. Replace it with text from counsel before launch, and
leave that notice in place until you do.**

## The cookie notice

`components/ui/CookieNotice.tsx` asks on arrival, bottom-left, and it is wired to something real:
allow it and the card you design in the hero (its name, colour and network) is still yours when
you come back; decline and nothing is written, and anything already stored is cleared. It is one
first-party entry in `localStorage` (`lib/consent.ts`), never sent anywhere.

A consent notice that stores nothing is a lie told politely. If you add anything else that
persists, put it behind `getConsent()` too, or change the copy.

## The terms gate

`components/ui/TermsGate.tsx` asks the visitor to accept before they use the site. Three decisions
worth keeping:

- **It waits.** Nothing interrupts the first frame. The dialog arrives once the visitor has
  scrolled past 520px, when they are actually reading rather than landing.
- **It dims, it does not cover.** The scrim is `bg-ink/45` with a 3px backdrop blur, so the page
  behind stays recognisable and the dialog reads as a layer over the product, not a door before it.
- **Declining is reversible.** The block screen always offers the way back to the terms. A gate
  that can lock someone out permanently is a bug, not a policy.

Acceptance is stored in `localStorage` (wrapped in `try/catch`, so a browser that blocks storage
simply asks again). Escape and backdrop clicks deliberately do nothing, because it is a choice
rather than a dismissal, and Tab is trapped inside the dialog while it is up.

## The example card

The virtual card in the hero is a live example rather than a picture of one: the cardholder line
is an input you can type your own name into, the allowlist chips can be removed and added, the
freeze switch works, and the palette re-colours the face.

The allowlist holds two kinds of rule, and the **Merchant / Category** toggle picks which one you
are writing: a merchant matches one payee, a category matches a whole class of spend the way a
card network's merchant category does, so "AI APIs" clears every model provider without naming
each one. Category rules carry a tag and the violet accent, because they are a different thing
from a named merchant and should not look identical to one.

The allowlist works both ways: removing a merchant drops it into an **Add back** row rather than
deleting it, so anything you take off can go straight back on with one click, including names you
typed yourself. `POOL` in `components/ui/CardPanel.tsx` seeds that row with a few merchants to try.

Card protection carries a light: green while the card is live, red once it is frozen, with the
badge and the button following it. That red is `danger` (`#E5484D`), a token kept deliberately
apart from `coral`. Semantic colour says what state something is in, and if it were the accent
you could no longer tell an alarm from a brand flourish.

The network is picked from a menu that shows each mark, and the mark you pick lands on the card
where a scheme mark sits. **Those networks are Payence's own, with marks drawn for this page.**
Real scheme marks (Visa, Mastercard, American Express and the rest) are registered trademarks,
and putting one on a card implies an issuing agreement that does not exist, so they are
deliberately not reproduced. If you license a scheme's brand assets, swapping one in is a single
component in `components/ui/CardNetworks.tsx`: keep the viewBox at 44×24 and draw in
`currentColor`, and the mark takes the colour of whatever face it lands on.

The face is driven by two custom properties, `--face` and `--ink`, set from `CARD_THEMES` in
`components/ui/CardPanel.tsx`. Everything on the card, from the chip to the rules to the muted
labels, takes its colour from `currentColor` at an opacity, so a new swatch is two hex values and nothing
else. That is also why the flat snapshot can re-colour the card by setting two variables instead
of swapping class lists across a dozen elements.

### Checking the snapshot

The snapshot's behaviour is a hand-written port of the components, so the two can drift: a
component can gain a control the port never learns about, and an edit to the port can delete
blocks of it without anything failing to build. `scripts/check-snapshot.js` drives the assembled
file through every interaction on the page:

```bash
npm run snapshot
python3 scripts/assemble-snapshot.py payence.html
node scripts/check-snapshot.js .
```

Every value it prints should be true or a real reading, and `errors` should be empty. Run it after
touching either side.

## Motion

Framer Motion, kept deliberately quiet:

- `Reveal`: one rise as an element enters the viewport, `once: true`, never a loop.
- Buttons lift 2px on hover and settle on press.
- Meters fill to the value they report, once, when they come into view.
- Tabs cross-fade, and the underline travels between them with a shared `layoutId`.
- The headline arrives a word at a time on load, and the accent line lands last.
- Figures count to their value the first time they reach the viewport, and the spend bars grow
  into place. Both render their final value on the server, so they are right with no JavaScript;
  the client resets them before the first paint, which is why `CountUp` uses a layout effect
  rather than an ordinary one, because an effect would let the final number flash first.
- The statement rule takes a few pixels of parallax. Nothing else moves on scroll.
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

The page can be flattened into one self-contained HTML file, which is useful for sharing
a link to the design without deploying the app:

```bash
npm run snapshot                                        # static export
python3 scripts/assemble-snapshot.py payence.html        # one file, CSS inlined
```

`NEXT_PUBLIC_SNAPSHOT=1` also changes two components: the platform tabs and the
FAQ render every panel with the closed ones `hidden`, instead of mounting only
the open one. A flat file has no React to mount the rest, and having the whole
content in the document is better for crawlers either way. The assembler then
inlines the stylesheet and restores the behaviour in ~120 lines of vanilla JS.

## Publishing

`npm run build:pages` exports the real app as static files, and
`.github/workflows/pages.yml` publishes them to GitHub Pages on every push to
`main`.

Two details that a project site needs and a root deploy does not: `BASE_PATH`
(the workflow sets it to `/<repo>`, and `next.config.mjs` feeds it to `basePath`
and `assetPrefix`, or every asset 404s), and `.nojekyll` (Jekyll drops
directories starting with an underscore, which is where Next puts everything).

To turn it on: **Settings, Pages, Source: GitHub Actions**. Pages needs the
repository to be public on the free plan.

For a host that serves from the root (Vercel, Netlify, a domain of your own),
leave `BASE_PATH` unset and the export works unprefixed.

## Before going live

- **Every figure is sample data**: the activity feeds, spend monitor, limits and stats. The
  footer and two panels say so on the page.
- The nav, footer and form submit are inert: the email form sets local state, it does not post.
- Merchant names in the mockups (openai.com, aws.amazon.com, vercel.com, datadoghq.com) are
  illustrative examples of an allowlist, not partnerships.
