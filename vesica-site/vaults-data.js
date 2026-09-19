/* The vault table, and the arithmetic every page does over it.

   Split out of app.js so more than one page can read it: the list on
   vaults.html and the single-vault page both derive everything from here, and
   neither keeps a second copy of a number. All of it is sample data for a
   design mock — the arithmetic between the numbers is not.
*/

const VAULTS = [
  { t: 'NVDA',  name: 'NVIDIA',            apr: 31.4, tvl: 9_820_000, price: 219.44, chg:  1.82, fees24: 8_450, state: 'range',       cap: 12_000_000, tier: 0.30, band: 2.4, reb: '3h ago',  depositors: 1_284, age: 118 },
  { t: 'TSLA',  name: 'Tesla',             apr: 27.8, tvl: 7_140_000, price: 360.01, chg: -2.35, fees24: 5_430, state: 'rebalancing', cap: 10_000_000, tier: 0.30, band: 3.1, reb: 'queued',  depositors:   962, age: 118 },
  { t: 'HOOD',  name: 'Robinhood Markets', apr: 24.6, tvl: 5_960_000, price:  96.18, chg:  0.94, fees24: 4_010, state: 'range',       cap:  8_000_000, tier: 0.30, band: 2.8, reb: '11h ago', depositors:   871, age: 118 },
  { t: 'COIN',  name: 'Coinbase Global',   apr: 22.1, tvl: 4_380_000, price: 318.72, chg: -1.12, fees24: 2_650, state: 'range',       cap:  8_000_000, tier: 0.30, band: 3.0, reb: '6h ago',  depositors:   604, age:  96 },
  { t: 'AAPL',  name: 'Apple',             apr: 17.9, tvl: 6_510_000, price: 241.35, chg:  0.41, fees24: 3_190, state: 'range',       cap: 10_000_000, tier: 0.30, band: 1.8, reb: '19h ago', depositors: 1_146, age: 118 },
  { t: 'MSFT',  name: 'Microsoft',         apr: 16.2, tvl: 5_240_000, price: 512.90, chg:  0.28, fees24: 2_320, state: 'range',       cap:  9_000_000, tier: 0.30, band: 1.6, reb: '1d ago',  depositors:   803, age: 118 },
  { t: 'AMZN',  name: 'Amazon',            apr: 15.4, tvl: 3_870_000, price: 229.61, chg: -0.62, fees24: 1_630, state: 'range',       cap:  8_000_000, tier: 0.30, band: 1.9, reb: '14h ago', depositors:   517, age:  74 },
  { t: 'META',  name: 'Meta Platforms',    apr: 14.1, tvl: 2_940_000, price: 648.20, chg:  1.06, fees24: 1_140, state: 'range',       cap:  6_000_000, tier: 0.30, band: 2.2, reb: '9h ago',  depositors:   398, age:  74 },
  { t: 'GOOGL', name: 'Alphabet',          apr: 12.7, tvl: 2_110_000, price: 204.88, chg:  0.17, fees24:   735, state: 'range',       cap:  6_000_000, tier: 0.30, band: 1.7, reb: '2d ago',  depositors:   276, age:  21 },
  { t: 'PLTR',  name: 'Palantir',          apr:  0.0, tvl:   650_000, price: 174.05, chg: -4.08, fees24:     0, state: 'paused',      cap:  4_000_000, tier: 0.30, band: 4.0, reb: 'halted',  depositors:    88, age:  12 },
  { t: 'AMD',   name: 'AMD',                apr: 26.3, tvl: 4_720_000, price: 204.77, chg:  2.41, fees24: 3_060, state: 'range',       cap:  8_000_000, tier: 0.30, band: 2.9, reb: '5h ago',  depositors:   688, age:  96 },
  { t: 'INTC',  name: 'Intel',              apr: 19.5, tvl: 2_680_000, price:  38.12, chg: -0.87, fees24: 1_290, state: 'range',       cap:  6_000_000, tier: 0.30, band: 2.6, reb: '16h ago', depositors:   431, age:  74 },
  { t: 'MU',    name: 'Micron',             apr: 23.8, tvl: 3_410_000, price: 167.94, chg:  1.55, fees24: 2_040, state: 'range',       cap:  7_000_000, tier: 0.30, band: 3.2, reb: '8h ago',  depositors:   512, age:  74 },
  { t: 'AVGO',  name: 'Broadcom',           apr: 18.6, tvl: 4_050_000, price: 341.28, chg:  0.73, fees24: 1_880, state: 'range',       cap:  8_000_000, tier: 0.30, band: 2.0, reb: '1d ago',  depositors:   597, age:  96 },
  { t: 'SNDK',  name: 'SanDisk',            apr: 21.2, tvl: 1_490_000, price:  94.60, chg: -1.94, fees24:   790, state: 'range',       cap:  4_000_000, tier: 0.30, band: 3.4, reb: '13h ago', depositors:   233, age:  42 },
  { t: 'MSTR',  name: 'MicroStrategy',      apr: 34.9, tvl: 3_960_000, price: 208.35, chg:  3.18, fees24: 3_540, state: 'rebalancing', cap:  7_000_000, tier: 0.30, band: 4.6, reb: 'queued',  depositors:   604, age:  74 },
  { t: 'CRCL',  name: 'Circle Internet',    apr: 20.4, tvl: 2_260_000, price: 118.47, chg:  1.02, fees24: 1_120, state: 'range',       cap:  5_000_000, tier: 0.30, band: 3.3, reb: '7h ago',  depositors:   349, age:  42 },
  { t: 'GME',   name: 'GameStop',           apr: 29.7, tvl:   980_000, price:  24.18, chg: -3.26, fees24:   690, state: 'range',       cap:  3_000_000, tier: 0.30, band: 5.2, reb: '4h ago',  depositors:   176, age:  21 },
  { t: 'QQQ',   name: 'Invesco QQQ',        apr: 11.3, tvl: 5_870_000, price: 612.04, chg:  0.35, fees24: 1_760, state: 'range',       cap: 10_000_000, tier: 0.30, band: 1.4, reb: '2d ago',  depositors:   915, age:  96 },
  { t: 'SPCX',  name: 'SpaceX',             apr:  0.0, tvl:   420_000, price: 167.50, chg:  0.00, fees24:     0, state: 'paused',      cap:  3_000_000, tier: 0.30, band: 6.0, reb: 'pending', depositors:    54, age:   7 },
];

