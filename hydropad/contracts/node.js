/* A local node that answers as whichever chain the tests want. Defaults to
 * Robinhood Testnet (46630), which is what the front end is aimed at, so the
 * wallet run exercises the same code path a real wallet would. */
const ganache = require('ganache');
const CHAIN = Number(process.env.CHAIN_ID || 46630);
const server = ganache.server({
  logging: { quiet: true },
  wallet: { totalAccounts: 3, defaultBalance: 100, deterministic: true },
  chain: { chainId: CHAIN, networkId: CHAIN, hardfork: 'merge' },
  miner: { blockGasLimit: 30000000 },
});
server.listen(8545, err => {
  if (err) { console.error(err); process.exit(1); }
  console.log('ganache on 8545, chain ' + CHAIN);
});
