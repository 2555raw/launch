// A local copy of Robinhood Chain mainnet, for rehearsing the deploy against the real
// PoolManager and the real stock tokens. Not used for anything that touches mainnet.
module.exports = {
  networks: { hardhat: { chainId: 4663, hardfork: 'cancun', forking: { url: process.env.FORK_RPC || 'https://rpc.mainnet.chain.robinhood.com' } } },
  paths: { sources: './src-not-used-by-hardhat' },
};
