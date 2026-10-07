// Fair-value maths. Prices follow a driftless random walk with per-second
// log-volatility `sigma`; over minutes the drift is negligible next to the noise.

// Abramowitz-Stegun 7.1.26 via erf; error < 1.5e-7, plenty for a price in cents.
export function normCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
    Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const clamp01 = (p) => Math.min(1, Math.max(0, p));

// P(price at `tau` seconds from now >= K). Used for Binance candle closes.
export function probPointAbove({ S, K, sigma, tau }) {
  if (tau <= 0) return S >= K ? 1 : 0;
  return clamp01(normCdf(Math.log(S / K) / (sigma * Math.sqrt(tau))));
}

// P(average price over the last `L` seconds before `end` >= K), for the
// Chainlink TWAP markets. Inside the window part of the average is already
// fixed (`realizedAvg` over the elapsed fraction); the rest is the average of a
// random walk, whose variance is a third of the endpoint's.
export function probTwapAbove({ S, K, sigma, now, end, L, realizedAvg }) {
  const tau = (end - now) / 1000;
  if (tau <= 0) return (realizedAvg ?? S) >= K ? 1 : 0;
  if (tau >= L) {
    const variance = sigma * sigma * (tau - L + L / 3);
    return clamp01(normCdf(Math.log(S / K) / Math.sqrt(variance)));
  }
  const f = 1 - tau / L;
  const mean = f * realizedAvg + (1 - f) * S;
  const sd = (1 - f) * S * sigma * Math.sqrt(tau / 3);
  return clamp01(normCdf((mean - K) / sd));
}

// Taker fee per share in USDC. Polymarket publishes {rate, exponent} per
// market; this reads it as rate * (p(1-p))^exponent, the more expensive of the
// two readings of their formula, so the bot errs on paying too much.
export function feePerShare(price, schedule) {
  if (!schedule) return 0;
  return schedule.rate * Math.pow(price * (1 - price), schedule.exponent ?? 1);
}

// Walk the asks cheapest-first, buying while each level still clears `minEdge`
// of expected profit per share and the budget lasts.
export function planBuy({ asks, prob, budget, minEdge, fee, minShares = 0 }) {
  let shares = 0, cost = 0, fees = 0, ev = 0;
  for (const [price, size] of asks) {
    const f = fee(price);
    const edge = prob - price - f;
    if (edge < minEdge) break;
    const affordable = (budget - cost - fees) / (price + f);
    const take = Math.floor(Math.min(size, affordable) * 100) / 100;
    if (take <= 0) break;
    shares += take; cost += take * price; fees += take * f; ev += take * edge;
    if (take < size) break;
  }
  if (shares < minShares || shares === 0) return null;
  return { shares, cost, fees, avgPrice: cost / shares, expectedProfit: ev };
}

// Per-second log volatility from a series of closes sampled every `stepSeconds`.
export function sigmaFromCloses(closes, stepSeconds) {
  const r = [];
  for (let i = 1; i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1]));
  if (r.length < 2) return null;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v / stepSeconds);
}

export const SECONDS_PER_YEAR = 365 * 24 * 3600;
