/* One vault, on its own page.

   Everything here is derived from the same VAULTS row the list uses, so the
   two can never disagree. The ninety-day history is generated rather than
   recorded — it is a design mock — but it is generated deterministically from
   the ticker, so the same vault draws the same curve on every visit and on
   every machine, and it ends exactly on the share price the list shows.
*/

const params = new URLSearchParams(location.search);
const WANT = (params.get('v') || 'NVDA').toUpperCase();
const V = VAULTS.find(v => v.t === WANT);

const $ = id => document.getElementById(id);

/* A small deterministic generator, so the curve is stable across reloads. */
function seeded(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; };
}

const DAYS = 90;

/* The share price ends where the list says it is, and walks backwards from
   there at the vault's own APR with a little noise on top. A paused vault is
   flat, because a paused vault earns nothing. */
function history() {
  const rnd = seeded(V.t);
  const daily = V.state === 'paused' ? 0 : (V.apr / 100) / 365;
  const noise = V.state === 'paused' ? 0 : Math.min(V.band, 4) / 900;
  const out = [];
  let px = V.px;
  for (let i = 0; i <= DAYS; i++) out.push(px / Math.pow(1 + daily, i));
  out.reverse();
  return out.map((p, i) => ({
    day: i - DAYS,
    px: i === DAYS ? V.px : p * (1 + (rnd() - 0.5) * noise),
  }));
}

