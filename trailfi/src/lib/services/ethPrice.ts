import "server-only";
import { HttpError } from "@/lib/api";

/** Prices outside this range mean a broken source, never a real ETH price. */
const MIN_PRICE = 100;
const MAX_PRICE = 100_000;
const TIMEOUT_MS = 5_000;
const CACHE_MS = 60_000;

const SOURCES: Array<{ name: string; url: string; read: (body: unknown) => unknown }> = [
  {
    name: "coinbase",
    url: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    read: (b) => (b as { data?: { amount?: unknown } })?.data?.amount,
  },
  {
    name: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    read: (b) => (b as { ethereum?: { usd?: unknown } })?.ethereum?.usd,
  },
];

let cached: { price: number; source: string; at: number } | null = null;
let inflight: Promise<{ price: number; source: string }> | null = null;

async function fromSource(source: (typeof SOURCES)[number]): Promise<number> {
  const res = await fetch(source.url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${source.name} answered ${res.status}`);
  const price = Number(source.read(await res.json()));
  if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) throw new Error(`${source.name} gave an unusable price`);
  // Cents: the price is stored with two decimals and the wei amount is derived from that stored value.
  return Math.round(price * 100) / 100;
}

async function fetchPrice(): Promise<{ price: number; source: string }> {
  for (const source of SOURCES) {
    try {
      return { price: await fromSource(source), source: source.name };
    } catch (err) {
      console.warn(`[eth-price] ${(err as Error).message}`);
    }
  }
  throw new HttpError(503, "Couldn't get the ETH price right now. Try again in a minute.", "price_unavailable");
}

/**
 * ETH/USD spot price in dollars (two decimals), from Coinbase with CoinGecko as a
 * fallback, cached for a minute. Throws a 503 when no source gives a sane price,
 * so nothing is ever paid at a made up price.
 */
export async function getEthUsdPrice(): Promise<{ price: number; source: string }> {
  if (cached && Date.now() - cached.at < CACHE_MS) return { price: cached.price, source: cached.source };
  if (!inflight) {
    inflight = fetchPrice()
      .then((r) => {
        cached = { ...r, at: Date.now() };
        return r;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
