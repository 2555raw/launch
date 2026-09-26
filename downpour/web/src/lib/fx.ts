/* Two public FX feeds, and the rule the keeper uses: a rate only counts when both
 * feeds agree on it. The playground uses this to start from today's rates when
 * the browser can reach the feeds, and silently keeps its reference rates when
 * it cannot. scripts/keeper.mjs applies the same rule before posting on chain. */

export const AGREE_WITHIN = 0.005; // 0.5%

async function getJson(url: string, ms = 4000): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function feedA(): Promise<Record<string, number>> {
  const j = await getJson('https://open.er-api.com/v6/latest/USD');
  return j?.rates ?? {};
}

async function feedB(): Promise<Record<string, number>> {
  let j: any;
  try {
    j = await getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
  } catch {
    j = await getJson('https://latest.currency-api.pages.dev/v1/currencies/usd.json');
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(j?.usd ?? {})) out[k.toUpperCase()] = Number(v);
  return out;
}

/** Rates (units per USD) that both feeds agree on, or null if a feed is unreachable. */
export async function agreedRates(): Promise<{ rates: Record<string, number>; agreed: number; held: number } | null> {
  try {
    const [a, b] = await Promise.all([feedA(), feedB()]);
    const rates: Record<string, number> = {};
    let held = 0;
    for (const code of Object.keys(a)) {
      const x = a[code];
      const y = b[code];
      if (!x || !y) continue;
      if (Math.abs(x - y) / Math.max(x, y) <= AGREE_WITHIN) rates[code] = (x + y) / 2;
      else held++;
    }
    return { rates, agreed: Object.keys(rates).length, held };
  } catch {
    return null;
  }
}
