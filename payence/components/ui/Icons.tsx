import type { SVGProps } from "react";

/**
 * One icon set, drawn on a 24px grid at 1.6 stroke, in currentColor. Stroke
 * icons keep weight consistent with the type; nothing here is a stock glyph.
 */
const s = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Icon = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  wallet: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 8h15a3 3 0 0 1 3 3v0" />
      <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  scan: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3M4 12h16" />
    </svg>
  ),
  send: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M20 4 3.5 10.6a.5.5 0 0 0 .05.94l6.2 1.7 1.7 6.2a.5.5 0 0 0 .94.05z" />
      <path d="M20 4 10.2 13.8" />
    </svg>
  ),
  receive: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M12 4v12M7.5 11.5 12 16l4.5-4.5M5 20h14" />
    </svg>
  ),
  list: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.88.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.5z" />
    </svg>
  ),
  shield: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 8.1 7 9.5 4.1-1.4 7-5.3 7-9.5V6z" />
      <path d="m9.2 12 2 2 3.6-3.7" />
    </svg>
  ),
  bell: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 19a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M5 12h14" />
    </svg>
  ),
  swap: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </svg>
  ),
  store: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M4 9h16M5 9V6h14v3M5 9v10h14V9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  ),
  chart: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  code: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
    </svg>
  ),
  check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  ),
  close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  chevron: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  ),
  back: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  ),
  copy: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </svg>
  ),
  link: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M10 13a4 4 0 0 0 5.7.4l3-3A4 4 0 0 0 13 4.7l-1.7 1.7" />
      <path d="M14 11a4 4 0 0 0-5.7-.4l-3 3A4 4 0 0 0 11 19.3l1.7-1.7" />
    </svg>
  ),
  external: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  ),
  clock: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  phone: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  ),
  globe: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.4 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.4-3.3-8.5S9.8 5.9 12 3.5" />
    </svg>
  ),
  bolt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />
    </svg>
  ),
  lock: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  ),
  user: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  logout: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M15 12H5m0 0 3.5-3.5M5 12l3.5 3.5M12 5h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6" />
    </svg>
  ),
  refresh: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5" />
    </svg>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  ),
  download: (p: SVGProps<SVGSVGElement>) => (
    <svg {...s(p)}>
      <path d="M12 4v10M8 10.5 12 14.5l4-4M5 19h14" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
