/* Everything the server reads from the environment, in one place.
 *
 * With no provider keys set the whole product still runs end to end in
 * "demo" mode: model calls are simulated locally and clearly labelled,
 * deposits can be simulated from the wallet panel, and new accounts start
 * with a welcome balance so the app is usable. Set the keys and it goes live
 * one provider at a time. */
const path = require('path');
const env = process.env;

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const keys = {
  anthropic: env.ANTHROPIC_API_KEY || '',
  openai: env.OPENAI_API_KEY || '',
  google: env.GOOGLE_API_KEY || env.GEMINI_API_KEY || '',
  deepseek: env.DEEPSEEK_API_KEY || '',
  xai: env.XAI_API_KEY || '',
  openrouter: env.OPENROUTER_API_KEY || '',
  fal: env.FAL_KEY || '',
  elevenlabs: env.ELEVENLABS_API_KEY || ''
};

const demoMode = (env.DEMO_MODE || 'auto').toLowerCase(); // auto | on | off

module.exports = {
  port: num(env.PORT, 8080),
  publicUrl: env.PUBLIC_URL || '',
  dataDir: env.DATA_DIR || path.join(__dirname, '..', 'data'),

  /* money */
  creditsPerUsd: 1000,
  markup: num(env.PRICE_MARKUP, 1.055), // what the list price carries over the provider's own price
  welcomeCredits: num(env.WELCOME_CREDITS, demoMode === 'off' ? 0 : 1000),

  /* $SEEKR holder terms, as published on the site */
  holder: {
    pricePct: 0.05,          // holders pay 5% of the list price...
    creditsPerStep: 1000,    // ...on 1,000 credits a day per 0.01% of supply held...
    stepPct: 0.01,
    maxAllowance: 25000,     // ...up to 25,000 credits a day. Resets 00:00 UTC.
    earlyAccessPct: 0.5,     // new models 14 days early from 0.5%
    priorityPct: 1           // priority routing from 1%
  },

  keys,
  demoMode,
  /* a provider is "live" when its key is set; otherwise its models run in demo mode (unless DEMO_MODE=off) */
  isLive(provider) { return Boolean(keys[provider]); },
  demoAllowed() { return demoMode !== 'off'; },
  /* free demo credits and simulated holdings cost real money once any provider is
     live, so they only exist while nothing is */
  demoMoney() { return demoMode !== 'off' && !Object.values(keys).some(Boolean); },

  chain: {
    /* Robinhood Chain (Arbitrum L2, chain id 4663) where $SEEKR lives */
    rhRpc: env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', // public, rate limited; set a dedicated one if holders grow
    explorer: env.ROBINHOOD_EXPLORER_URL || 'https://robinhoodchain.blockscout.com',
    rhChainId: 4663,
    seekrToken: env.SEEKR_TOKEN_ADDRESS || '',
    seekrSupply: num(env.SEEKR_TOTAL_SUPPLY, 1e9),
    seekrDecimals: num(env.SEEKR_DECIMALS, 18),
    dexscreenerPair: env.SEEKR_DEXSCREENER_PAIR || '', // "robinhood/0xpair" — for the live $SEEKR price
    buyUrl: env.SEEKR_BUY_URL || '',
    chartUrl: env.SEEKR_CHART_URL || '',
    launch: env.SEEKR_LAUNCH || 'Soon, on Pons', // e.g. "Fri 2 Oct on Pons"

    /* where deposits go. Leave empty and the deposit panel offers the demo top-up instead. */
    ethRpc: env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    solRpc: env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
    btcApi: env.BTC_API_URL || 'https://mempool.space/api',
    treasury: {
      eth: env.TREASURY_ETH_ADDRESS || '',
      sol: env.TREASURY_SOL_ADDRESS || '',
      btc: env.TREASURY_BTC_ADDRESS || ''
    },
    usdtErc20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minConfirmations: num(env.MIN_CONFIRMATIONS, 1)
  },

  links: {
    x: env.LINK_X || 'https://x.com/heySeekr',
    telegram: env.LINK_TELEGRAM || 'https://t.me/seekr',
    email: env.CONTACT_EMAIL || 'seek@seekr.website'
  }
};
