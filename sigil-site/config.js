/* Sigil — the settings an operator has to fill in before the site can take
   a real payment. Everything here is read at load time by account.js.

   Until `treasury` holds an address you control, the page refuses to start a
   live payment and runs the demo instead. That is deliberate: sending SOL to
   an address nobody holds the key for destroys it, so there is no placeholder
   address in this file and you should not invent one. */

window.SIGIL_CONFIG = {
  /* 'devnet' while you are testing, 'mainnet-beta' when you mean it.
     Devnet SOL is free from a faucet, so test there first. */
  cluster: 'devnet',

  /* A Solana RPC endpoint. The public endpoints rate limit hard and most block
     browser origins, so use your own (Helius, Triton, QuickNode, or a node you
     run). Empty means live mode stays off. */
  rpcUrl: '',

  /* The Solana address that receives plan payments. You must control its key.
     Empty means live mode stays off. */
  treasury: '',

  /* Plan prices in SOL. Keep them in step with the cards in index.html. */
  prices: {
    starter: { monthly: 0,    yearly: 0 },
    builder: { monthly: 0.35, yearly: 3.5 },
    studio:  { monthly: 1.2,  yearly: 12 }
  },

  /* Shown next to the SOL figure so the page does not have to fetch a price
     feed. Update it when it drifts far enough to matter. */
  solReferenceUsd: 180
};