// the share price a vault would have after its life at its own APR — it is what
// turns a USDG amount into shares and back again
VAULTS.forEach(v => { v.px = +(1 + (v.apr / 100) * (v.age / 365)).toFixed(4); v.px0 = v.px; });

/* The page says the fees compound into the position and that the share price
   is where that shows, so it had better move. On a real clock it does not:
   at 31% APR the fourth decimal turns over about once a minute, which is
   indistinguishable from nothing to anyone looking at it. So the demo runs a
   compressed clock — a second here is an hour in the vault — and says so on
   the page rather than hiding it. A paused vault earns nothing, which is the
   point of pausing it. */
const HOURS_PER_SECOND = 1;
const OPENED = Date.now();

function accrue() {
  const hours = (Date.now() - OPENED) / 1000 * HOURS_PER_SECOND;
  VAULTS.forEach(v => {
    if (v.state === 'paused') return;
    v.px = +(v.px0 * (1 + (v.apr / 100) * (hours / 8760))).toFixed(6);
  });
}

const STATE_TEXT = { range: 'In range', rebalancing: 'Rebalancing', paused: 'Paused' };

/* ---------- formatting ---------- */

const usd = n =>
  n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K'
  : '$' + n.toFixed(0);

// your own balances, to the cent under $1,000 and to the dollar above it
const dollars = n => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0,
});

const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => n.toFixed(1) + '%';
/* The address generator that used to live here produced strings of 24 to 32
   hex characters — an address is 40 — so nothing it returned was even a
   well-formed address. Addresses now come from deployments.js, or the page
   says there is no address. */

