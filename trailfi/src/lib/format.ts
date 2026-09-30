export function shortAddress(address?: string | null, head = 6, tail = 4): string {
  if (!address) return "";
  return address.length <= head + tail + 1 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function fmtSteps(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtAmount(n: number | string, digits = 2): string {
  const v = typeof n === "string" ? Number(n) : n;
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
}

export function fmtUsd(n: number | string): string {
  return `$${fmtAmount(n)}`;
}

export function fmtDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export function fmtDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
