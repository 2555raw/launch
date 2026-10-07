import { cn } from "@/lib/cn";

const LOGOS: Record<string, string> = {
  ETH: "/tokens/eth.svg",
  USDG: "/tokens/usdg.png",
};

/** The payout token's logo (ETH on Robinhood Chain). Renders nothing for tokens without one. */
export function TokenIcon({ symbol = "ETH", className }: { symbol?: string; className?: string }) {
  const src = LOGOS[symbol.toUpperCase()];
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={symbol} className={cn("inline-block h-4 w-4 shrink-0 rounded-full align-[-0.15em]", className)} />;
}
