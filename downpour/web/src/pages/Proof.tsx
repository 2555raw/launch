import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseAbiItem } from 'viem';
import { usePad } from '../backend/PadProvider';
import type { LiveBackend } from '../backend/live';
import { launchpadAbi } from '../generated/contracts';
import { PageHead, PairBadge } from '../components/bits';
import { Arrow, Check } from '../components/icons';
import { compact, money } from '../lib/format';
import { amount } from '../lib/views';
import { circulating, fullSellBack } from '../lib/math';

const balanceOf = parseAbiItem('function balanceOf(address) view returns (uint256)');

/* Three claims, recomputed from the markets themselves every time the snapshot changes:
 *   1. each market's reserves add up (curve: reserve = virtual + backing; pool: reserve = backing)
 *   2. each market's backing covers selling every circulating coin back at once
 *   3. the pad actually holds, per currency, at least the total backing plus fees owed (live only) */
export default function Proof() {
  const pad = usePad();
  const snap = pad.snap;

  const rows = useMemo(() => {
    if (!snap) return [];
    return snap.coins.map((coin) => {
      const cur = pad.currencyOf(coin)!;
      const accountingOk = coin.graduated ? coin.reserveQuote === coin.realQuote : coin.reserveQuote === coin.virtualQuote + coin.realQuote;
      const payout = fullSellBack(coin);
      const margin = coin.realQuote - payout;
      return { coin, cur, accountingOk, payout, margin, ok: accountingOk && margin >= 0n, circ: circulating(coin) };
    });
  }, [snap, pad]);

  const perCurrency = useMemo(() => {
    const m = new Map<string, { token: `0x${string}`; code: string; symbol: string; decimals: number; backing: bigint; coins: number }>();
    for (const r of rows) {
      const k = r.cur.token.toLowerCase();
      const e = m.get(k) ?? { token: r.cur.token, code: r.cur.code, symbol: r.cur.symbol, decimals: r.cur.decimals, backing: 0n, coins: 0 };
      e.backing += r.coin.realQuote;
      e.coins++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.coins - a.coins);
  }, [rows]);

  // Custody: what the pad's contract really holds in each currency (live mode reads balances on chain).
  const [custody, setCustody] = useState<Record<string, { held: bigint; owed: bigint }>>({});
  useEffect(() => {
    if (pad.backend.kind !== 'live' || !pad.backend.addresses) return;
    const live = pad.backend as LiveBackend;
    const padAddr = pad.backend.addresses.launchpad;
    let off = false;
    Promise.all(
      perCurrency.map(async (c) => {
        const [held, backing, fees] = await Promise.all([
          live.client.readContract({ address: c.token, abi: [balanceOf], functionName: 'balanceOf', args: [padAddr] }),
          live.client.readContract({ address: padAddr, abi: launchpadAbi, functionName: 'backing', args: [c.token] }),
          live.client.readContract({ address: padAddr, abi: launchpadAbi, functionName: 'totalFeesOwed', args: [c.token] }),
        ]);
        return [c.token.toLowerCase(), { held: held as bigint, owed: (backing as bigint) + (fees as bigint) }] as const;
      }),
    )
      .then((entries) => !off && setCustody(Object.fromEntries(entries)))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [perCurrency, pad.backend, snap]);

  const bad = rows.filter((r) => !r.ok);
  const open = rows.filter((r) => !r.coin.graduated).length;
  const minMargin = rows.reduce<number | null>((m, r) => {
    // skip empty and dust-sized markets: their ratio is all rounding
    if (r.coin.graduated || r.coin.realQuote < 10n ** BigInt(Math.max(0, r.cur.decimals - 3))) return m;
    const ratio = Number(r.margin) / Number(r.coin.realQuote);
    return m === null ? ratio : Math.min(m, ratio);
  }, null);

  return (
    <div className="wrap">
      <PageHead
        kicker="Live, from the markets"
        title="Every star is backed"
        lead="Not a status page someone updates. This page takes every market's reserves and does the arithmetic in your browser, again each time a trade lands."
      />

      <div className="panel" style={{ marginBottom: 22 }}>
        {snap ? (
          <>
            <span className={`verdict ${bad.length ? 'bad' : 'ok'}`}>
              {bad.length ? `${bad.length} market${bad.length > 1 ? 's' : ''} fail a check` : <><Check /> All {rows.length} markets are backed</>}
            </span>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {open} on the curve, {rows.length - open} graduated into pools. {minMargin !== null && `Thinnest spare backing on a curve: ${(minMargin * 100).toPrecision(2)}% of its backing, because rounding always lands in the market's favour.`}{' '}
              {pad.mode === 'playground' ? 'In the playground the markets are simulated with the same integer math as the contracts.' : 'Reserves are read from the chain.'}
            </p>
          </>
        ) : (
          <div className="skeleton" style={{ height: 60 }} />
        )}
      </div>

      <div className="panel table-wrap" style={{ padding: 8 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Pair</th>
              <th className="r">Backing</th>
              <th className="r">Circulating</th>
              <th className="r">Pays if all sold</th>
              <th className="r">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.coin.address}>
                <td>
                  <Link to={`/coin/${r.coin.address}`}>
                    <PairBadge coin={r.coin} currency={r.cur} size="sm" />
                  </Link>
                </td>
                <td className="r num">{money(amount(r.coin.realQuote, r.cur.decimals), r.cur.symbol)}</td>
                <td className="r num">{compact(amount(r.circ))}</td>
                <td className="r num">{r.coin.graduated ? <span className="muted">pool</span> : money(amount(r.payout, r.cur.decimals), r.cur.symbol)}</td>
                <td className="r">{r.ok ? <span className="up">✓ holds</span> : <span className="down">✗ check</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Per currency
        </div>
        {perCurrency.map((c) => {
          const cu = custody[c.token.toLowerCase()];
          return (
            <div key={c.token} className="kv">
              <span>
                {c.code} · {c.coins} coin{c.coins > 1 ? 's' : ''}
              </span>
              <span className="num">
                backing {money(amount(c.backing, c.decimals), c.symbol)}
                {cu && (
                  <span className={cu.held >= cu.owed ? 'up' : 'down'}>
                    {' '}
                    · pad holds {money(amount(cu.held, c.decimals), c.symbol)} {cu.held >= cu.owed ? '≥' : '<'} owed {money(amount(cu.owed, c.decimals), c.symbol)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="kicker">What is checked</div>
        <h2 className="h-section" style={{ marginBottom: 26 }}>
          Three sums, done in the open
        </h2>
        <div className="explain-grid">
          <div className="rule">
            <span className="step-n">01</span>
            <div>
              <b>The reserves add up.</b>
              <p className="muted small">
                On a curve, the currency reserve used for pricing must equal the virtual amount set at launch plus the real backing, to the last unit.
                In a pool there is no virtual part, so reserve and backing must be equal.
              </p>
            </div>
          </div>
          <div className="rule">
            <span className="step-n">02</span>
            <div>
              <b>A full sell-back is covered.</b>
              <p className="muted small">If every coin in circulation were sold at once, the market would pay out this much. The backing has to be at least that.</p>
            </div>
          </div>
          <div className="rule">
            <span className="step-n">03</span>
            <div>
              <b>The money is really there.</b>
              <p className="muted small">
                In live mode the page also reads the pad's balance of each currency and compares it with everything it owes: the backing of every market
                in that currency plus fees not yet claimed.
              </p>
            </div>
          </div>
          <div className="rule">
            <span className="step-n">04</span>
            <div>
              <b>What it does not prove.</b>
              <p className="muted small">
                It does not audit the contracts, and it cannot tell you a coin is worth anything. <Link to="/verify" className="accent-text">Verify</Link>{' '}
                checks that a specific coin is really the pad's.
              </p>
            </div>
          </div>
        </div>
        <Link to="/verify" className="link" style={{ marginTop: 26 }}>
          Verify a single coin <Arrow dir="right" />
        </Link>
      </section>
    </div>
  );
}
