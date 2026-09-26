import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { useWallet } from '../wallet/WalletProvider';
import { CoinDrop, CurrencyDot, PageHead, PairBadge } from '../components/bits';
import { RecentFills } from '../components/sections';
import { Arrow } from '../components/icons';
import { compact, money, pct, shortAddr, usd } from '../lib/format';
import { amount, useRows } from '../lib/views';

export default function Portfolio() {
  const pad = usePad();
  const wallet = useWallet();
  const rows = useRows();
  const snap = pad.snap;
  const me = wallet.address?.toLowerCase();
  const usable = !!wallet.address && !(pad.mode === 'live' && wallet.isGuest);

  const coins = useMemo(
    () =>
      rows
        .map((r) => {
          const bal = pad.balances[r.coin.address.toLowerCase()] ?? 0n;
          return { r, bal, value: amount(bal) * r.price, usdValue: pad.usdValue(r.coin.address, bal) };
        })
        // leftovers smaller than one coin and worth under half a cent are dust, not a position
        .filter((x) => x.bal > 0n && (x.bal >= 10n ** 18n || x.usdValue >= 0.005))
        .sort((a, b) => b.usdValue - a.usdValue),
    [rows, pad],
  );

  const currencies = useMemo(
    () =>
      (snap?.currencies ?? [])
        .map((c) => {
          const bal = pad.balances[c.token.toLowerCase()] ?? 0n;
          return { c, bal, usdValue: pad.usdValue(c.token, bal) };
        })
        .filter((x) => x.bal > 0n)
        .sort((a, b) => b.usdValue - a.usdValue),
    [snap, pad],
  );

  const launched = useMemo(() => rows.filter((r) => r.coin.creator.toLowerCase() === me), [rows, me]);
  const isTreasury = !!me && snap?.params.treasury.toLowerCase() === me;
  const feeCurrencies = useMemo(() => {
    const set = new Set<string>();
    (isTreasury ? rows : launched).forEach((r) => set.add(r.cur.token));
    return [...set] as `0x${string}`[];
  }, [launched, rows, isTreasury]);

  const [fees, setFees] = useState<Record<string, bigint>>({});
  useEffect(() => {
    if (!usable || !wallet.address || !feeCurrencies.length) {
      setFees({});
      return;
    }
    pad.backend.feesOwed(wallet.address, feeCurrencies).then(setFees).catch(() => setFees({}));
  }, [usable, wallet.address, feeCurrencies, pad.backend, pad.snap]);

  const myTrades = useMemo(() => (snap?.trades ?? []).filter((t) => t.trader.toLowerCase() === me), [snap, me]);
  const total = coins.reduce((a, x) => a + x.usdValue, 0) + currencies.reduce((a, x) => a + x.usdValue, 0);
  const owed = Object.entries(fees).filter(([, v]) => v > 0n);

  if (!usable) {
    return (
      <div className="wrap">
        <PageHead kicker="Portfolio" title="Your stash" lead="Coins you hold, the currencies you carry, the coins you launched and the fees they have earned you." />
        <div className="panel empty">
          <h3>Nothing to show until you connect.</h3>
          <p>
            {pad.mode === 'playground'
              ? 'Connecting gives you an address with 1,000 dollars’ worth of every currency to play with. Nothing is signed and no real money moves.'
              : 'Connect the wallet you trade with to see its positions on chain.'}
          </p>
          <button className="btn btn-primary" onClick={wallet.openModal}>
            Connect wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <PageHead kicker="Portfolio" title="Your stash" lead={<span className="mono">{wallet.address}</span>}>
        <div className="row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <span className="pill curve">Worth about {usd(total)}</span>
          <span className="pill">{coins.length} coins</span>
          <span className="pill">{currencies.length} currencies</span>
          {pad.mode === 'playground' && (
            <button
              className="chip"
              onClick={() => {
                if (confirm('Start the playground over? Every coin, trade and balance in this browser is wiped.')) pad.resetPlayground();
              }}
            >
              Reset the playground
            </button>
          )}
        </div>
      </PageHead>

      <div className="panel">
        <div className="kicker" style={{ marginBottom: 6 }}>
          Coins you hold
        </div>
        {coins.length === 0 && (
          <div className="empty small">
            No coins yet. <Link to="/board" className="rain-text">Find one on the board</Link> or <Link to="/swap" className="rain-text">swap into one</Link>.
          </div>
        )}
        {coins.map(({ r, bal, value, usdValue }) => (
          <Link key={r.coin.address} to={`/coin/${r.coin.address}`} className="asset-row">
            <span className="row" style={{ minWidth: 0 }}>
              <CoinDrop coin={r.coin} currency={r.cur} size={26} />
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <PairBadge coin={r.coin} currency={r.cur} size="sm" />
                <span className="muted small">{r.coin.name}</span>
              </span>
            </span>
            <span className="num hide-sm">{compact(amount(bal))}</span>
            <span className="num hide-sm">{money(value, r.cur.symbol)}</span>
            <span className="num" style={{ textAlign: 'right' }}>
              {usd(usdValue)}
              <div className={`small ${r.change24 >= 0 ? 'up' : 'down'}`}>
                {r.change24 >= 0 ? '+' : ''}
                {pct(r.change24)}
              </div>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div className="panel">
          <div className="kicker" style={{ marginBottom: 6 }}>
            Coins you launched
          </div>
          {launched.length === 0 && (
            <div className="empty small">
              None yet. <Link to="/launch" className="rain-text">Start a storm</Link>: you earn half of every trade fee.
            </div>
          )}
          {launched.map((r) => (
            <Link key={r.coin.address} to={`/coin/${r.coin.address}`} className="asset-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <PairBadge coin={r.coin} currency={r.cur} size="sm" />
              <span className="small muted">{r.coin.graduated ? 'graduated' : `${pct(r.progress)} of curve`}</span>
            </Link>
          ))}
          {owed.length > 0 && (
            <>
              <div className="kicker" style={{ margin: '18px 0 6px' }}>
                {isTreasury ? 'Fees owed to you (creator + treasury)' : 'Creator fees owed to you'}
              </div>
              {owed.map(([token, value]) => {
                const c = pad.currencyByToken.get(token);
                if (!c) return null;
                return (
                  <div key={token} className="kv">
                    <span className="row">
                      <CurrencyDot c={c} size={20} /> {money(amount(value, c.decimals), c.symbol, { compact: false })}
                    </span>
                    <button className="btn btn-sm btn-primary" onClick={() => pad.run(`Claim ${c.code} fees`, (a, o) => pad.backend.claimFees(a, c.token, o))}>
                      Claim
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="panel">
          <div className="kicker" style={{ marginBottom: 6 }}>
            Currencies
          </div>
          {currencies.length === 0 && (
            <div className="empty small">
              Nothing here. <Link to="/desk" className="rain-text">The desk</Link> has a faucet for test currencies.
            </div>
          )}
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {currencies.slice(0, 60).map(({ c, bal, usdValue }) => (
              <Link key={c.token} to={`/desk?code=${c.code}`} className="kv">
                <span className="row">
                  <CurrencyDot c={c} size={22} /> <b>{c.code}</b> <span className="muted small">{c.name}</span>
                </span>
                <span className="num">
                  {money(amount(bal, c.decimals), c.symbol)} {c.code !== 'USD' && <span className="muted small">· {usd(usdValue)}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="kicker">Your fills</div>
          <span className="muted small mono">{shortAddr(wallet.address)}</span>
        </div>
        <RecentFills trades={myTrades} limit={20} />
        <Link to="/swap" className="link" style={{ marginTop: 12 }}>
          Make a swap <Arrow dir="right" />
        </Link>
      </div>
    </div>
  );
}
