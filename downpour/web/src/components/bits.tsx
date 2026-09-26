import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dropGlyph } from '../data/currencies';
import { imageSrc } from '../lib/meta';
import type { Coin, Currency } from '../backend/types';
import { Close } from './icons';

/* ------------------------------ drops & badges ------------------------------ */

/** A water drop, drawn to look like the real thing: clear water that shows a
 *  flipped, darker sky, a dark band inside the rim, a hairline of light at the
 *  edge, a sharp highlight, light focused into a caustic, a hint of the currency's
 *  color, and the currency sign (or the coin's picture) inside. */
const DROP_PATH = 'M32 3C32 3 7 34 7 50a25 25 0 0 0 50 0C57 34 32 3 32 3z';

export function Drop({
  color,
  glyph,
  size = 44,
  image,
  label,
}: {
  color: string;
  glyph: string;
  size?: number;
  image?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, '');
  const len = [...glyph].length;
  const fs = len >= 4 ? 13 : len === 3 ? 16 : len === 2 ? 20 : 25;
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" aria-label={label} role={label ? 'img' : undefined}>
      <defs>
        {/* the sky seen through the drop, flipped: lighter below, darker above */}
        <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1422" stopOpacity="0.72" />
          <stop offset="0.55" stopColor="#1a2436" stopOpacity="0.62" />
          <stop offset="1" stopColor="#4a5d7c" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="32" cy="50" r="25" gradientUnits="userSpaceOnUse">
          <stop offset="0.62" stopColor="#000" stopOpacity="0" />
          <stop offset="0.86" stopColor="#02050c" stopOpacity="0.42" />
          <stop offset="1" stopColor="#02050c" stopOpacity="0.62" />
        </radialGradient>
        <radialGradient id={`k${id}`} cx="39" cy="66" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity="0.85" />
          <stop offset="0.45" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`s${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`e${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#dfe8ff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.4" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={DROP_PATH} />
        </clipPath>
      </defs>
      <path d={DROP_PATH} fill={`url(#w${id})`} />
      <path d={DROP_PATH} fill={color} opacity="0.2" />
      {image ? (
        <image href={imageSrc(image)} x="7" y="25" width="50" height="50" clipPath={`url(#c${id})`} preserveAspectRatio="xMidYMid slice" opacity="0.92" />
      ) : (
        <g fontFamily="Sora Variable, Sora, system-ui" fontWeight="800" fontSize={fs} textAnchor="middle">
          <text x="32.8" y="57.6" fill="#02050c" opacity="0.45">
            {glyph}
          </text>
          <text x="32" y="56.6" fill="#f3f7ff" opacity="0.94">
            {glyph}
          </text>
        </g>
      )}
      <g clipPath={`url(#c${id})`}>
        <circle cx="39" cy="66" r="13" fill={`url(#k${id})`} />
        <path d={DROP_PATH} fill={`url(#r${id})`} />
      </g>
      <path d={DROP_PATH} fill="none" stroke={`url(#e${id})`} strokeWidth="0.9" />
      <ellipse cx="18.5" cy="39" rx="3.1" ry="6.2" fill={`url(#s${id})`} transform="rotate(-30 18.5 39)" />
      <circle cx="45.5" cy="63.5" r="1.3" fill="#fff" opacity="0.55" />
    </svg>
  );
}

export function CurrencyDot({ c, size = 26 }: { c: Pick<Currency, 'code' | 'color'>; size?: number }) {
  const g = dropGlyph(c.code);
  return (
    <span
      className="cur-dot"
      style={{ width: size, height: size, fontSize: [...g].length > 2 ? size * 0.3 : size * 0.44, background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${c.color} 38%, ${c.color} 70%, #0a1226)` }}
      aria-hidden="true"
    >
      {g}
    </span>
  );
}

/** The pairing, impossible to miss: coin on the left, its currency on the right. */
export function PairBadge({ coin, currency, size = 'md' }: { coin: Pick<Coin, 'symbol'>; currency?: Pick<Currency, 'code' | 'color' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  if (!currency) return <span className={`pair pair-${size}`}>{coin.symbol}</span>;
  return (
    <span className={`pair pair-${size}`} title={`${coin.symbol} is paired with ${currency.name} (${currency.code})`}>
      <span className="pair-coin">{coin.symbol}</span>
      <span className="pair-slash" aria-hidden="true">/</span>
      <span className="pair-cur" style={{ '--c': currency.color } as React.CSSProperties}>
        <CurrencyDot c={currency} size={size === 'lg' ? 22 : size === 'sm' ? 15 : 18} />
        {currency.code}
      </span>
    </span>
  );
}

export function CoinDrop({ coin, currency, size = 44 }: { coin: Coin; currency?: Currency; size?: number }) {
  return (
    <Drop
      color={currency?.color ?? '#7cc4ff'}
      glyph={currency ? dropGlyph(currency.code) : coin.symbol.slice(0, 2)}
      image={coin.meta.image || undefined}
      size={size}
      label={`${coin.symbol} drop in ${currency?.code ?? ''}`}
    />
  );
}

export function StatusPill({ coin, now }: { coin: Coin; now: number }) {
  if (coin.graduated) return <span className="pill pool">In the pool</span>;
  if (now - coin.createdAt < 3600) return <span className="pill new">Just fell</span>;
  return <span className="pill curve">On the curve</span>;
}

export function ProgressBar({ value, full }: { value: number; full?: boolean }) {
  return (
    <div className={`bar ${full ? 'full' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.max(1.5, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/* ------------------------------ sparkline ------------------------------ */

export function Sparkline({ points, color = '#7cc4ff', height = 44 }: { points: number[]; color?: string; height?: number }) {
  const id = useId().replace(/:/g, '');
  if (points.length < 2) return <div style={{ height }} className="spark-empty" />;
  const w = 240;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || max || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, height - 4 - ((p - min) / span) * (height - 10)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${height} L0 ${height} Z`} fill={`url(#s${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------ misc ------------------------------ */

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement('textarea');
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          t.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-solid>
      <div className={`modal glass ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="kicker">{children}</div>;
}

export function PageHead({ kicker, title, lead, children }: { kicker: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <Kicker>{kicker}</Kicker>
      <h1 className="h-page">{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </header>
  );
}

export function CoinLink({ coin, children }: { coin: Coin; children: ReactNode }) {
  return <Link to={`/coin/${coin.address}`}>{children}</Link>;
}