function render() {
  const series = history();

  // ---- identity
  $('vp-title').textContent = `USDG / x${V.t}`;
  $('vp-sub').textContent = `${V.name} · ${V.tier.toFixed(2)}% pool · ±${V.band.toFixed(1)}% band`;
  const st = $('vp-state');
  st.innerHTML = `<i></i>${STATE_TEXT[V.state]}`;
  st.classList.toggle('is-paused', V.state === 'paused');
  const mk = LOGOS && LOGOS[V.t];
  if (mk) $('vp-mark').innerHTML = markSvg(mk);

  // ---- the four figures
  $('vp-apr').textContent = V.state === 'paused' ? '—' : pct(V.apr);
  $('vp-tvl').textContent = usd(V.tvl);
  $('vp-px').textContent = '$' + V.px.toFixed(4);
  $('vp-dep').textContent = V.depositors.toLocaleString('en-US');

  drawChart(series);
  drawBand();
  fillTable(series);

  // ---- the detail
  $('vp-kv').innerHTML = [
    ['Oracle price', '$' + V.price.toFixed(2)],
    ['24h change', (V.chg >= 0 ? '+' : '') + V.chg.toFixed(2) + '%'],
    ['Fees · 24h', usd(V.fees24)],
    ['Capacity', `${usd(V.tvl)} / ${usd(V.cap)}`],
    ['Last rebalance', V.reb],
    ['Pool fee tier', V.tier.toFixed(2) + '%'],
    ['Vault contract', addressCell(V.t)],
    ['Oracle feed', addressCell(V.t + '-feed')],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  const note = $('vp-deploy');
  if (note) note.textContent = deploymentNote();

  const go = $('vp-go');
  if (V.state === 'paused') { go.textContent = 'Deposits are paused'; go.classList.add('is-off'); go.removeAttribute('href'); }
  else go.href = `vaults.html?v=${V.t}`;
  $('vp-swap').href = `swap.html`;
}

/* ---------- the chart ---------- */

const W = 860, H = 260, PAD = { t: 14, r: 56, b: 26, l: 8 };

function drawChart(series) {
  const lo = Math.min(...series.map(d => d.px));
  const hi = Math.max(...series.map(d => d.px));
  const span = (hi - lo) || hi * 0.01;
  const y0 = lo - span * 0.25, y1 = hi + span * 0.25;

  const X = i => PAD.l + (i / DAYS) * (W - PAD.l - PAD.r);
  const Y = p => PAD.t + (1 - (p - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  const pts = series.map((d, i) => [X(i), Y(d.px)]);
  const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${H - PAD.b} L${pts[0][0].toFixed(1)} ${H - PAD.b} Z`;

  // four recessive gridlines, labelled on the right so they never cross the data
  const ticks = [0, 1, 2, 3].map(i => y0 + (y1 - y0) * (i / 3));
  const grid = ticks.map(v =>
    `<line x1="${PAD.l}" y1="${Y(v).toFixed(1)}" x2="${W - PAD.r}" y2="${Y(v).toFixed(1)}"/>`).join('');
  const labels = ticks.map(v =>
    `<text x="${W - PAD.r + 8}" y="${(Y(v) + 3.5).toFixed(1)}">$${v.toFixed(4)}</text>`).join('');

  const days = [0, 30, 60, 90].map(d =>
    `<text x="${X(d).toFixed(1)}" y="${H - 8}" text-anchor="${d === 0 ? 'start' : d === 90 ? 'end' : 'middle'}">${d === 90 ? 'today' : '−' + (90 - d) + 'd'}</text>`).join('');

  const [lx, ly] = pts.at(-1);

  $('vp-svg').innerHTML = `
    <g class="vp-grid">${grid}</g>
    <g class="vp-axis">${labels}${days}</g>
    <path class="vp-area" d="${area}"/>
    <path class="vp-line" d="${line}"/>
    <circle class="vp-last-ring" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="6"/>
    <circle class="vp-last" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5"/>
    <line class="vp-cross" id="vp-cross" y1="${PAD.t}" y2="${H - PAD.b}"/>
    <circle class="vp-dot" id="vp-dot" r="4"/>
    <rect class="vp-hit" id="vp-hit" x="${PAD.l}" y="0" width="${W - PAD.l - PAD.r}" height="${H}"/>`;

  $('vp-svg').setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('vp-svg').setAttribute('role', 'img');
  $('vp-svg').setAttribute('aria-label',
    `Share price over ninety days, from $${series[0].px.toFixed(4)} to $${V.px.toFixed(4)}. The same numbers are in the table below.`);

  hover(series, X, Y);
}

/* A line chart in a browser is interactive or it is a picture. */
function hover(series, X, Y) {
  const svg = $('vp-svg'), hit = $('vp-hit'), cross = $('vp-cross'), dot = $('vp-dot'), tip = $('vp-tip');
  const show = on => { for (const el of [cross, dot]) el.style.opacity = on ? 1 : 0; tip.style.opacity = on ? 1 : 0; };

  hit.addEventListener('pointermove', e => {
    const box = svg.getBoundingClientRect();
    const sx = (e.clientX - box.left) / box.width * W;
    const i = Math.max(0, Math.min(DAYS, Math.round((sx - PAD.l) / (W - PAD.l - PAD.r) * DAYS)));
    const d = series[i];
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i));
    dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(d.px));
    tip.innerHTML = `<b>$${d.px.toFixed(4)}</b><span>${d.day === 0 ? 'today' : d.day + ' days'}</span>`;
    tip.style.left = (X(i) / W * 100) + '%';
    tip.style.top = (Y(d.px) / H * 100) + '%';
    show(true);
  });
  hit.addEventListener('pointerleave', () => show(false));
}

function fillTable(series) {
  const every = series.filter((_, i) => i % 10 === 0 || i === DAYS);
  $('vp-rows').innerHTML = every.map(d =>
    `<tr><td>${d.day === 0 ? 'today' : d.day + 'd'}</td><td>$${d.px.toFixed(4)}</td></tr>`).join('');
}

/* ---------- the band ---------- */

function drawBand() {
  const w = 860, h = 92, pad = 70;
  const lo = V.price * (1 - V.band / 100), hi = V.price * (1 + V.band / 100);
  const mid = (pad + (w - pad)) / 2;
  const half = (w - pad * 2) * 0.34;

  $('vp-band').setAttribute('viewBox', `0 0 ${w} ${h}`);
  $('vp-band').innerHTML = `
    <line class="vp-rail" x1="${pad}" y1="46" x2="${w - pad}" y2="46"/>
    <line class="vp-in-band" x1="${mid - half}" y1="46" x2="${mid + half}" y2="46"/>
    <line class="vp-oracle" x1="${mid}" y1="26" x2="${mid}" y2="66"/>
    <text class="vp-band-k" x="${mid}" y="20" text-anchor="middle">$${V.price.toFixed(2)}</text>
    <text class="vp-band-t" x="${mid}" y="82" text-anchor="middle">oracle</text>
    <text class="vp-band-k" x="${mid - half}" y="20" text-anchor="middle">$${lo.toFixed(2)}</text>
    <text class="vp-band-t" x="${mid - half}" y="82" text-anchor="middle">lower</text>
    <text class="vp-band-k" x="${mid + half}" y="20" text-anchor="middle">$${hi.toFixed(2)}</text>
    <text class="vp-band-t" x="${mid + half}" y="82" text-anchor="middle">upper</text>`;
  $('vp-band').setAttribute('role', 'img');
  $('vp-band').setAttribute('aria-label',
    `Liquidity sits between $${lo.toFixed(2)} and $${hi.toFixed(2)}, centred on the oracle price of $${V.price.toFixed(2)}.`);
}

/* Last, not first: everything above is a const, and a const cannot be read
   from above itself. */
if (!V) {
  $('vp-missing').hidden = false;
  $('vp-main').hidden = true;
  document.title = 'Vault not found — Vesica';
} else {
  document.title = `USDG / x${V.t} — Vesica`;
  render();
}
