---
name: HeldAt
description: Private bonds, sealed in your browser. A night hero that ripples out of the mark, over warm paper rooms that alternate with night bands, in a light and a dark theme.
colors:
  bg: "#f7f6f2"
  paper: "#ffffff"
  mist: "#f0efea"
  steel: "#e7e5df"
  ink: "#0d1016"
  ink-hover: "#1f232b"
  ink-2: "#2b303a"
  on-ink: "#ffffff"
  dim: "#555b66"
  dim-2: "#6b717c"
  line: "#e5e2db"
  line-2: "#d5d2ca"
  glass: "rgba(255, 255, 255, .86)"
  accent: "#2458e8"
  accent-soft: "#edf2ff"
  ok: "#0f8a43"
  ok-soft: "#e8f6ee"
  bad: "#c62f2f"
  bad-soft: "#fdeeee"
  warn: "#9a5b00"
  warn-soft: "#fff7e6"
  warn-line: "#f3d9a6"
  warn-ink: "#4d3200"
  dark-bg: "#0b0e14"
  dark-paper: "#12161f"
  dark-mist: "#171c26"
  dark-steel: "#1f2532"
  dark-ink: "#eef1f6"
  dark-ink-hover: "#ffffff"
  dark-ink-2: "#c9cfda"
  dark-on-ink: "#0b0e14"
  dark-dim: "#9ba3b2"
  dark-dim-2: "#8a93a3"
  dark-line: "rgba(255, 255, 255, .08)"
  dark-line-2: "rgba(255, 255, 255, .15)"
  dark-glass: "rgba(18, 22, 31, .82)"
  dark-accent: "#7aa2ff"
  dark-accent-soft: "rgba(122, 162, 255, .14)"
  dark-ok: "#4fd18e"
  dark-ok-soft: "rgba(79, 209, 142, .12)"
  dark-bad: "#ff7d7d"
  dark-bad-soft: "rgba(255, 125, 125, .12)"
  dark-warn: "#f2b552"
  dark-warn-soft: "rgba(242, 181, 82, .1)"
  dark-warn-line: "rgba(242, 181, 82, .3)"
  dark-warn-ink: "#f6d9a8"
  night: "#090b10"
  night-glass: "rgba(13, 17, 25, .72)"
  night-text: "#f2f4f8"
  night-soft: "#b4bccb"
  night-label: "#8d97a8"
  night-dim: "#7c8596"
  night-signal: "#9ec0ff"
  night-dot: "rgba(214, 222, 236, .12)"
typography:
  display:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.6rem + 4.6vw, 5.25rem)"
    fontWeight: 560
    lineHeight: 0.98
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.35rem + 2.6vw, 3.4rem)"
    fontWeight: 560
    lineHeight: 1.04
    letterSpacing: "-0.034em"
  figure:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2vw, 3.4rem)"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: "-0.012em"
  lead:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + .3vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Host Grotesk, Host Grotesk Fallback, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  mono-label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter: "32px"
  rail: "1180px"
  section: "clamp(88px, 7vw + 40px, 148px)"
components:
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  button-dark-hover:
    backgroundColor: "{colors.ink-hover}"
  button-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  button-soft:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-soft-hover:
    backgroundColor: "{colors.steel}"
  button-white:
    backgroundColor: "#ffffff"
    textColor: "{colors.dark-bg}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  button-white-hover:
    backgroundColor: "#e9edf4"
  button-outline:
    backgroundColor: "transparent"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  theme-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  hero-chip:
    backgroundColor: "rgba(255, 255, 255, .03)"
    textColor: "#d7dce6"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  hero-card:
    backgroundColor: "{colors.night-glass}"
    textColor: "#e9edf4"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
    width: "380px"
  hero-card-label:
    textColor: "{colors.night-label}"
    typography: "{typography.mono-label}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
    height: "46px"
  badge:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.dim}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-live:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  box:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "32px"
  fact:
    backgroundColor: "{colors.paper}"
    typography: "{typography.figure}"
    rounded: "{rounded.lg}"
    padding: "28px 26px 26px"
  verdict-true:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  verdict-false:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  banner-caution:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-ink}"
    rounded: "{rounded.lg}"
    padding: "14px 16px 14px 18px"
---

# Design System: HeldAt

## Overview

**Creative North Star: "The Night Vault"**

