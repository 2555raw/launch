import "server-only";
import { ASSET_IDS, asset, type AssetId, type FiatCurrency } from "@/lib/assets";
import { convert } from "@/lib/money";
import { fiatRate } from "@/lib/providers/rates";
import { getBalances, type Owner } from "./ledger";

export type Holding = {
  asset: AssetId;
  available: bigint;
  pending: bigint;
  fiatAvailable: bigint;
  fiatPending: bigint;
  rate: string;
};

export type Portfolio = {
  currency: FiatCurrency;
  totalFiat: bigint;
  availableFiat: bigint;
  pendingFiat: bigint;
  holdings: Holding[];
  rateSource: string;
};

/**
 * The wallet view: every supported asset, with its fiat equivalent at today's
 * rate. Assets with no balance are included so the wallet is never an empty
 * page the user cannot act on.
 */
export async function portfolio(owner: Owner, currency: FiatCurrency): Promise<Portfolio> {
  const balances = new Map(getBalances(owner).map((b) => [b.asset, b]));
  const holdings: Holding[] = [];
  let availableFiat = 0n;
  let pendingFiat = 0n;
  let source = "";

  for (const assetId of ASSET_IDS.sort((a, b) => asset(a).rank - asset(b).rank)) {
    const b = balances.get(assetId) ?? { available: 0n, pending: 0n };
    const quote = await fiatRate(assetId, currency);
    source = quote.source;
    const decimals = asset(assetId).decimals;
    const fiatAvailable = convert(b.available, decimals, 2, quote.rate);
    const fiatPending = convert(b.pending, decimals, 2, quote.rate);
    availableFiat += fiatAvailable;
    pendingFiat += fiatPending;
    holdings.push({ asset: assetId, available: b.available, pending: b.pending, fiatAvailable, fiatPending, rate: quote.rate });
  }

  return {
    currency,
    totalFiat: availableFiat + pendingFiat,
    availableFiat,
    pendingFiat,
    holdings,
    rateSource: source,
  };
}
