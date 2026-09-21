import { asset, type AssetId, type FiatCurrency, FIAT_SYMBOL } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

/**
 * Money on screen. Amounts are tabular so columns line up, and a stablecoin
 * amount always shows its asset: "120.00 USDC", never a bare number.
 */
export function AssetAmount({
  value,
  assetId,
  className = "",
  showSymbol = true,
  sign,
}: {
  value: bigint;
  assetId: AssetId;
  className?: string;
  showSymbol?: boolean;
  sign?: "in" | "out";
}) {
  const a = asset(assetId);
  const [whole, frac = "00"] = formatUnits(value < 0n ? -value : value, a.decimals, 2).split(".");
  const prefix = sign === "in" ? "+" : sign === "out" ? "−" : value < 0n ? "−" : "";
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {prefix}
      {Number(whole).toLocaleString("en-US")}.{frac}
      {showSymbol && <span className="ml-1 text-[0.82em] font-medium opacity-70">{a.symbol}</span>}
    </span>
  );
}

export function FiatAmount({
  cents,
  currency,
  className = "",
  approx = false,
}: {
  cents: bigint;
  currency: FiatCurrency | string;
  className?: string;
  approx?: boolean;
}) {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {approx && "≈ "}
      {neg && "−"}
      {FIAT_SYMBOL[currency as FiatCurrency] ?? ""}
      {Number(whole).toLocaleString("en-US")}.{frac}
    </span>
  );
}

/** The wordmark for an asset: a coloured disc with the symbol's first letters. */
export function AssetMark({ assetId, size = 36 }: { assetId: AssetId; size?: number }) {
  const a = asset(assetId);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: a.colour, fontSize: size * 0.3 }}
      aria-hidden
    >
      {a.symbol.slice(0, 2)}
    </span>
  );
}
