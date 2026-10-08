import { formatUnits, type Address, type PublicClient } from 'viem';
import { LAUNCH_TOKEN_ABI } from './token.js';

export async function getNativeBalance(client: PublicClient, address: Address): Promise<{ wei: bigint; eth: string }> {
  const wei = await client.getBalance({ address });
  return { wei, eth: formatUnits(wei, 18) };
}

export async function getErc20Balance(client: PublicClient, token: Address, owner: Address): Promise<{ raw: bigint; decimals: number; formatted: string }> {
  const [raw, decimals] = await Promise.all([
    client.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: 'balanceOf', args: [owner] }) as Promise<bigint>,
    client.readContract({ address: token, abi: LAUNCH_TOKEN_ABI, functionName: 'decimals' }) as Promise<number>,
  ]);
  return { raw, decimals: Number(decimals), formatted: formatUnits(raw, Number(decimals)) };
}
