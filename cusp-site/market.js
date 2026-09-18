/* Cusp — the market table.
   The token list, the four routers and the arithmetic between them live here
   because two places quote the same trade now: the swap desk, and the quick
   trade that hangs off the nav on every page. Every price and every provider
   is invented; the arithmetic is not. */

/* The token marks: ETH's diamond and the ₿ are drawn here, the two stock
   tokens borrow the brand paths from logos.js, and USDG carries a letter
   because a stablecoin's mark is not mine to invent. */
const GLYPH = {
  ETH:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l5.6 9.3L12 15 6.4 11.8 12 2.5zM12 16.4l5.6-3.3L12 21.5l-5.6-8.4 5.6 3.3z"/></svg>',
  WBTC: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.3 10.3c.2-1.4-.9-2.2-2.4-2.7l.5-1.9-1.2-.3-.5 1.9-.9-.2.5-1.9-1.2-.3-.5 1.9-2.4-.6-.3 1.3s.9.2.9.2c.5.1.6.4.6.7l-1.4 5.6c-.1.2-.2.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.4 2.3.6-.5 1.9 1.2.3.5-1.9.9.2-.5 1.9 1.2.3.5-1.9c2 .4 3.6.2 4.2-1.6.5-1.5 0-2.4-1.1-2.9.8-.2 1.4-.7 1.6-1.9zm-2.8 3.9c-.4 1.5-2.9.7-3.7.5l.6-2.6c.8.2 3.4.6 3.1 2.1zm.4-3.9c-.3 1.4-2.4.7-3.1.5l.6-2.3c.7.2 2.9.5 2.5 1.8z"/></svg>',
  USDG: '<svg viewBox="0 0 24 24"><text x="12" y="16.5" text-anchor="middle" font-family="inherit" font-size="12" font-weight="700" fill="currentColor">G</text></svg>',
};

const TOKENS = {
  ETH:   { name: 'Ether',         px: 3420.18, dp: 4, c: '#5A6BC4', on: '#fff' },
  USDG:  { name: 'Global Dollar', px: 1.0000,  dp: 2, c: '#1D9E68', on: '#fff' },
  WBTC:  { name: 'Wrapped BTC',   px: 96480.5, dp: 6, c: '#E08A2B', on: '#fff' },
  xNVDA: { name: 'NVIDIA token',  px: 182.44,  dp: 4, c: '#F1F7E8', on: '#76B900', logo: 'NVDA' },
  xTSLA: { name: 'Tesla token',   px: 271.06,  dp: 4, c: '#FBEDED', on: '#CC0000', logo: 'TSLA' },
};

function tokenMark(sym) {
  const t = TOKENS[sym];
  const inner = t.logo && typeof LOGOS !== 'undefined' && LOGOS[t.logo]
    ? `<svg viewBox="${LOGOS[t.logo].vb}" fill="currentColor"><path d="${LOGOS[t.logo].p}"/></svg>`
    : (GLYPH[sym] || '');
  return `<span class="tr-tok-ic" style="background:${t.c};color:${t.on}">${inner}</span>`;
}

/* Four routers with their own spread and their own gas. The jitter is what
   makes a refresh mean something: in a real one the pools have moved. */
const PROVIDERS = [
  { id: 'kestrel', name: 'Kestrel',  c: '#2F9E7A', spread: 0.0012, gas: 0.42 },
  { id: 'zeroth',  name: 'Zeroth',   c: '#232330', spread: 0.0018, gas: 0.31 },
  { id: 'nordway', name: 'Nordway',  c: '#C2412F', spread: 0.0009, gas: 0.58 },
  { id: 'lattice', name: 'Lattice',  c: '#4B4BD6', spread: 0.0021, gas: 0.27 },
];

const PROTOCOL_FEE = 0.0008;   // 8 bps, quoted into every route

let jitter = {};
function reroll() {
  PROVIDERS.forEach(p => { jitter[p.id] = 1 - (Math.random() * 0.0016); });
}
reroll();


/* One place decides what a trade is worth. Both callers pass the pair and the
   size; what comes back is every route, best first. */
function quoteRoutes(payTok, getTok, amountIn) {
  const inUsd = amountIn * TOKENS[payTok].px;
  const gross = inUsd / TOKENS[getTok].px;
  return PROVIDERS.map(p => {
    const out = gross * (1 - p.spread) * (1 - PROTOCOL_FEE) * (jitter[p.id] || 1);
    return { ...p, out, gasUsd: p.gas };
  }).sort((a, b) => b.out - a.out);
}
