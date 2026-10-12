/** Small date/duration formatting helpers shared by the game and admin pages. */
import { tGlobal } from '@/lib/i18n';

export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** "3m ago", "2h ago", "5d ago" (or "just now"). */
export function ago(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = (typeof iso === 'string' ? new Date(iso) : iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return tGlobal('just now');
  const m = Math.floor(s / 60);
  if (m < 60) return tGlobal('{n}m ago', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tGlobal('{n}h ago', { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return tGlobal('{n}d ago', { n: d });
  return tGlobal('{n}mo ago', { n: Math.floor(d / 30) });
}

/** Formats a duration given in seconds: "45s", "3m 10s", "2h 5m", "1d 3h". */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return tGlobal('{n}s', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? tGlobal('{m}m {s}s', { m, s: s % 60 }) : tGlobal('{n}m', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? tGlobal('{h}h {m}m', { h, m: m % 60 }) : tGlobal('{n}h', { n: h });
  const d = Math.floor(h / 24);
  return h % 24 ? tGlobal('{d}d {h}h', { d, h: h % 24 }) : tGlobal('{n}d', { n: d });
}

/** Signed number: "+12", "-4", "0". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
