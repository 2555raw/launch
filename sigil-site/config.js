/* Sigil — the settings an operator has to fill in before the site can take a
   real payment. Everything here is read at load time by account.js.

   Until `treasury` holds an address you control, the page refuses to start a
   live payment and runs the demo instead. That is deliberate: ETH sent to an
   address nobody holds the key for is gone, so there is no placeholder address
   in this file and you should not invent one. */

window.SIGIL_CONFIG = {
  /* The chain payments settle on, as the hex id a wallet reports.
       0xaa36a7  Sepolia, the test network. Test ETH is free from a faucet.
       0x1       Ethereum mainnet, where the money is real.
       0x2105    Base, if you would rather pay cents in gas than dollars. */
  chainId: '0xaa36a7',
  chainName: 'Sepolia',

  /* The Ethereum address that receives plan payments. You must control its key.
     Empty means live mode stays off. */
  treasury: '',

  /* Plan prices in ETH. Keep them in step with the cards in index.html.
     No RPC endpoint is needed: the visitor's wallet supplies one. */
  prices: {
    starter: { monthly: 0,    yearly: 0 },
    builder: { monthly: 0.35, yearly: 3.5 },
    studio:  { monthly: 1.2,  yearly: 12 }
  },

  /* Shown next to the ETH figure so the page does not have to fetch a price
     feed. Update it when it drifts far enough to matter. */
  ethReferenceUsd: 3200
};
