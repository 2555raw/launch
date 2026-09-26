/* Small inline icons, drawn for this site. */

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-drop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9dbff" />
          <stop offset="1" stopColor="#2f7de1" />
        </linearGradient>
      </defs>
      <path d="M32 4C32 4 12 28 12 40a20 20 0 0 0 40 0C52 28 32 4 32 4z" fill="url(#logo-drop)" />
      <path d="M35 22 25 40h8l-3 14 11-19h-8l2-13z" fill="#ffe066" stroke="#0b1220" strokeWidth="1.5" strokeLinejoin="round" />
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

export function Bolt({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.2 1 3 9h4l-1.2 6L13 7H9l.2-6z" fill="currentColor" />
    </svg>
  );
}

export function DropIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="currentColor" />
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
