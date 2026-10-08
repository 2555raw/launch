import { isAddress, verifyMessage, type Address, type Hex } from 'viem';

export function buildEvmSignInMessage(input: { domain: string; address: string; nonce: string; issuedAt: string; chainId: number; statement?: string }): string {
  return [
    `${input.domain} wants you to sign in with your Ethereum account:`,
    input.address,
    '',
    input.statement ?? 'Sign this message to prove you own this wallet. This does not cost gas and does not authorize any transaction.',
    '',
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join('\n');
}

export async function verifyEvmSignature(message: string, signature: string, address: string): Promise<boolean> {
  if (!isAddress(address)) return false;
  try {
    return await verifyMessage({ address: address as Address, message, signature: signature as Hex });
  } catch {
    return false;
  }
}

export { isAddress as isValidEvmAddress };
