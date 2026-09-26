import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dropGlyph } from '../data/currencies';
import { imageSrc } from '../lib/meta';
import type { Coin, Currency } from '../backend/types';
import { Close } from './icons';
import { CurrencyLogo, hasLogo } from './CurrencyLogo';

/* ------------------------------ stars & badges ------------------------------ */

type OrbProps = { color: string; glyph: string; size?: number; image?: string; label?: string };

/** A coin's mark, small (list icons): a round icon in its currency's colour with the
 *  currency's sign, or the coin's own picture. On cards the coin is a StarToken. */
export function Orb(props: OrbProps) {
  return <OrbIcon {...props} />;
}

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

/** A colour as [r, g, b] 0..255, from #rrggbb or hsl(h s% l%). */
function rgbOf(c: string): [number, number, number] {
  if (c.startsWith('#') && c.length === 7) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (m) {
    const [h, s, l] = [+m[1], +m[2] / 100, +m[3] / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  }
  return [124, 196, 255];
}

/** The colour moved toward white (t > 0) or black (t < 0). */
function shade([r, g, b]: [number, number, number], t: number) {
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return `rgb(${Math.round(r + (to - r) * k)},${Math.round(g + (to - g) * k)},${Math.round(b + (to - b) * k)})`;
}

/** A coin's token on its card: a glossy star in its currency's colour, the currency's
 *  sign on it and the coin's ticker under the sign, like a toy balloon but a star. A coin
 *  with its own picture shows the picture instead. */
export function StarToken({ color, glyph, ticker, image, size = 118, label }: { color: string; glyph: string; ticker?: string; image?: string; size?: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  if (image) return <OrbIcon color={color} glyph={glyph} image={image} size={Math.round(size * 0.66)} label={label} />;
  const c = rgbOf(color);
  const star = (R: number, r: number, cx: number, cy: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? r : R;
      return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  const body = star(45, 22, 60, 62);
  const face = star(33, 16.5, 60, 60.5);
  const len = [...glyph].length;
  const fs = len >= 3 ? 15 : len === 2 ? 19 : 25;
  const tk = (ticker ?? '').toUpperCase();
  return (
    <svg className="star-token" width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label}>
      <defs>
        <radialGradient id={`f${id}`} cx="44" cy="40" r="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={shade(c, 0.6)} />
          <stop offset="0.3" stopColor={shade(c, 0.18)} />
          <stop offset="0.7" stopColor={shade(c, 0)} />
          <stop offset="1" stopColor={shade(c, -0.4)} />
        </radialGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`s${id}`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`d${id}`}>
          <stop offset="0" stopColor={shade(c, -0.6)} stopOpacity="0.32" />
          <stop offset="1" stopColor={shade(c, -0.6)} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* its shadow below, a dark rim, the rounded star, and a raised face lit from above */}
      <ellipse cx="60" cy="113" rx="30" ry="4.5" fill={`url(#d${id})`} />
      <polygon points={body} fill={shade(c, -0.45)} stroke={shade(c, -0.45)} strokeWidth="10.5" strokeLinejoin="round" opacity="0.55" />
      <polygon points={body} fill={`url(#f${id})`} stroke={`url(#f${id})`} strokeWidth="9" strokeLinejoin="round" />
      <polygon points={face} fill={`url(#b${id})`} stroke={`url(#b${id})`} strokeWidth="6" strokeLinejoin="round" />
      {/* gloss */}
      <ellipse cx="45" cy="38" rx="15" ry="7.5" transform="rotate(-28 45 38)" fill={`url(#s${id})`} opacity="0.85" />
      <circle cx="39" cy="34.5" r="2.2" fill="#fff" opacity="0.9" />
      {/* the currency's sign, and the coin's ticker under it */}
      <text x="60" y={tk ? 64 : 70} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#fff" stroke={shade(c, -0.5)} strokeOpacity="0.35" strokeWidth="1.6" paintOrder="stroke" style={{ fontFamily: 'var(--display)' }}>
        {glyph}
      </text>
      {tk && (
        <text
          x="60"
          y="78"
          textAnchor="middle"
          fontSize="7"
          fontWeight="800"
          letterSpacing="0.6"
          fill="#fff"
          fillOpacity="0.9"
          stroke={shade(c, -0.5)}
          strokeOpacity="0.3"
          strokeWidth="1.2"
          paintOrder="stroke"
          textLength={tk.length > 7 ? 38 : undefined}
          lengthAdjust="spacingAndGlyphs"
          style={{ fontFamily: 'var(--display)' }}
        >
          {tk}
        </text>
      )}
    </svg>
  );
}

/** A currency's icon: its real mark (flag, coin logo, metal) where it has one, else a
 *  dot in its colour with its sign. */
export function CurrencyDot({ c, size = 26 }: { c: Pick<Currency, 'code' | 'color'>; size?: number }) {
  if (hasLogo(c.code)) return <CurrencyLogo code={c.code} size={size} />;
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
