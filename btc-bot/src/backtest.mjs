// Replays past 5m/15m "Up or Down" markets: at each minute of each window,
// compares the model's probability with Polymarket's own price, then with the
// real outcome. Answers the one question that matters before risking money:
// is the model better than the market, and would trading the gap have paid?
//
//   node src/backtest.mjs [hours=12] [minEdge=0.04]
import { config } from './config.mjs';
import { getJson, klines } from './binance.mjs';
import { probTwapAbove, feePerShare, sigmaFromCloses } from './model.mjs';

const hours = Number(process.argv[2] || 12);
const minEdge = Number(process.argv[3] || config.minEdge);
const HALF_SPREAD = 0.005; // price history is a midpoint; buying costs at least half the 1c spread
const STAKE = 10;
const VOL_MULTS = [0.8, 1.0, 1.25];

async function loadMarket(label, dur, start) {
  const end = start + dur;
  const [ev] = await getJson(`${config.gamma}/events?slug=btc-updown-${label}-${start}`);
  const m = ev?.markets?.[0];
  if (!m?.closed) return null;
  const won = JSON.parse(m.outcomePrices).map(Number);
  if (won[0] !== 1 && won[1] !== 1) return null;
  const [upToken] = JSON.parse(m.clobTokenIds);
  const L = m.cryptoMarketConfig?.twapLookbackSeconds || 60;

  const [hist, secs, mins] = await Promise.all([
    getJson(`${config.clob}/prices-history?market=${upToken}&startTs=${start}&endTs=${end}&fidelity=1`),
    klines('1s', { startTime: (start - L) * 1000, endTime: end * 1000 - 1, limit: 1000 }),
    klines('1m', { endTime: start * 1000 - 1, limit: 180 }),
  ]);
  const px = new Map(secs.map((r) => [Math.floor(r[0] / 1000), Number(r[4])]));
  const spot = (t) => { let v; for (let s = t - 10; s <= t; s++) v = px.get(s) ?? v; return v; };
  const avg = (a, b) => { let sum = 0, n = 0, v = spot(a); for (let s = a; s < b; s++) { v = px.get(s) ?? v; sum += v; n++; } return sum / n; };
  return {
    slug: m.slug, start, end, L, up: won[0] === 1, fee: m.feesEnabled ? m.feeSchedule : null,
    K: avg(start - L, start), sigma: sigmaFromCloses(mins.map((r) => Number(r[4])), 60),
    history: hist.history || [], spot, avg,
  };
}

function evaluate(markets, volMult) {
  let n = 0, brierModel = 0, brierMarket = 0, trades = 0, wins = 0, pnl = 0, staked = 0;
  for (const mk of markets) {
    let traded = false;
    for (const { t, p: mid } of mk.history) {
      if (t < mk.start + 30 || t > mk.end - config.minSecondsLeft) continue;
      const S = mk.spot(t);
      if (!S || !mk.sigma) continue;
      const windowStart = mk.end - mk.L;
      const p = probTwapAbove({
        S, K: mk.K, sigma: mk.sigma * volMult, now: t * 1000, end: mk.end * 1000, L: mk.L,
        realizedAvg: t > windowStart ? mk.avg(windowStart, t) : undefined,
      });
      const y = mk.up ? 1 : 0;
      n++; brierModel += (p - y) ** 2; brierMarket += (mid - y) ** 2;
      if (traded) continue;
      for (const [side, prob, ask] of [[0, p, mid + HALF_SPREAD], [1, 1 - p, 1 - mid + HALF_SPREAD]]) {
        if (ask < config.minPrice || ask > config.maxPrice) continue;
        const f = feePerShare(ask, mk.fee);
        const edge = prob - ask - f;
        if (edge < minEdge || edge > config.maxEdge) continue;
        const shares = STAKE / (ask + f);
        const win = (side === 0) === mk.up;
        trades++; wins += win; staked += STAKE;
        pnl += (win ? shares : 0) - STAKE;
        traded = true;
        break;
      }
    }
  }
  return { volMult, samples: n, brierModel: brierModel / n, brierMarket: brierMarket / n, trades, wins, staked, pnl };
}

const now = Math.floor(Date.now() / 1000);
const markets = [];
for (const [label, dur] of [['5m', 300], ['15m', 900]]) {
  const starts = [];
  for (let s = now - (now % dur) - 2 * dur; s > now - hours * 3600; s -= dur) starts.push(s);
  for (let i = 0; i < starts.length; i += 8) {
    const batch = await Promise.all(starts.slice(i, i + 8).map((s) => loadMarket(label, dur, s).catch(() => null)));
    markets.push(...batch.filter(Boolean));
    process.stderr.write(`\rloaded ${markets.length} markets`);
  }
}
process.stderr.write('\n');

console.log(`${markets.length} resolved markets, last ${hours}h, minEdge ${minEdge}, $${STAKE} per trade`);
console.log('Brier score: lower is better. If the market beats the model, the "edges" are the model being wrong.\n');
for (const r of VOL_MULTS.map((v) => evaluate(markets, v))) {
  console.log(
    `vol x${r.volMult.toFixed(2)}  Brier model ${r.brierModel.toFixed(4)} vs market ${r.brierMarket.toFixed(4)}  |  ` +
    `${r.trades} trades, ${r.wins} won, staked $${r.staked.toFixed(0)}, P&L ${r.pnl >= 0 ? '+' : ''}$${r.pnl.toFixed(2)} ` +
    `(${r.staked ? ((r.pnl / r.staked) * 100).toFixed(1) : '0'}%)`,
  );
}
