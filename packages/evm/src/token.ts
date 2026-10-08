import { createPublicClient, http, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import artifact from './artifacts/LaunchToken.json' with { type: 'json' };
import { robinhoodChainFor, type RobinhoodNetwork } from './chains.js';

export const LAUNCH_TOKEN_ABI = artifact.abi as Abi;
export const LAUNCH_TOKEN_BYTECODE = artifact.bytecode as Hex;
export const LAUNCH_TOKEN_COMPILER = artifact.compiler as string;
export const LAUNCH_TOKEN_SOURCE = artifact.source as string;

export const UINT256_MAX = (1n << 256n) - 1n;

export function rawSupply(totalSupply: bigint, decimals: number): bigint {
  const raw = totalSupply * 10n ** BigInt(decimals);
  if (raw > UINT256_MAX) throw new Error('Supply exceeds uint256');
  return raw;
}

export function validateErc20Input(input: { name: string; symbol: string; decimals: number; totalSupply: bigint }): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.length > 64) errors.push('Name must be 1-64 characters');
  if (!input.symbol || input.symbol.length > 12) errors.push('Symbol must be 1-12 characters');
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 18) errors.push('Decimals must be an integer between 0 and 18');
  if (input.totalSupply <= 0n) errors.push('Total supply must be positive');
  try {
    rawSupply(input.totalSupply, input.decimals);
  } catch (e) {
    errors.push((e as Error).message);
  }
  return errors;
}

/** Constructor arguments in ABI order for `deployContract`. */
export function launchTokenConstructorArgs(input: { name: string; symbol: string; decimals: number; totalSupply: bigint; owner: Address; fixedSupply: boolean }) {
  return [input.name, input.symbol, input.decimals, rawSupply(input.totalSupply, input.decimals), input.owner, input.fixedSupply] as const;
}

export function createRobinhoodPublicClient(network: RobinhoodNetwork, rpcUrl?: string): PublicClient {
  const chain = robinhoodChainFor(network);
  return createPublicClient({ chain, transport: http(rpcUrl ?? chain.rpcUrls.default.http[0]) });
}

export interface VerifiedErc20 {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  /** raw supply */
  totalSupply: bigint;
  owner: Address | null;
  mintingDisabled: boolean | null;
  deployer: Address;
  txHash: Hex;
  blockNumber: bigint;
  chainId: number;
}

export class EvmVerificationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Confirms a contract-creation transaction and reads the deployed ERC-20's state from the chain. */
export async function verifyErc20Deployment(client: PublicClient, txHash: Hex, expectedAddress?: string): Promise<VerifiedErc20> {
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) throw new EvmVerificationError('TX_NOT_FOUND', 'Transaction not found or not yet mined');
  if (receipt.status !== 'success') throw new EvmVerificationError('TX_FAILED', 'Transaction reverted');
  const address = receipt.contractAddress;
  if (!address) throw new EvmVerificationError('NOT_A_DEPLOYMENT', 'Transaction did not create a contract');
  if (expectedAddress && address.toLowerCase() !== expectedAddress.toLowerCase()) throw new EvmVerificationError('ADDRESS_MISMATCH', 'Deployed address does not match');
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new EvmVerificationError('NO_CODE', 'No bytecode at the contract address');

  const read = <T>(functionName: string) => client.readContract({ address, abi: LAUNCH_TOKEN_ABI, functionName }) as Promise<T>;
  const [name, symbol, decimals, totalSupply] = await Promise.all([read<string>('name'), read<string>('symbol'), read<number>('decimals'), read<bigint>('totalSupply')]);
  const owner = await read<Address>('owner').catch(() => null);
  const mintingDisabled = await read<boolean>('mintingDisabled').catch(() => null);
  const chainId = await client.getChainId();
  return { address, name, symbol, decimals: Number(decimals), totalSupply, owner, mintingDisabled, deployer: receipt.from, txHash, blockNumber: receipt.blockNumber, chainId };
}

export async function getTxStatus(client: PublicClient, txHash: Hex): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'FAILED'; blockNumber: bigint | null }> {
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) return { status: 'PENDING', blockNumber: null };
  return { status: receipt.status === 'success' ? 'CONFIRMED' : 'FAILED', blockNumber: receipt.blockNumber };
}
