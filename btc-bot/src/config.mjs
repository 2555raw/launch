// Every knob the bot has, read from the environment so nothing needs editing.
const num = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : Number(v);
};

export const config = {
  port: num('PORT', 3000),
  host: process.env.HOST || '0.0.0.0',

  // data-api / data-stream are Binance's public market-data hosts; they answer
  // from regions where api.binance.com is blocked.
  binanceRest: process.env.BINANCE_REST || 'https://data-api.binance.vision',
  binanceWs: process.env.BINANCE_WS || 'wss://data-stream.binance.vision/ws/btcusdt@aggTrade',
  gamma: process.env.POLY_GAMMA || 'https://gamma-api.polymarket.com',
  clob: process.env.POLY_CLOB || 'https://clob.polymarket.com',

  startBankroll: num('START_BANKROLL', 68),
  horizonHours: num('HORIZON_HOURS', 6),       // how far ahead to look for markets
  minEdge: num('MIN_EDGE', 0.04),              // $ of expected profit per $1 share, after fees
  maxEdge: num('MAX_EDGE', 0.25),              // above this the model is probably wrong, not the market
  minPrice: num('MIN_PRICE', 0.05),            // skip tails where small model errors dominate
  maxPrice: num('MAX_PRICE', 0.95),
  minSecondsLeft: num('MIN_SECONDS_LEFT', 20), // too close to expiry to be filled in time
  stakePct: num('STAKE_PCT', 0.05),            // fraction of cash risked per trade
  maxStake: num('MAX_STAKE', 25),              // hard $ cap per trade
  // Scales measured vol. Widening it is not "safe": it overprices long shots
  // (backtest: x1.25 loses most of the edge x1.0 shows). Recheck with npm run backtest.
  volMult: num('VOL_MULT', 1.0),
  minSigmaAnnual: num('MIN_SIGMA_ANNUAL', 0.25),
  maxPriceAgeMs: num('MAX_PRICE_AGE_MS', 3000),
  maxBookAgeMs: num('MAX_BOOK_AGE_MS', 5000),

  discoverEveryMs: num('DISCOVER_EVERY_MS', 60_000),
  bookEveryMs: num('BOOK_EVERY_MS', 1500),
  tickEveryMs: num('TICK_EVERY_MS', 1000),
  settleEveryMs: num('SETTLE_EVERY_MS', 15_000),
  // How long to wait for Polymarket's official result before settling on our own Binance estimate.
  settleFallbackMs: num('SETTLE_FALLBACK_MS', 15 * 60_000),

  stateFile: process.env.STATE_FILE || new URL('../data/state.json', import.meta.url).pathname,
};
