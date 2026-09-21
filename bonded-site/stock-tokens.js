/* Candidate addresses of Robinhood's stock tokens on Robinhood Chain (chain 4663).
   Collected from third-party write-ups, NOT verified here: the live adapter checks each one
   with the Pons factory's approvedPairTokens() before using it, and drops the rest with a
   console warning. Confirm them against docs.robinhood.com/chain/contracts and with
   `node scripts/verify-pons.mjs` before trusting them with money. Add or replace freely. */
window.BONDED_STOCK_TOKENS = {
  AAPL:  '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
  NVDA:  '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
  TSLA:  '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
  MSFT:  '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
  GOOGL: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',
  AMZN:  '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
  META:  '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',
  // SPY, COIN, HOOD, MSTR, PLTR, RDDT, SHOP: reported as Robinhood tokens / Pons quotes, addresses still to be pinned.
  // SPACEX: a private-company token; not known to be an approved quote. Verify before offering it.
};
