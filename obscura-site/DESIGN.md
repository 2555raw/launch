---
name: Obscura
description: Private bonds, sealed in your browser. A private-banking vault rendered as a calm white product page.
colors:
  paper: "#ffffff"
  mist: "#f4f5f7"
  steel: "#e8eaef"
  ink: "#0b0d12"
  ink-2: "#2b303a"
  dim: "#555d6b"
  dim-2: "#6c7482"
  line: "#e4e7ec"
  line-2: "#d3d7df"
  accent: "#2458e8"
  accent-soft: "#edf2ff"
  ok: "#0f8a43"
  ok-soft: "#e8f6ee"
  bad: "#c62f2f"
  bad-soft: "#fdeeee"
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
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  button-dark-hover:
    backgroundColor: "#1c2029"
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
---

# Design System: Obscura

## Overview

**Creative North Star: "The Quiet Vault"**

Obscura is a private-banking vault rendered as a calm white product page. The material comes from the vault photographs: paper white, cool steel greys, and near-black ink. Real safe-deposit boxes carry the metaphor. The mechanism is shown live: a commitment hash that recomputes in the browser and appears in the one signal blue. Everything else stays quiet so the hash and the proof can be the only things that announce themselves.

Density is low and the pacing is generous. Sections sit on a 1180px rail with large vertical breaks, and lists are ruled with hairlines instead of being boxed into cards. Controls are pills, media get large soft radii, and depth is a few low ambient shadows under floating things such as the nav, the receipt, dialogs and the photograph. The world turns down the category's dark neon crypto page and the icon-card feature grid.

The same world carries into the app pages (console, verify, terms, declined) and into the explainer films, which reuse the same type pairing and roles.

