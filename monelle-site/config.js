/* Monelle — the settings an operator has to fill in before the site can take a
   real payment. Everything here is read at load time by account.js.

   Until `treasury` holds an address you control, the page refuses to start a
   live payment and runs the demo instead. That is deliberate: ETH sent to an
   address nobody holds the key for is gone, so there is no placeholder address
   in this file and you should not invent one. */

window.MONELLE_CONFIG = {
  /* The chain payments settle on, as the hex id a wallet reports.
       0xaa36a7  Sepolia, the test network. Test ETH is free from a faucet.
       0x1       Ethereum mainnet, where the money is real.
       0x2105    Base, if you would rather pay cents in gas than dollars. */
  chainId: '0xaa36a7',
  chainName: 'Sepolia',

  /* The Ethereum address that receives plan payments. You must control its key.
     Empty means live mode stays off. */
  treasury: '',

  /* Plans are priced in dollars, because that is the number a buyer reasons
     about. The ETH actually charged is worked out from `ethReferenceUsd`
     below, so the cards and the checkout can never drift apart. */
  prices: {
    starter: { monthly: 0,  yearly: 0 },
    builder: { monthly: 59, yearly: 590 },   // two months free on the year
    studio:  { monthly: 159, yearly: 1590 }
  },

  /* What one ETH is worth, in dollars.

     This is a fixed number, not a price feed, so the ETH charged drifts from
     the dollar price as the market moves. That is fine for a demo and wrong
     for a real storefront: before taking live payments, either quote in a
     stablecoin or read a feed (Chainlink, Coinbase, your own) here. */
  ethReferenceUsd: 2500
};
