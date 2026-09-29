const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUsd(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "—";
  return compact && Math.abs(value) >= 10_000 ? usdCompact.format(value) : usd.format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2629800, "month"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let unit: Intl.RelativeTimeFormatUnit = "second";
  let size = 1;
  for (const [s, u] of units) if (diff >= s) [size, unit] = [s, u];
  return rtf.format(-Math.round(diff / size), unit);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
