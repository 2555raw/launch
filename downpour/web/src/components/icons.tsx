/* Small inline icons, drawn for this site. */

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="logo-coin" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#8f7bff" />
          <stop offset="0.6" stopColor="#3a2a9e" />
          <stop offset="1" stopColor="#120c3a" />
        </radialGradient>
        <linearGradient id="logo-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9fdcff" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#logo-coin)" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#b9adff" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M32 11c1.6 11.2 9.8 19.4 21 21-11.2 1.6-19.4 9.8-21 21-1.6-11.2-9.8-19.4-21-21 11.2-1.6 19.4-9.8 21-21z" fill="url(#logo-star)" />
      <path d="M48 12c.5 3.4 2.6 5.5 6 6-3.4.5-5.5 2.6-6 6-.5-3.4-2.6-5.5-6-6 3.4-.5 5.5-2.6 6-6z" fill="#fff" />
    </svg>
  );
}

export function Arrow({ dir = 'ne', size = 14 }: { dir?: 'ne' | 'right' | 'down'; size?: number }) {
  const d = dir === 'ne' ? 'M5 11 11 5M6 5h5v5' : dir === 'right' ? 'M3 8h10M9 4l4 4-4 4' : 'M8 3v10M4 9l4 4 4-4';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1c.5 3.6 2.4 5.5 7 7-4.6 1.5-6.5 3.4-7 7-.5-3.6-2.4-5.5-7-7 4.6-1.5 6.5-3.4 7-7z" fill="currentColor" />
    </svg>
  );
}

export function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1.2 2 4.3 4.7.6-3.4 3.2.9 4.7L8 11.7 3.8 14l.9-4.7L1.3 6.1 6 5.5z" fill="currentColor" />
    </svg>
  );
}

export function Swap({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3v13M2.5 12.5 6 16l3.5-3.5M14 17V4M10.5 7.5 14 4l3.5 3.5" />
    </svg>
  );
}

export function Close({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

export function Search({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}

export function Chevron({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function Menu({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}

export function Gear({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
