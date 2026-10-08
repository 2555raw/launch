const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** Compact game-number formatting: 1234 -> 1,234 ; 12345678 -> 12.35M */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs < 1000) return abs < 10 && abs !== Math.floor(abs) ? n.toFixed(1) : Math.floor(n).toLocaleString("en-US");
  const tier = Math.min(Math.floor(Math.log10(abs) / 3), SUFFIXES.length - 1);
  const scaled = n / Math.pow(10, tier * 3);
  return `${scaled.toFixed(digits)}${SUFFIXES[tier]}`;
}

/** Full number with thousands separators, for token supply figures. */
export function fmtFull(n: number, maxFraction = 0): string {
  if (!Number.isFinite(n)) return "∞";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFraction });
}

export function fmtPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return "00 : 00 : 00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => x.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)} : ${pad(m)} : ${pad(sec)}` : `${pad(h)} : ${pad(m)} : ${pad(sec)}`;
}

export function shortAddress(a: string, n = 4): string {
  return a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}