**Key Characteristics:**
- Paper white ground; mist and steel greys for tonal layering; ink for actions.
- One signal blue (#2458e8) for things that are live, computed or detected.
- Green appears only on a true proof. Red appears only for exposure and failure.
- Host Grotesk for every word; JetBrains Mono only for hashes, bytes and addresses.
- Pill controls, hairline-ruled lists, large radii on media and containers.
- Real photographs credited in place, never illustrations or stock icons.

## Colors

A near-monochrome paper-and-steel palette, with one blue as its live signal and two semantic colors that are rationed strictly.

### Primary
- **Signal Blue** (accent): the only accent. It marks things that are live or computed: the receipt and demo commitment hashes, the hero's live dot, the "detected" dot on wallet tiles, "Ready" wallet states, live badges, the focus outline and the focus ring on fields. It is never used as a button fill.
- **Signal Blue Wash** (accent-soft): the halo around live dots, the input focus ring, and the background of live badges and ready states.

### Neutral
- **Paper** (paper): page ground, cards, dialogs, inputs, and the text on ink surfaces.
- **Mist** (mist): first tonal step. Used for hover fills, the active nav pill, selected film chapters, the demo output pane, soft buttons, the tab track, badges and status notes, and the declined page's background.
- **Steel** (steel): second tonal step. Used for the soft-button hover, the photo placeholder and the "sent" badge.
- **Ink** (ink): all headings and body text, primary buttons, the brand mark, the active chapter number, the closing band and toasts. Text selection inverts to ink.
- **Ink Secondary** (ink-2): long-form reading text in prose, terms and status notes, and field labels.
- **Dim** (dim): leads, captions, meta, inactive nav and tabs, and table headers.
- **Dim Light** (dim-2): placeholders and the border on hovered fields and light buttons. Not for running text.
- **Hairline** (line): every ruled list, table row, divider and resting card border.
- **Hairline Strong** (line-2): resting field and light-button strokes, the player and demo frames, and dashed empty states.

### Semantic
- **Proof Green** (ok) on **Proof Wash** (ok-soft): only the TRUE verdict of a verification.
- **Exposure Red** (bad) on **Exposure Wash** (bad-soft): the "Anyone can see" column in the leak table, the FALSE verdict, and invalid fields.

### Named Rules
**The One Signal Rule.** Blue means live, computed or detected. If an element is not changing, verified or found in the browser right now, it is not blue. Actions are ink, not blue.

**The Earned Green Rule.** Green appears only after a real proof returns true. Never use it for decoration, success toasts or "secure" claims.

## Typography

**Display Font:** Host Grotesk (self-hosted variable 300 to 800, with a metric-matched Arial fallback)
**Body Font:** Host Grotesk
**Mono Font:** JetBrains Mono (self-hosted 400 to 600)

**Character:** One confident grotesk set tight and heavy at display sizes, relaxed and open in body text. The mono is a material: it appears only where the content really is bytes.

### Hierarchy
- **Display** (560, clamp 2.75rem to 5.25rem, 0.98, -0.038em): the single hero h1, held to about 11ch.
- **Headline** (560, clamp 2rem to 3.4rem, 1.04, -0.034em): section h2s. Smaller fixed h2s are used for the wallet row (1.625rem), dialogs (1.75rem), boxes (1.375rem) and prose (1.5rem). App page h1s are clamped from 2.4rem to 3.6rem.
- **Title** (560, 1.1875rem, 1.3, -0.012em): h3s, token-sheet terms and FAQ summaries (18px).
- **Lead** (400, clamp 1.0625rem to 1.25rem, 1.55, dim): one supporting paragraph under a heading, max 34em.
- **Body** (400, 1rem, 1.6, stylistic sets ss01 and cv11): running text, capped at 68 to 70ch in prose and FAQ answers.
- **Label** (500, 13 to 14.5px): nav links, field labels, table headers, meta and fine print. Labels use sentence case, with no uppercase tracking.
- **Mono** (400, 12.5 to 15px, 1.5, ligatures off): hashes, salts, keys, addresses, and the verdict bit (600, 30px).

### Named Rules
**The Bytes-Only Mono Rule.** JetBrains Mono is used only for hashes, keys, salts, addresses and raw bytes. Labels, numbers and UI chrome stay in Host Grotesk, and numbers use tabular figures instead.

**The 560 Rule.** Headings, buttons, badges and emphasized UI share one weight (560). Bolder weights (600) are kept for the brand name, amounts and verdicts.

## Layout

Content sits on a centered rail of 1180px, with a 16px gutter on mobile and a 32px gutter from 720px up. Sections are separated by a fluid section space (88px to 148px). The hero and two-column sections use asymmetric grids: the hero is 1.04fr to 0.96fr, split sections are 0.9fr to 1.1fr, and the films section is 0.82fr to 1.5fr. Section heads are capped at 640px with a 48px gap below.

The nav floats 12px from the top as a pill. Below 960px its links collapse into a drawer. Grids drop to a single column at about 860 to 900px. The wallet strip goes from 8 across, to 4 across (1100px), to 2 across (560px), and keeps its hairline dividers at every step. App pages start 128px down and use a pill tab bar with two-column panels. A tall vault photograph with an overlaid receipt card is the hero's media pattern, and a full-bleed photo band with a floating white card is used mid-page.

## Elevation & Depth

The system is tonal first. Paper, mist and steel separate surfaces, and hairlines separate rows. Shadows are low, ink-tinted and ambient, and only things that float over other content use them: the nav, the receipt over the photograph, the band card, dialogs, toasts, the active tab and the dark button.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(11,13,18,.05), 0 6px 14px -8px rgba(11,13,18,.14)`): the nav pill, the drawer, the dark button, the active tab.
- **Lift** (`0 2px 4px rgba(11,13,18,.04), 0 24px 48px -28px rgba(11,13,18,.30)`): the receipt card and toasts.
- **Float** (`0 4px 10px rgba(11,13,18,.05), 0 40px 80px -40px rgba(11,13,18,.38)`): the vault photograph, the band card, dialogs and the declined-page card.

### Named Rules
**The Float-Only Shadow Rule.** A shadow means the surface floats over something. Inline containers such as boxes, bonds, the explorer and the demo use a 1px hairline border instead, and never a shadow.

## Shapes

Corners are generous and step with scale: 10px, then 14px (fields, wallet items, drawer links), 20px (receipt, chapters, bonds, status notes, verdicts), and 28px (photographs, the player, the demo, boxes, dialogs, the closing band). Every interactive control (buttons, nav, tabs, badges, the file-picker button and toasts) is a full pill. Strokes are 1px hairlines at rest and 1.5px on focus and invalid fields, drawn as inset box-shadows so geometry doesn't shift. Status dots are 8px circles with a 3 to 4px wash halo. Photographs are always clipped to the large radius.

## Components

### Buttons
Calm, weighted pills that lift on hover and press slightly on click.
- **Shape:** full pill (999px), 46px tall (40px for the small size), 15px at weight 560.
- **Dark (primary):** ink fill with paper text and the Rest shadow. On hover it shifts to #1c2029 and gets a deeper ink shadow. Use one per decision point.
- **Light (secondary):** paper fill with an inset 1px line-2 stroke. On hover the stroke darkens to dim-2 and the Rest shadow is added.
- **Soft:** mist fill, turning steel on hover, for in-context utility actions.
- **Ghost (on ink only):** transparent with a translucent white stroke that turns solid white on hover. Only for the dark closing band.
- **Motion:** -1px lift with a spring ease (cubic-bezier(.34,1.32,.64,1)); scale .97 on press; opacity .5 when disabled or busy.

### Badges
- **Style:** pill, 12px at weight 560, mist background with dim text. The live variant is accent-soft with accent text, and the sent variant is steel. A "Proposed" pill marks figures that are not final.

### Cards / Containers
- **Box:** paper, 28px radius, 1px hairline border, 32px padding (22px on mobile). The soft variant is mist with no border.
- **Bond / status / verdict:** 20px radius. Bonds are paper with a hairline border. Status notes are mist. Verdicts use their semantic wash.
- **Empty state:** dashed line-2 border with a 20px radius and centered dim text.

### Inputs / Fields
- **Style:** paper, 14px radius, 46px minimum height, inset 1px line-2 stroke that turns dim-2 on hover. Labels sit above at 14px weight 500 in ink-2. Textareas use mono text.
- **Focus:** inset 1.5px accent stroke plus a 4px accent-soft ring.
- **Error:** inset 1.5px bad stroke.

### Navigation
- **Floating pill nav:** translucent paper (86%) with 16px backdrop blur, a hairline border and the Rest shadow, 60px tall. Links are 14.5px weight 500 in dim, turning ink on hover. The current link sits on a mist pill. On the right: the X icon button, "Connect wallet" (light) and "Launch app" (dark). Under 960px a burger opens a paper drawer with a 20px radius.
- **Tabs (app):** a mist pill track. The selected tab is a paper pill with the Rest shadow.

### Ruled Lists (signature)
The wallet strip, token sheet, FAQ, terms gate list and the leak table are all rows divided by hairlines, not boxed into cards. The token sheet opens with a 1px ink rule. Wallet tiles divide with short vertical hairlines inset 22px, and hovering a tile fills it with mist and scales the logo up 8%. FAQ toggles are a plus that rotates 45 degrees.

### Dialogs (terms gate, wallet picker)
A paper sheet card (560px max, 28px radius, Float shadow) over a 42% ink backdrop with 6px blur. It rises in with an 18px translate and a fade. It has a head, a scrolling body, and a foot with a hairline above it where the buttons share the width. Wallet picker rows are hairline-bordered 14px tiles with a 40px logo and a status pill on the right.

### Film Player (signature)
A list of chapters next to a 16:9 player framed in line-2 with a 28px radius. Each chapter is a 20px-radius row with a numbered circle that inverts to ink when current, and a 2px progress line that fills in ink along the bottom of the current chapter. The round controls are 40px ink circles at 82% opacity.

### Receipt
A frosted paper card (94%, 12px blur, Lift shadow) over the bottom of the vault photograph. It shows the amount at 22px weight 600, the commitment in accent mono, and a hairline-ruled footer of meta in dim. The photo credit is a small ink pill in the corner.

## Do's and Don'ts

### Do:
- **Do** keep blue for live or computed state: hashes being recomputed, detected wallets, ready states, focus.
- **Do** use ink pills for the primary action and paper pills with a line-2 stroke for the secondary one.
- **Do** separate list content with 1px hairlines (#e4e7ec) instead of wrapping each item in a card.
- **Do** set every hash, key, salt and address in JetBrains Mono, and every other word in Host Grotesk.
- **Do** credit real photographs in place with a small ink pill, and clip them to the 28px radius.
- **Do** use tabular figures for amounts, times and token figures.

### Don't:
- **Don't** use green for anything except a true verification result.
- **Don't** use red outside exposure, false verdicts and invalid fields.
- **Don't** fill buttons with the signal blue.
- **Don't** put shadows on inline containers. Shadows are for surfaces that float.
- **Don't** introduce dark neon crypto styling, gradients on UI, or icon-card feature grids.
- **Don't** add uppercase tracked labels or eyebrows above headings. Headings carry their sections alone.
