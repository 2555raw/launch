/* A local node answering as Robinhood Testnet, for the tests. */
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
