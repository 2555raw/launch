import { useId } from 'react';
import { FLAGS } from '../data/flags';

const MARKS = new Set(['BTC', 'ETH', 'SOL', 'XAU', 'XAG', 'XPT']);

/** Whether a currency has a real mark to show (see CurrencyLogo). */
export function hasLogo(code: string) {
  return !!FLAGS[code] || MARKS.has(code);
}

/** A currency's real mark: its country's flag for money, the coin's own logo for
 *  bitcoin, ether and solana, a bar of metal for gold, silver and platinum. Returns
 *  null when there is none, so the caller can fall back to the currency's glyph. */
export function CurrencyLogo({ code, size = 26 }: { code: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  const flag = FLAGS[code];
  if (flag) {
    return <img className="cur-logo" src={`${import.meta.env.BASE_URL}flags/${flag}.svg`} width={size} height={size} alt="" loading="lazy" decoding="async" />;
  }
  const box = { width: size, height: size, viewBox: '0 0 32 32', className: 'cur-logo', 'aria-hidden': true } as const;
  switch (code) {
    case 'BTC':
      return (
        <svg {...box}>
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <g transform="rotate(14 16 16)" fill="#fff">
            <path
              fillRule="evenodd"
              d="M10.6 8.6h6.6c2.7 0 4.4 1.4 4.4 3.6 0 1.5-.9 2.6-2.3 3.1 1.9.3 3.1 1.7 3.1 3.5 0 2.5-2 4.2-5 4.2h-6.8v-2.3h1.7V10.9h-1.7zm4.2 2.3v4.1h2.3c1.3 0 2.1-.8 2.1-2.1s-.8-2-2.1-2zm0 6.3v4.6h2.7c1.6 0 2.4-.8 2.4-2.3s-.8-2.3-2.4-2.3z"
            />
            <rect x="13" y="6.2" width="1.6" height="3" rx="0.3" />
            <rect x="15.9" y="6.2" width="1.6" height="3" rx="0.3" />
            <rect x="13" y="22.6" width="1.6" height="3" rx="0.3" />
            <rect x="15.9" y="22.6" width="1.6" height="3" rx="0.3" />
          </g>
        </svg>
      );
    case 'ETH':
      return (
        <svg {...box}>
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <g fill="#fff">
            <path fillOpacity="0.6" d="M16.5 4v8.87l7.5 3.35z" />
            <path d="M16.5 4 9 16.22l7.5-3.35z" />
            <path fillOpacity="0.6" d="M16.5 21.97V28L24 17.62z" />
            <path d="M16.5 28v-6.03L9 17.62z" />
            <path fillOpacity="0.2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" />
            <path fillOpacity="0.6" d="m9 16.22 7.5 4.35v-7.7z" />
          </g>
        </svg>
      );
    case 'SOL':
      return (
        <svg {...box}>
          <defs>
            <linearGradient id={`s${id}`} x1="7" y1="24" x2="25" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#9945FF" />
              <stop offset="1" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#0c0b14" />
          <g fill={`url(#s${id})`}>
            <path d="M10.3 20.1a.8.8 0 0 1 .56-.23h13.2c.36 0 .54.43.28.69l-2.44 2.44a.8.8 0 0 1-.56.23H8.14c-.36 0-.54-.43-.28-.69z" />
            <path d="M10.3 9.23A.8.8 0 0 1 10.86 9h13.2c.36 0 .54.43.28.69l-2.44 2.44a.8.8 0 0 1-.56.23H8.14c-.36 0-.54-.43-.28-.69z" />
            <path d="M21.7 14.63a.8.8 0 0 0-.56-.23H7.94c-.36 0-.54.43-.28.69l2.44 2.44c.15.15.35.23.56.23h13.2c.36 0 .54-.43.28-.69z" />
          </g>
        </svg>
      );
    case 'XAU':
    case 'XAG':
    case 'XPT': {
      const [a, b, bg] = code === 'XAU' ? ['#fbe18a', '#c8961c', '#3a2a08'] : code === 'XAG' ? ['#f4f6f8', '#9ba3ab', '#23272c'] : ['#eef2f5', '#8e9eab', '#1d252c'];
      return (
        <svg {...box}>
          <defs>
            <linearGradient id={`m${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={a} />
              <stop offset="1" stopColor={b} />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill={bg} />
          <path d="M9.2 12.5h13.6l3 8H6.2z" fill={`url(#m${id})`} />
          <path d="M9.2 12.5h13.6l-1.2 2.2H10.4z" fill="#fff" fillOpacity="0.45" />
          <path d="M6.2 20.5h19.6v1.6H6.2z" fill={b} />
        </svg>
      );
    }
    default:
      return null;
  }
}
