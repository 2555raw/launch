import { cn } from "@/lib/cn";
import { getChain, getPad } from "@/lib/pads";

/**
 * Original monogram tiles for pads and chains. Third-party logos are not
 * bundled; each venue gets a colour and a two-letter mark instead.
 */
export function PadGlyph({ pad: id, size = "md", className }: { pad: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const pad = getPad(id);
  if (!pad) return null;
  const sizes = {
    sm: "size-6 rounded-md text-[10px]",
    md: "size-9 rounded-lg text-[13px]",
    lg: "size-12 rounded-xl text-base",
    xl: "size-20 rounded-2xl text-2xl",
  };
  return (
    <span
      aria-hidden="true"
      className={cn("relative grid shrink-0 place-items-center overflow-hidden font-mono font-semibold", sizes[size], className)}
      style={{
        color: pad.color,
        background: `linear-gradient(145deg, color-mix(in srgb, ${pad.color} 22%, #111418), color-mix(in srgb, ${pad.color} 6%, #0c0e11))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${pad.color} 30%, transparent)`,
      }}
    >
      <span
        className="absolute -right-1/4 -top-1/4 size-3/4 rotate-12 rounded-[30%] opacity-25"
        style={{ background: pad.color }}
      />
      <span className="relative">{pad.monogram}</span>
    </span>
  );
}

export function ChainDot({ chain: id, className }: { chain: string; className?: string }) {
  const chain = getChain(id);
  if (!chain) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: chain.color, boxShadow: `0 0 0 2px color-mix(in srgb, ${chain.color} 25%, transparent)` }}
    />
  );
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
