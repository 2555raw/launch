/**
 * The card networks a Payence card can be issued on.
 *
 * These are Payence's own networks, with marks drawn for this page. Real scheme
 * marks — Visa, Mastercard, American Express and the rest — are registered
 * trademarks, and putting one on a card implies an issuing agreement, so they
 * are deliberately not reproduced here. If you license a scheme's brand assets,
 * swapping one in is a single component: keep the viewBox at 44×24, draw in
 * `currentColor`, and the mark will take the colour of whatever card face it
 * lands on.
 */

type MarkProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 44 24" className={`h-6 w-11 ${className}`} aria-hidden>
      {children}
    </svg>
  );
}

const VantageMark = ({ className }: MarkProps) => (
  <Frame className={className}>
    <path d="M6 17l7-9 7 9" {...base} />
    <path d="M20 17l7-9 7 9" {...base} opacity={0.55} />
  </Frame>
);

const MeridianMark = ({ className }: MarkProps) => (
  <Frame className={className}>
    <circle cx="22" cy="12" r="8.5" {...base} />
    <ellipse cx="22" cy="12" rx="3.6" ry="8.5" {...base} opacity={0.6} />
    <path d="M13.9 9h16.2M13.9 15h16.2" {...base} opacity={0.6} />
  </Frame>
);

const AxiomMark = ({ className }: MarkProps) => (
  <Frame className={className}>
    <rect x="13.5" y="3.5" width="17" height="17" rx="3" transform="rotate(45 22 12)" {...base} />
    <path d="M17 12h10" {...base} opacity={0.6} />
  </Frame>
);

const NorthlineMark = ({ className }: MarkProps) => (
  <Frame className={className}>
    <path d="M22 4l8 14H14z" {...base} />
    <path d="M18 18h8" {...base} opacity={0.6} />
  </Frame>
);

const CoreoMark = ({ className }: MarkProps) => (
  <Frame className={className}>
    <path d="M12 17V11M22 17V6M32 17v-8" {...base} strokeWidth={2.6} />
    <path d="M9 20h26" {...base} opacity={0.5} />
  </Frame>
);

export type Network = {
  id: string;
  name: string;
  blurb: string;
  Mark: (props: MarkProps) => JSX.Element;
};

export const NETWORKS: Network[] = [
  { id: "vantage", name: "Vantage", blurb: "Global · default", Mark: VantageMark },
  { id: "meridian", name: "Meridian", blurb: "Cross-border", Mark: MeridianMark },
  { id: "axiom", name: "Axiom", blurb: "Corporate", Mark: AxiomMark },
  { id: "northline", name: "Northline", blurb: "Domestic", Mark: NorthlineMark },
  { id: "coreo", name: "Coreo", blurb: "High volume", Mark: CoreoMark },
];
