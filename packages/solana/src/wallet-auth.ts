import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/** Human-readable sign-in message (SIWS-style). Both the client and the server build it with this. */
export function buildSolanaSignInMessage(input: { domain: string; address: string; nonce: string; issuedAt: string; statement?: string }): string {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    '',
    input.statement ?? 'Sign this message to prove you own this wallet. This does not cost gas and does not authorize any transaction.',
    '',
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join('\n');
}

export function verifySolanaSignature(message: string, signature: string, address: string): boolean {
  try {
    const sig = decodeSignature(signature);
    const pk = new PublicKey(address).toBytes();
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pk);
  } catch {
    return false;
  }
}

function decodeSignature(sig: string): Uint8Array {
  if (/^[0-9a-fA-F]{128}$/.test(sig)) return Uint8Array.from(Buffer.from(sig, 'hex'));
  try {
    const b = bs58.decode(sig);
    if (b.length === 64) return b;
  } catch {
    /* fallthrough */
  }
  const b64 = Buffer.from(sig, 'base64');
  if (b64.length === 64) return Uint8Array.from(b64);
  throw new Error('Unrecognised signature encoding');
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(address).toBytes()) || new PublicKey(address).toBytes().length === 32;
  } catch {
    return false;
  }
}
