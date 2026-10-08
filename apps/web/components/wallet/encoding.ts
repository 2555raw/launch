/** Browser-safe base64 helpers (no Node Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Converts a human amount ("1.5") to the smallest unit as a decimal string, without floats. */
export function toSmallestUnits(amount: string, decimals: number): string | null {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(amount.trim());
  if (!m || (m[1] === '' && !m[2])) return null;
  const whole = m[1] || '0';
  const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  const raw = BigInt(whole + frac);
  return raw > 0n ? raw.toString() : null;
}

/** Friendly messages for common wallet / RPC failures. */
export function walletErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) return 'You rejected the request in your wallet.';
  if (lower.includes('insufficient') || lower.includes('debit an account but found no record') || lower.includes('exceeds the balance')) return 'Insufficient funds in the connected wallet to pay for this transaction.';
  if (lower.includes('blockhash') && lower.includes('expired')) return 'The transaction expired before it was confirmed. Please try again.';
  return msg;
}
