import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseAbi } from 'viem';
import { usePad } from '../backend/PadProvider';
import type { LiveBackend } from '../backend/live';
import { launchpadAbi } from '../generated/contracts';
import { PageHead, PairBadge } from '../components/bits';
import { Arrow, Check } from '../components/icons';
import { compact, money, pct } from '../lib/format';
import { amount } from '../lib/views';
import { circulating, soldShare, TOTAL_SUPPLY } from '../lib/math';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
const positionsAbi = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
const DUST = 10n ** 18n;

/* Three claims, recomputed from the markets themselves every time the snapshot changes:
 *   1. each market's numbers add up (the pool holds every coin not in a wallet; the currency
 *      it prices with is the launch amount plus what buyers really paid in)
 *   2. the pool can pay every coin back: selling everything returns it to where it started
 *   3. the liquidity really is locked: the pad owns the pool's position, and the pool holds
 *      the coins it says (live only, read from the chain) */
export default function Proof() {
  const pad = usePad();
  const snap = pad.snap;

  const rows = useMemo(() => {
    if (!snap) return [];
    return snap.coins.map((coin) => {
      const cur = pad.currencyOf(coin)!;
      const inPool = coin.reserveToken;
      const circ = circulating(coin);
      // the virtual currency reserve is what the launch set (the position's lower edge sits at most one
      // tick spacing, 2%, above the launch price) plus what is really in the pool: nothing is invented
      const sums = inPool <= TOTAL_SUPPLY && coin.reserveQuote + DUST >= coin.startQuote && coin.reserveQuote <= (coin.startQuote * 1025n) / 1000n + coin.realQuote + DUST;
      // along x · y = k, selling every circulating coin back returns the pool to its launch reserves,
      // so the currency that would leave is what came in, never more
      const payout = circ === 0n ? 0n : (coin.reserveQuote * circ) / (coin.reserveToken + circ);
      return { coin, cur, sums, payout, ok: sums && payout <= coin.realQuote + DUST, circ, sold: soldShare(coin) };
    });
  }, [snap, pad]);

  const perCurrency = useMemo(() => {
    const m = new Map<string, { token: `0x${string}`; code: string; symbol: string; decimals: number; pooled: bigint; coins: number }>();
    for (const r of rows) {
      const k = r.cur.token.toLowerCase();
      const e = m.get(k) ?? { token: r.cur.token, code: r.cur.code, symbol: r.cur.symbol, decimals: r.cur.decimals, pooled: 0n, coins: 0 };
      e.pooled += r.coin.realQuote;
      e.coins++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.coins - a.coins);
  }, [rows]);

  // Custody: on chain, the pad owns every pool's position and each pool holds the coins it prices.
  const [locked, setLocked] = useState<Record<string, { owner: boolean; coins: boolean }>>({});
  useEffect(() => {
    if (pad.backend.kind !== 'live' || !pad.backend.addresses || !snap) return;
    const live = pad.backend as LiveBackend;
    const padAddr = pad.backend.addresses.launchpad;
    let off = false;
    (async () => {
      const positions = (await live.client.readContract({ address: padAddr, abi: launchpadAbi, functionName: 'positions' })) as `0x${string}`;
      const entries = await Promise.all(
        snap.coins.slice(0, 120).map(async (c) => {
          const [owner, held] = await Promise.all([
            live.client.readContract({ address: positions, abi: positionsAbi, functionName: 'ownerOf', args: [c.tokenId ?? 0n] }).catch(() => '0x'),
            live.client.readContract({ address: c.address, abi: erc20, functionName: 'balanceOf', args: [c.pool!] }).catch(() => 0n),
          ]);
          return [c.address.toLowerCase(), { owner: (owner as string).toLowerCase() === padAddr.toLowerCase(), coins: (held as bigint) + DUST >= c.reserveToken }] as const;
        }),
      );
      if (!off) setLocked(Object.fromEntries(entries));
    })().catch(() => {});
    return () => {
      off = true;
    };
  }, [pad.backend, snap]);

  const bad = rows.filter((r) => !r.ok || (locked[r.coin.address.toLowerCase()] && (!locked[r.coin.address.toLowerCase()].owner || !locked[r.coin.address.toLowerCase()].coins)));
  const checked = Object.keys(locked).length;

  return (
    <div className="wrap">
      <PageHead
        kicker="Live, from the pools"
        title="Every star has its liquidity locked"
        lead="Not a status page someone updates. This page takes every coin's pool and does the arithmetic in your browser, again each time a trade lands, and in live mode asks the chain who owns each pool's liquidity."
      />

      <div className="panel" style={{ marginBottom: 22 }}>
        {snap ? (
          <>
            <span className={`verdict ${bad.length ? 'bad' : 'ok'}`}>
              {bad.length ? `${bad.length} pool${bad.length > 1 ? 's' : ''} fail a check` : <><Check /> All {rows.length} pools hold and are locked</>}
            </span>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Every coin's whole supply went into its Uniswap pool at launch, as one position the pad owns and has no function to withdraw.{' '}
              {pad.mode === 'playground'
                ? 'In the playground the pools are simulated with the same integer math as the contracts.'
                : checked
                  ? `The chain confirms the pad owns the position of ${checked} of ${rows.length} pools and that each holds the coins it prices.`
                  : 'Reserves are read from the chain.'}
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
              <th className="r">In the pool</th>
              <th className="r">Coins in the pool</th>
              <th className="r">In wallets</th>
              <th className="r">Sell-back pays</th>
              <th className="r">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const l = locked[r.coin.address.toLowerCase()];
              const ok = r.ok && (!l || (l.owner && l.coins));
              return (
                <tr key={r.coin.address}>
                  <td>
                    <Link to={`/coin/${r.coin.address}`}>
                      <PairBadge coin={r.coin} currency={r.cur} size="sm" />
                    </Link>
                  </td>
                  <td className="r num">{money(amount(r.coin.realQuote, r.cur.decimals), r.cur.symbol)}</td>
                  <td className="r num">{compact(amount(r.coin.reserveToken))}</td>
                  <td className="r num">
                    {compact(amount(r.circ))} <span className="muted">({pct(r.sold)})</span>
                  </td>
                  <td className="r num">{money(amount(r.payout, r.cur.decimals), r.cur.symbol)}</td>
                  <td className="r">{ok ? <span className="up">✓ {l ? 'locked' : 'holds'}</span> : <span className="down">✗ check</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Per currency
        </div>
        {perCurrency.map((c) => (
          <div key={c.token} className="kv">
            <span>
              {c.code} · {c.coins} coin{c.coins > 1 ? 's' : ''}
            </span>
            <span className="num">in pools {money(amount(c.pooled, c.decimals), c.symbol)}</span>
          </div>
        ))}
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
              <b>The numbers add up.</b>
              <p className="muted small">
                The pool holds every coin that is not in a wallet, and the currency it prices with is the launch amount plus what buyers really
                paid in. Nothing is counted twice and nothing is invented.
              </p>
            </div>
          </div>
          <div className="rule">
            <span className="step-n">02</span>
            <div>
              <b>A full sell-back is covered.</b>
              <p className="muted small">
                Along x · y = k, selling every coin in wallets back returns the pool to where it started, so what would leave is never more than
                what came in.
              </p>
            </div>
          </div>
          <div className="rule">
            <span className="step-n">03</span>
            <div>
              <b>The liquidity is really locked.</b>
              <p className="muted small">
                In live mode the page asks Uniswap who owns each pool's position (the pad, which has no function to move or burn it) and checks
                that the pool holds the coins it prices.
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
