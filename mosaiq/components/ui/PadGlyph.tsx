import Image from "next/image";
import { cn } from "@/lib/cn";
import { getAsset, getChain, getPad } from "@/lib/pads";

/** A square/round logo box. The logo fills it; size and radius come from the class. */
function Logo({ src, sizes, className, alt = "" }: { src: string; sizes: string; className?: string; alt?: string }) {
  return (
    <span aria-hidden={alt ? undefined : true} className={cn("relative inline-block shrink-0 overflow-hidden", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" unoptimized={src.endsWith(".svg")} />
    </span>
  );
}

const padSizes = {
  sm: "size-6 rounded-md",
  md: "size-9 rounded-lg",
  lg: "size-12 rounded-xl",
  xl: "size-20 rounded-2xl",
};

/** A launchpad's real logo. */
export function PadGlyph({ pad: id, size = "md", className }: { pad: string; size?: keyof typeof padSizes; className?: string }) {
  const pad = getPad(id);
  if (!pad) return null;
  return <Logo src={pad.logo} sizes={size === "xl" ? "96px" : "48px"} className={cn(padSizes[size], "bg-surface-3", className)} />;
}

/** A chain's logo as a small round badge (defaults to 16px). */
export function ChainDot({ chain: id, className }: { chain: string; className?: string }) {
  const chain = getChain(id);
  if (!chain) return null;
  return <Logo src={chain.logo} sizes="24px" className={cn("size-4 rounded-full", className)} />;
}

/** Logo for a pair asset or tokenised stock. */
export function AssetIcon({ symbol, className }: { symbol: string; className?: string }) {
  const asset = getAsset(symbol);
  if (!asset) return null;
  return <Logo src={asset.logo} sizes="32px" className={cn("size-5 rounded-full bg-surface-3", className)} />;
}

export function TokenAvatar({ image, ticker, color, className }: { image?: string; ticker: string; color?: string; className?: string }) {
  // Callers pass their own size/radius; fall back to 48px rounded-xl.
  const base = /\bsize-/.test(className ?? "") ? "" : "size-12";
  const radius = /\brounded-/.test(className ?? "") ? "" : "rounded-xl";
  return image ? (
    // Token images are small data URLs produced by the studio, so next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={48} height={48} loading="lazy" decoding="async" className={cn(base, radius, "shrink-0 object-cover", className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center bg-surface-3 font-mono text-sm font-semibold", base, radius, className)}
      style={color ? { color } : undefined}
    >
      {ticker.slice(0, 2)}
    </span>
  );
}
