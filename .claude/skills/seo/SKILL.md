---
name: seo
description: Make MarbleRush look right when it is shared or searched: title, description, Open Graph and X cards with a real preview image, icons, robots and sitemap.
---

# /seo

From `marble-royale/`. Everything must be true; never claim a figure the site does not deliver.

1. `<title>` and `<meta name="description">` say what the site is and the cadence that `lib/round.js` actually uses.
2. Open Graph: `og:title`, `og:description`, `og:url` (https://marblerush.site), `og:type`, `og:image` (1200x630), `og:image:alt`.
3. X card: `twitter:card=summary_large_image`, `twitter:site` and `twitter:creator` set to the account in `LINK_X`, `twitter:image`.
4. Build the preview image yourself: an SVG under `public/brand/` rendered to PNG at 1200x630 with the brand mark, the name with Rush in orange, and one honest line. Serve it from `public/brand/og.png`.
5. Icons: `public/icon.svg` plus a 180x180 `apple-touch-icon.png`, and a `site.webmanifest` with name, short name, theme colour `#ff7a1a` and the icons.
6. `robots.txt` allowing everything with the sitemap line, and a `sitemap.xml` with the one page.
7. Serve the new files from `server.js` if its static handler does not already cover them, and check each one returns 200 with the right content type.
8. Validate by fetching `/` and parsing the tags back out; screenshot the rendered OG image.

Then follow `/deploy`. Report: tags added, files added, what each returns.
