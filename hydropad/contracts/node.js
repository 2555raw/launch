const ganache = require('ganache');
const server = ganache.server({
  logging: { quiet: true },
  wallet: { totalAccounts: 3, defaultBalance: 100, deterministic: true },
  chain: { chainId: 31337, networkId: 31337, hardfork: 'merge' },
  miner: { blockGasLimit: 30000000 },
});
server.listen(8545, err => {
  if (err) { console.error(err); process.exit(1); }
  console.log('ganache on 8545');
});
