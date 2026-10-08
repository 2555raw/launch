import { defineChain } from 'viem';
import { ROBINHOOD_CHAIN_NETWORKS } from '@launch/config/chains';

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_NETWORKS.mainnet.chainId,
  name: ROBINHOOD_CHAIN_NETWORKS.mainnet.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_CHAIN_NETWORKS.mainnet.rpc] } },
  blockExplorers: { default: { name: 'Blockscout', url: ROBINHOOD_CHAIN_NETWORKS.mainnet.explorer } },
});

export const robinhoodChainTestnet = defineChain({
  id: ROBINHOOD_CHAIN_NETWORKS.testnet.chainId,
  name: ROBINHOOD_CHAIN_NETWORKS.testnet.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_CHAIN_NETWORKS.testnet.rpc] } },
  blockExplorers: { default: { name: 'Blockscout', url: ROBINHOOD_CHAIN_NETWORKS.testnet.explorer } },
  testnet: true,
});

export type RobinhoodNetwork = keyof typeof ROBINHOOD_CHAIN_NETWORKS;

export function robinhoodChainFor(network: RobinhoodNetwork) {
  return network === 'mainnet' ? robinhoodChain : robinhoodChainTestnet;
}
