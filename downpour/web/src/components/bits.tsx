import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dropGlyph } from '../data/currencies';
import { imageSrc } from '../lib/meta';
import type { Coin, Currency } from '../backend/types';
import { Close } from './icons';

/* ------------------------------ stars & badges ------------------------------ */

type OrbProps = { color: string; glyph: string; size?: number; image?: string; label?: string };

/** A coin's mark. Large ones are drawn as a real star in the currency's colour (halo,
 *  fine diffraction spikes, an over-exposed core) with the currency's sign beside it,
 *  like a label on a star chart; a coin with its own picture shows the picture; small
 *  ones (list icons) are a round currency icon. */
export function Orb(props: OrbProps) {
  if (props.image || (props.size ?? 44) < 40) return <OrbIcon {...props} />;
  return <StarMark {...props} />;
}

function StarMark({ color, glyph, size = 44, label }: OrbProps) {
  const id = useId().replace(/:/g, '');
  const len = [...glyph].length;
  const fs = len >= 3 ? 11 : len === 2 ? 13 : 15;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={label} role={label ? 'img' : undefined} className="star-mark">
      <defs>
        <radialGradient id={`h${id}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity="0.6" />
          <stop offset="0.22" stopColor={color} stopOpacity="0.24" />
          <stop offset="0.55" stopColor={color} stopOpacity="0.06" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`c${id}`} cx="50" cy="50" r="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.7" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`x${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`y${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#h${id})`} />
      <path d="M0 50 50 48.9 100 50 50 51.1Z" fill={`url(#x${id})`} />
      <path d="M50 2 51.1 50 50 98 48.9 50Z" fill={`url(#y${id})`} />
      <g opacity="0.3" transform="rotate(45 50 50)">
        <path d="M22 50 50 49.4 78 50 50 50.6Z" fill={`url(#x${id})`} />
        <path d="M50 22 50.6 50 50 78 49.4 50Z" fill={`url(#y${id})`} />
      </g>
      <circle cx="50" cy="50" r="12" fill={`url(#c${id})`} />
      <circle cx="50" cy="50" r="3.4" fill="#fff" />
      <text x="63" y="71" fontFamily="Sora Variable, Sora, system-ui" fontWeight="700" fontSize={fs} fill="#fff" opacity="0.85">
        {glyph}
      </text>
    </svg>
  );
}

/** The round version: a small glowing world in the currency's colour with its sign
 *  (or the coin's picture) on its face. */
function OrbIcon({ color, glyph, size = 44, image, label }: OrbProps) {
  const id = useId().replace(/:/g, '');
  const len = [...glyph].length;
  const fs = len >= 4 ? 10 : len === 3 ? 12 : len === 2 ? 15 : 19;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={label} role={label ? 'img' : undefined} className="orb">
      <defs>
        <radialGradient id={`h${id}`} cx="32" cy="32" r="32" gradientUnits="userSpaceOnUse">
          <stop offset="0.5" stopColor={color} stopOpacity="0.55" />
          <stop offset="0.72" stopColor={color} stopOpacity="0.16" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`b${id}`} cx="25" cy="23" r="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.28" stopColor={color} />
          <stop offset="0.78" stopColor={color} />
          <stop offset="1" stopColor="#0b0724" />
        </radialGradient>
        <radialGradient id={`l${id}`} cx="32" cy="32" r="20" gradientUnits="userSpaceOnUse">
          <stop offset="0.72" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.96" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.7" />
        </radialGradient>
        <linearGradient id={`sx${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`sy${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <circle cx="32" cy="32" r="20" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#h${id})`} />
      <rect x="0" y="31.2" width="64" height="1.6" rx="0.8" fill={`url(#sx${id})`} />
      <rect x="31.2" y="0" width="1.6" height="64" rx="0.8" fill={`url(#sy${id})`} />
      <circle cx="32" cy="32" r="20" fill={`url(#b${id})`} />
      {image ? (
        <image href={imageSrc(image)} x="12" y="12" width="40" height="40" clipPath={`url(#c${id})`} preserveAspectRatio="xMidYMid slice" opacity="0.95" />
      ) : (
        <g fontFamily="Sora Variable, Sora, system-ui" fontWeight="800" fontSize={fs} textAnchor="middle" dominantBaseline="central">
          <text x="32.6" y="33.2" fill="#0b0724" opacity="0.35">
            {glyph}
          </text>
          <text x="32" y="32.4" fill="#fffdf5">
            {glyph}
          </text>
        </g>
      )}
      <circle cx="32" cy="32" r="20" fill={`url(#l${id})`} />
      <ellipse cx="24.5" cy="22.5" rx="5" ry="3" fill="#fff" opacity="0.5" transform="rotate(-35 24.5 22.5)" />
    </svg>
  );
}

export function CurrencyDot({ c, size = 26 }: { c: Pick<Currency, 'code' | 'color'>; size?: number }) {
  const g = dropGlyph(c.code);
  return (
    <span
      className="cur-dot"
      style={{ width: size, height: size, fontSize: [...g].length > 2 ? size * 0.3 : size * 0.44, background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${c.color} 38%, ${c.color} 70%, #0b0724)` }}
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

export function CoinOrb({ coin, currency, size = 44 }: { coin: Coin; currency?: Currency; size?: number }) {
  return (
    <Orb
      color={currency?.color ?? '#7cc4ff'}
      glyph={currency ? dropGlyph(currency.code) : coin.symbol.slice(0, 2)}
      image={coin.meta.image || undefined}
      size={size}
      label={`${coin.symbol} star in ${currency?.code ?? ''}`}
    />
  );
}

export function StatusPill({ coin, now }: { coin: Coin; now: number }) {
  if (coin.graduated) return <span className="pill pool">In the pool</span>;
  if (now - coin.createdAt < 3600) return <span className="pill new">Newborn</span>;
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