HeldAt opens at night. The landing hero is always night (#090b10), whatever the theme: a canvas field of small square dots, set on a 9px grid, swells in rings out of the mark with a faint eight-point modulation (the mark's own shape). The field is held quiet behind the headline so the words stay crisp, and every seal sends one blue ring outward. Floating dark-glass cards show live machinery: a seal receipt recomputed in the browser, the current Ethereum block read from a public node, and a signed statement. Below the hero the page settles into warm paper rooms (off-white ground, white paper, warm greys) that alternate with full-bleed night bands, so the night comes back for the leak and for the questions.

Density stays low and the pacing generous: a 1180px rail, large vertical breaks, hairline-ruled lists instead of boxed cards, pill controls and large soft radii. Depth is a few low ambient shadows under things that float. The user chose this look explicitly, modelled on a reference site (dark halftone hero, floating mono cards, a theme button, warm light sections alternating with dark ones). The mark is an eight-ray asterisk with filled V-shaped joints above and below the centre, drawn as a stroked path plus a filled path on a 100 grid.

Both themes are first-class. Light is warm paper; dark (chosen with the Theme button, or from the system until someone picks) swaps every surface token to blue-black, while the hero, the night bands and the closing band stay night in both.

**Key Characteristics:**
- An always-night hero with a square-dot ripple field radiating from the mark, quieter behind the headline.
- Warm paper rooms alternating with full-bleed night bands; one paper band for the token sheet.
- One signal blue for live or computed state; green only for a true proof; amber for not-proven and backup states.
- Host Grotesk for words; JetBrains Mono for bytes, and for the machine voice on night surfaces (the hero chip, uppercase tracked card labels, hex FAQ indices).
- Pill controls, hairline-ruled lists, large radii, shadows only under floating surfaces.
- Light and dark themes, both driven by the same token names.

## Colors

A warm paper-and-ink palette with a night layer, one blue as its live signal, and three semantic colours rationed strictly. Every surface token has a light and a dark value under the same name; the night layer is the same in both themes.

### Primary
- **Signal Blue** (accent; dark-accent in the dark theme): the only accent. It marks things that are live or computed: commitment hashes, the live dot in the hero note and the footer, the "detected" dot on wallet tiles, "Ready" wallet states, live badges, the focus outline and the field focus ring, the seal pulse ring in the hero field. It is never a button fill.
- **Signal Blue Wash** (accent-soft): halos around live dots, the input focus ring, live badges and ready states.
- **Night Signal** (night-signal, with dark-accent for dots): the blue as it appears on night surfaces: the receipt hash, a sealed seal, and the hero block card's live tick.

### Neutral (light theme)
- **Warm Ground** (bg): the page itself. Rooms that are not bands sit directly on it.
- **Paper** (paper): cards, facts, boxes, dialogs, inputs, the story stage and the token-sheet band.
- **Mist** (mist): first tonal step: hover fills, the active nav pill, the current chapter, the demo output pane, soft buttons, the tab track, badges, status notes and the footer.
- **Steel** (steel): second tonal step: soft-button hover, the sent badge, the footer wordmark, a typed but unbacked check tick.
- **Ink** (ink): headings and body text, primary buttons, the brand mark, active chapter and step numbers, the side rail's launch key, toasts. Text selection inverts to ink with on-ink text.
- **Ink Hover** (ink-hover): the dark button and rail launch item on hover.
- **On Ink** (on-ink): text and icons set on ink fills. White in light, blue-black in dark.
- **Ink Secondary** (ink-2): long-form reading text in prose, terms, status notes and field labels.
- **Dim** (dim): leads, captions, meta, inactive nav and tabs, table headers.
- **Dim Light** (dim-2): placeholders, inactive story steps, the hovered field stroke. Not for running text.
- **Hairline** (line) and **Hairline Strong** (line-2): rules, dividers and resting strokes; line-2 for field and light-button strokes, frames and dashed empty states.
- **Glass** (glass): the translucent fill of the floating nav and the side rail.

### Neutral (dark theme)
The dark theme maps each light token to its dark-* value: ground dark-bg, surfaces dark-paper, dark-mist and dark-steel, text dark-ink, dark-ink-2, dark-dim and dark-dim-2, translucent white hairlines, and dark-glass. Ink becomes near-white, so ink fills (the dark button, toasts, active numbers) turn light with dark-on-ink text, and their hover goes to pure white. Shadows switch to pure-black values.

### Night
- **Night** (night): the hero, the leak and FAQ bands, the closing band, the app icon ground and the browser theme colour. Theme-independent.
- **Night Glass** (night-glass): the floating hero cards, with a 1px white-10% border and 10px blur.
- **Night Text / Soft / Label / Dim** (night-text, night-soft, night-label, night-dim): nav text over the hero; the hero lead; the uppercase mono card labels and card meta; the grey second line of the headline and the hex FAQ indices.
- **Dot Field** (night-dot): the hero's square dots, from 12% up to 77% opacity across six intensity steps.

### Semantic
- **Proof Green** (ok on ok-soft): only a verification that returned true: the TRUE verdict, a passing check, the counterparty's proof in the story.
- **Exposure Red** (bad on bad-soft): exposure and failure: the leak table's exposed column and its scan line, the FALSE verdict, failed checks, invalid fields, expired badges, the danger item in menus, the "Public" tag in the story.
- **Caution Amber** (warn on warn-soft, stroked warn-line, text warn-ink): attention without failure: the backup banner, "Not proven" and "balance not checked" claims and checks, testnet notes.

### Named Rules
**The One Signal Rule.** Blue means live, computed or detected. If an element is not changing, verified or found in the browser right now, it is not blue. Actions are ink (or white on night), never blue.

**The Earned Green Rule.** Green appears only after a real proof returns true. Never use it for decoration, success toasts or "secure" claims. A typed, unbacked amount is never green: its tick is ink on steel.

**The Amber Is Not Red Rule.** Something unproven or unbacked is caution amber, not failure red. Red is for exposure and for things that are false or broken.

**The Night Is Fixed Rule.** The hero, the night bands and the closing band are night in both themes. Theme switching changes the rooms between them, never the night itself.

## Typography

**Display Font:** Host Grotesk (self-hosted variable 300 to 800, with a metric-matched Arial fallback)
**Body Font:** Host Grotesk
**Mono Font:** JetBrains Mono (self-hosted 400 to 600)

**Character:** One confident grotesk set tight and heavy at display sizes, relaxed in body text. The mono is the machine's voice: bytes, and the short labels on night surfaces that read like instrument readouts.

### Hierarchy
- **Display** (560, clamp 2.75rem to 5.25rem, 0.98, -0.038em): the single hero h1, held to about 12ch, white on night, its second line in night-dim grey.
- **Headline** (560, clamp 2rem to 3.4rem, 1.04, -0.034em): section h2s. Fixed smaller h2s are used for the wallet row (1.625rem), dialogs (1.75rem), boxes (1.375rem) and prose (1.5rem). App page h1s clamp from 2.4rem to 3.6rem.
- **Figure** (650, clamp 2.2rem to 3.4rem, 1, -0.045em): the large numbers on fact cards, with tabular figures.
- **Title** (560, 1.1875rem, 1.3, -0.012em): h3s, token-sheet terms and FAQ questions (18px). Story steps scale up to 1.9rem.
- **Lead** (400, clamp 1.0625rem to 1.25rem, 1.55, dim): one supporting paragraph under a heading, max 34em.
- **Body** (400, 1rem, 1.6, ss01 and cv11): running text, capped at 62 to 74ch.
- **Label** (500, 13 to 14.5px): nav links, field labels, table headers, meta and fine print, in sentence case.
- **Mono** (400, 12.5 to 15px, 1.5, ligatures off): hashes, salts, keys, addresses, block numbers, the code card, the verdict bit (600, 30px), the hero chip (13px) and FAQ indices (13px, 0x01 to 0x05).
- **Mono Label** (400, 11.5px, 0.08em tracking, uppercase, night-label): the head row of each hero card, split left and right (for example SEAL and SHA-256).

### Named Rules
**The Machine Voice Rule.** JetBrains Mono is for bytes (hashes, keys, salts, addresses, block numbers, signed text) and for the machine voice on night surfaces: the hero chip, card head labels and hex indices. Headings, buttons, body text and the fact figures stay in Host Grotesk with tabular figures.

**The Scoped Uppercase Rule.** Uppercase tracked mono is allowed only as the head label inside a hero or data card. It never sits above a section heading, never appears on paper rooms as a kicker, and never in Host Grotesk.

**The 560 Rule.** Headings, buttons, badges and emphasised UI share one weight (560). Heavier weights are kept for the brand name, amounts and verdicts (600) and fact figures (650).

## Layout

Content sits on a centred 1180px rail with a 16px gutter on mobile and 32px from 720px. Sections are separated by a fluid section space (88px to 148px). Full-bleed bands (night or paper) take the section space as both their top margin and their inner padding, and hold a split grid (0.9fr to 1.1fr). The hero grid is 1.1fr to 0.9fr with the copy left and the stacked cards right-aligned and staggered; the story is a sticky stage (6:5) beside four numbered steps; the facts are a four-column grid that drops to two at 900px; the films are 0.82fr to 1.5fr.

The page order alternates rooms: night hero, warm story, facts and wallets, night leak band, films and demo, the bond grid (a night panel of faint square cells drawn on a canvas; every few seconds one lights up blue with a ring and a typed seal-code tag, and a night-glass card with a mono label sits over its lower left; on phones the card drops below, solid), the paper token-sheet band, the night FAQ band, then a night closing card on the rail and a mist footer with a giant steel wordmark.

The nav floats 12px from the top as a 60px pill; under 960px its links collapse into a drawer, and under 560px the wallet and X buttons hide. From 1360px wide, once the hero is passed, the bar slides away and becomes a vertical icon rail at the left edge, centred vertically. Grids drop to one column at about 860 to 900px. On phones the hero mark and the code card hide, the cards stretch full width, and the dot field starts from the top corner at reduced strength. App pages start 128px down and use a pill tab bar with two-column panels.

## Elevation & Depth

The system is tonal first: ground, paper, mist and steel separate surfaces, and hairlines separate rows. Shadows are low and ambient, and only floating things use them: the nav, the side rail, the band card, dialogs, toasts, the active tab, the dark button, the story's floating pieces and the hero cards. On night surfaces depth comes from glass (translucent fill, blur, a white-10% hairline) plus one deep drop.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(11,13,18,.05), 0 6px 14px -8px rgba(11,13,18,.14)`): the nav pill, the drawer, the dark button, the active tab.
- **Lift** (`0 2px 4px rgba(11,13,18,.04), 0 24px 48px -28px rgba(11,13,18,.30)`): the side rail, toasts, menus, the story wallet.
- **Float** (`0 4px 10px rgba(11,13,18,.05), 0 40px 80px -40px rgba(11,13,18,.38)`): the band card, dialogs, the declined-page card, the story receipt.
- **Night Drop** (`0 30px 60px -30px rgba(0,0,0,.8)`): the hero cards over the dot field.
- In the dark theme Rest, Lift and Float keep their geometry and switch to pure-black alpha (.3/.5, .25/.7, .25/.8).

### Named Rules
**The Float-Only Shadow Rule.** A shadow means the surface floats over something. Inline containers such as boxes, facts, bonds, the explorer and the demo use a 1px hairline border, never a shadow.

## Shapes

Corners are generous and step with scale: 10px, 14px (fields, wallet items, menus), 20px (hero cards, facts, bonds, status notes, verdicts, the FAQ frame on night), and 28px (the bond grid, the player, the demo, boxes, dialogs, the story stage, the closing band). Every interactive control (buttons, nav, tabs, badges, the chip, the theme button, toasts) is a full pill; the side rail is a square-cornered (2px) column of 48px square cells. Strokes are 1px hairlines at rest and 1.5px on focus and invalid fields, drawn as inset box-shadows so geometry doesn't shift. Status dots are 6 to 8px circles with a 3 to 4px halo. The hero field is squares, not circles. The mark is round-capped strokes (6.4 on the 100 grid) with filled joints.

## Components

### Buttons
Calm, weighted pills that lift 1px on hover and press to .97 on click (easing cubic-bezier(.22,1,.36,1), no overshoot).
- **Shape:** full pill, 46px tall (40px small), 15px at weight 560.
- **Dark (primary on rooms):** ink fill with on-ink text and the Rest shadow; hover goes to ink-hover with a deeper drop. One per decision point.
- **Light (secondary on rooms):** paper fill with an inset 1px line-2 stroke; hover darkens the stroke to dim-2 and adds Rest.
- **Soft:** mist fill turning steel on hover, for in-context utility actions.
- **White (primary on night):** white fill with blue-black text and a soft white glow; hover #e9edf4. Used for the hero's Launch app.
- **Outline (secondary on night):** transparent, white text, inset white-22% stroke that strengthens to 60% on hover. The closing band's ghost button is the same idea at 30%.
- **Theme button:** a 40px outlined pill with a half-filled circle icon and the word "Theme"; it collapses to the icon below 1100px. It also lives in the side rail.

### Hero Chip
A single mono pill above the hero headline (13px, a white-14% inset stroke, a white live dot with a halo). It is a status line for the hero only, not a section kicker.

### Hero Cards (signature)
Dark-glass cards floating over the field, staggered right: a live seal receipt (amount, recomputing hash in night-signal, a seal that stamps blue), a live Ethereum block read from a public node (mono block number, a blue dot that flashes on each block), and a signed-statement snippet in mono. Each opens with an uppercase tracked mono head row divided by a white-8% hairline. They rise in with a blur-to-sharp fade and lift away as the page scrolls.

### Hero Field (signature)
A canvas of square dots on a 9px grid, sized and lit by a sine ripple in rings around the mark with an eight-point modulation, fading with distance and toward the headline. Drawn at 30fps only while visible; a seal sends one blue ring outward. The white mark sits at the ring centre and turns half a revolution per seal.

### Facts
Four paper cards (20px radius, hairline border) each with one large figure and a short dim caption of up to 22ch.

### Cards / Containers
- **Box:** paper, 28px radius, 1px hairline border, 32px padding (22px on mobile); the soft variant is mist with no border.
- **Bond / status / verdict / banner:** 20px radius. Bonds are paper with a hairline; status notes are mist; verdicts and the caution banner use their semantic wash.
- **Empty state:** dashed line-2 border, 20px radius, centred dim text.

### Inputs / Fields
- **Style:** paper, 14px radius, 46px minimum, inset 1px line-2 stroke turning dim-2 on hover. Labels sit above at 14px weight 500 in ink-2. Textareas use mono.
- **Focus:** inset 1.5px accent stroke plus a 4px accent-soft ring.
- **Error:** inset 1.5px bad stroke.

### Navigation
- **Floating pill nav:** glass fill with 16px blur, a hairline border and Rest, 60px tall. Links are 14.5px weight 500 in dim, ink on hover, the current one on a mist pill. Right side: X icon, Theme, Connect wallet (light), Launch app (dark).
- **Over the hero:** the same pill turns dark translucent (white 4% fill, white-10% border, no shadow); links go grey-to-white with white-8% pills, Launch app turns white and Connect wallet turns outline.
- **Side rail (1360px and up, after the hero):** a square-cornered column ruled like graph paper (8px grid in the line colour over glass, 2px corners): 48px square cells split by hairlines, a heavier rule between groups, the mark on top and the launch cell in ink at the bottom. The current section's cell turns mist with a 2px accent edge on its left; a 2px accent reading line runs down the right edge as the page scrolls. Labels slide out as square ink tags in uppercase mono.
- **Tabs (app):** a mist pill track; the selected tab is a paper pill with Rest.

### Ruled Lists (signature)
The wallet strip, token sheet, terms list and leak table are rows divided by hairlines, not boxed. The token sheet opens with a 1px ink rule. Wallet tiles divide with short vertical hairlines inset 22px and fill with mist on hover.

### FAQ on Night
A hairline-framed panel (20px radius, white 2% fill) of rows: a mono hex index (0x01 and on) in night-dim, the question in white, and a 28px circular toggle whose plus closes to a minus when open. Answers open in place by animating their height.

### Dialogs (terms gate, wallet picker)
A paper sheet card (560px max, 28px radius, Float) over a 42% ink backdrop with 6px blur, rising in with an 18px translate. A head, a scrolling body, and a foot with a hairline above where the buttons share the width.

### Film Player
Chapters beside a 16:9 player framed in line-2 with a 28px radius. The current chapter sits on mist with its number inverted to ink and a 2px ink progress line. Controls are 40px ink circles at 82% opacity.

## Do's and Don'ts

### Do:
- **Do** keep the hero, the leak and FAQ bands and the closing band on night (#090b10) in both themes.
- **Do** alternate warm paper rooms with full-bleed night bands; use the paper band for reference material such as the token sheet.
- **Do** use white pills for the primary action on night and ink pills on paper rooms; outline pills for the secondary on night, light pills on paper.
- **Do** keep blue for live or computed state: hashes being recomputed, the live block, detected wallets, ready states, the seal pulse, focus.
- **Do** use caution amber for not-proven, unbacked, backup and testnet states, and green only for a true proof.
- **Do** give hero and data cards an uppercase tracked mono head row (11.5px, 0.08em) and nothing else uppercase.
- **Do** separate list content with 1px hairlines instead of wrapping each item in a card.
- **Do** set surface and text colours through the CSS custom properties so both themes follow, and give any new surface token a dark value.
- **Do** use tabular figures for amounts, times, block numbers and fact figures.
- **Do** draw new imagery as flat SVG in the palette, clipped to the 28px radius.

### Don't:
- **Don't** use green for anything except a true verification result.
- **Don't** use red for unproven or unbacked states; that is amber.
- **Don't** fill buttons with the signal blue.
- **Don't** put shadows on inline containers. Shadows are for surfaces that float.
- **Don't** add uppercase tracked labels or eyebrows above section headings. Headings carry their sections alone; uppercase mono lives only inside cards.
- **Don't** let the hero theme-switch, or put the dot field anywhere but the hero.
- **Don't** use gradient fills on UI surfaces, neon glows or icon-card feature grids.
- **Don't** use easing that overshoots.
