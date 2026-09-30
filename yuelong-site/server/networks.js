/* The chains Yuelong knows about. A chain goes live on the site once it has a deployment:
 * from deployments.json in the repo, or saved by the owner through /admin.html into DATA_DIR.
 * RPC_<chainId> and EXPLORER_<chainId> environment variables override the defaults. */
const NETWORKS = [
  { key: 'bittensor', chainId: 964, name: 'Bittensor EVM', short: 'Bittensor', native: 'TAO', rpc: 'https://lite.chain.opentensor.ai', explorer: 'https://evm.taostats.io', logChunk: 500 },
  { key: 'bittensor-testnet', chainId: 945, name: 'Bittensor EVM Testnet', short: 'Bittensor testnet', native: 'TAO', rpc: 'https://test.chain.opentensor.ai', explorer: '', logChunk: 500, testnet: true },
  { key: 'robinhood', chainId: 4663, name: 'Robinhood Chain', short: 'Robinhood', native: 'ETH', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: '', logChunk: 2000 },
  { key: 'robinhood-testnet', chainId: 46630, name: 'Robinhood Chain Testnet', short: 'Robinhood testnet', native: 'ETH', rpc: 'https://rpc.testnet.chain.robinhood.com', explorer: '', logChunk: 2000, testnet: true },
  { key: 'local', chainId: 31337, name: 'Local chain', short: 'Local', native: 'TAO', rpc: 'http://127.0.0.1:8545', explorer: '', logChunk: 2000, testnet: true, local: true },
];

for (const n of NETWORKS) {
  if (process.env['RPC_' + n.chainId]) n.rpc = process.env['RPC_' + n.chainId];
  if (process.env['EXPLORER_' + n.chainId] !== undefined) n.explorer = process.env['EXPLORER_' + n.chainId];
}

const byChainId = (id) => NETWORKS.find((n) => n.chainId === Number(id));

module.exports = { NETWORKS, byChainId };
