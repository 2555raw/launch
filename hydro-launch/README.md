# Hydro

A simulated launchpad where every token is launched paired to one water source —
a reservoir, an aquifer, a glacier or a desalination plant — and inherits its
unit, its venue and its spot price.

Static site: HTML, CSS and JavaScript, no dependencies and no build step. Serve
it with anything:

```
python3 -m http.server 8777
```

Live demo: https://claude.ai/artifact/Ufecei9ytDXXideA9nijbC

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Front page and live spot board |
| `sources.html` | The register: 32 sources with class filter, search and sort |
| `launch.html` | Pairing and launch form |
| `launches.html` | Every token launched |
| `token.html?id=…` | A token's page: price, curve, vault and pairing |
| `docs.html` | The model, explained |

`data.js` holds the source register and its starting fill levels; `app.js` runs
the simulated market, the launches and each page's rendering.

## The model

- Every source has a fill level between 0 and 1 that drifts over time. As the
  fill falls, spot rises: scarcity sets the price, not volume.
- At launch a token fixes its source's spot and opens at
  `price0 = 0.4 · curve_target / supply · (1 + (1 − fill) · 0.5)`.
- After that, `price = price0 · (spot / spot0)^β · (1 + curve / 4.2 · 0.65)`.
- Trading runs on a bonding curve up to 4.2 ETH; once it fills, the token
  graduates.
- 3% of every trade goes into the token's vault.

No chain, wallet or backend: state lives in `localStorage` and "Reset data" in
the footer wipes it.
