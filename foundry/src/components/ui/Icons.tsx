import type { GeneratorIcon } from "@/lib/content/generators";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Original line icons for every generator, 24×24, inherit currentColor. */
export function GenIcon({ icon, className = "h-6 w-6" }: { icon: GeneratorIcon; className?: string }) {
  switch (icon) {
    case "cursor":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M6 3l12 9-5 1-2 6-2-6-3 2z" /></svg>);
    case "pick":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M4 20l9-9" /><path d="M9 5c3-2 7-2 10 1-3-1-6 0-8 2" /><path d="M19 6c2 3 2 7 1 10-1-3-2-5-4-7" /></svg>);
    case "mine":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M3 21h18" /><path d="M5 21V11l7-6 7 6v10" /><path d="M9 21v-6a3 3 0 0 1 6 0v6" /><path d="M9 11h6" /></svg>);
    case "rig":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M4 21h16" /><path d="M8 21l3-16h2l3 16" /><path d="M9.5 13h5M10.5 8h3" /><path d="M11 5l-6 4M13 5l6 4" /></svg>);
    case "ingot":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M3 17l3-8h12l3 8z" /><path d="M6 9l2 8M18 9l-2 8" /><path d="M9 13h6" /></svg>);
    case "refinery":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M3 21h18" /><rect x="5" y="9" width="4" height="12" rx="1" /><rect x="11" y="4" width="4" height="17" rx="1" /><path d="M17 21v-8M15 13h4" /><path d="M9 13h2M9 17h2" /><circle cx="13" cy="2.5" r="1" /></svg>);
    case "factory":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M3 21V10l5 3v-3l5 3v-3l5 3v8z" /><path d="M3 21h18" /><rect x="16" y="3" width="3" height="8" /><path d="M7 17h2M11 17h2M15 17h2" /></svg>);
    case "trade":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M12 3v18" /><path d="M5 7h14" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" /><path d="M8 21h8" /></svg>);
    case "bank":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M3 10l9-6 9 6" /><path d="M4 10h16" /><path d="M6 10v8M10 10v8M14 10v8M18 10v8" /><path d="M3 18h18v3H3z" /></svg>);
    case "exchange":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M4 20h16" /><path d="M7 16v-5M7 9V7" /><rect x="5.5" y="9" width="3" height="5" /><path d="M12 14v-2M12 6V4" /><rect x="10.5" y="6" width="3" height="6" /><path d="M17 17v-3M17 9V7" /><rect x="15.5" y="9" width="3" height="5" /></svg>);
    case "vault":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /><path d="M12 7v2M12 15v2M7 12h2M15 12h2" /></svg>);
    case "complex":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><path d="M2 21h20" /><path d="M3 21V9h5v12" /><path d="M8 21V5h6v16" /><path d="M14 21V11h6v10" /><path d="M10 8h2M10 12h2M10 16h2M16 14h2M16 18h2" /></svg>);
    case "orbital":
      return (<svg viewBox="0 0 24 24" className={className} {...P}><circle cx="12" cy="12" r="4" /><path d="M2.5 9.5c5-3 14-3 19 0" /><path d="M21.5 14.5c-5 3-14 3-19 0" /><path d="M12 2v3M12 19v3" /></svg>);
  }
}

export function Flame({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" />
    </svg>
  );
}
