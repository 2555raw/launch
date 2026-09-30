/**
 * Which studio selections can be launched on-chain today. Shared by the
 * studio (to show the wallet button) and the server (to accept the launch).
 */
export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/** Rough SOL a Pump.fun create costs before any opening buy (rent + fees). */
export const PUMP_CREATE_COST_SOL = 0.025;

export function canLaunchOnChain(f: { mode: string; pad: string; pair: string }): boolean {
  return f.mode === "create" && f.pad === "pump" && f.pair === "SOL";
}

export function pumpCoinUrl(mint: string) {
  return `https://pump.fun/coin/${mint}`;
}

export function solscanTxUrl(signature: string) {
  return `https://solscan.io/tx/${signature}`;
}

export function shortAddress(a: string) {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
