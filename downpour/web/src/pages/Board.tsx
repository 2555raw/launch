import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { CoinCard, CoinCardSkeleton } from '../components/CoinCard';
import { CurrencyStars } from '../components/CurrencyStars';
import { CurrencyDot, PageHead } from '../components/bits';
import { KeeperLine } from '../components/sections';
import { Arrow, Search } from '../components/icons';
import { sortRows, useRows, type SortKey } from '../lib/views';

type Status = 'all' | 'curve' | 'pool';

export default function Board() {
  const pad = usePad();
  const rows = useRows();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('active');
  const [status, setStatus] = useState<Status>('all');
  const currency = params.get('currency') ?? '';
  const now = pad.now();

  // Currencies (as the coins are priced) that have at least one coin, busiest first.
  const used = useMemo(() => {
    const m = new Map<string, { code: string; color: string; n: number }>();
    rows.forEach((r) => {
      const e = m.get(r.disp.code) ?? { code: r.disp.code, color: r.disp.color, n: 0 };
      e.n++;
      m.set(r.disp.code, e);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortRows(rows, sort).filter((r) => {
      if (currency && r.disp.code !== currency && r.cur.code !== currency) return false;
      if (status === 'curve' && r.coin.graduated) return false;
      if (status === 'pool' && !r.coin.graduated) return false;
      if (!needle) return true;
      return `${r.coin.name} ${r.coin.symbol} ${r.disp.code} ${r.disp.name} ${r.cur.code} ${r.cur.name} ${r.coin.address}`.toLowerCase().includes(needle);
    });
  }, [rows, q, sort, status, currency]);

  const setCurrency = (code: string) => {
    const next = new URLSearchParams(params);
    if (code) next.set('currency', code);
    else next.delete('currency');
    setParams(next, { replace: true });
  };

  return (
    <div className="wrap">
      <div className="board-head">
        <PageHead
          kicker="The board"
          title="Every coin, and the money it lives in"
          lead="Filter by currency to see everything priced in pesos, or yen, or gold. Each card names its coin and the currency it is priced in."
        />
        <Link to="/launch" className="btn btn-primary" data-solid>
          Launch a coin <Arrow />
        </Link>
      </div>

      <div className="toolbar board-bar" data-solid>
        <div className="seg" role="group" aria-label="Show">
          {(['all', 'curve', 'pool'] as Status[]).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)} aria-pressed={status === s}>
              {s === 'all' ? 'All coins' : s === 'curve' ? 'On the curve' : 'On Uniswap'}
            </button>
          ))}
        </div>
        <div className="board-find">
          <div className="search">
            <Search />
            <input className="input" placeholder="Find a coin, ticker, currency or address" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search coins" />
          </div>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="active">Latest trade</option>
            <option value="new">Newest</option>
            <option value="mcap">Market cap (USD)</option>
            <option value="volume">24h volume (USD)</option>
            <option value="progress">Closest to graduating</option>
          </select>
        </div>
      </div>

      <div className="cur-filter" data-solid role="group" aria-label="Filter by currency">
        <button className={`chip ${!currency ? 'on' : ''}`} onClick={() => setCurrency('')}>
          Every currency
        </button>
        {used.map((c) => (
          <button key={c.code} className={`chip ${currency === c.code ? 'on' : ''}`} onClick={() => setCurrency(currency === c.code ? '' : c.code)}>
            <CurrencyDot c={c} size={18} /> {c.code} <span className="muted">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="board-count">
        <span className="kicker">
          {shown.length} {shown.length === 1 ? 'market' : 'markets'} open
        </span>
        <KeeperLine />
      </div>

      <div className="grid grid-3">
        {!pad.snap && Array.from({ length: 6 }, (_, i) => <CoinCardSkeleton key={i} />)}
        {shown.map((r) => (
          <CoinCard key={r.coin.address} row={r} now={now} />
        ))}
      </div>
      {pad.snap && rows.length < 12 && !q && !currency && (
        <CurrencyStars kicker={rows.length ? 'Every currency is a star' : 'No coins yet'} title={rows.length ? 'Light a new one' : 'Light the first star'} />
      )}
      {pad.snap && !shown.length && (rows.length > 0 || q || currency) && (
        <div className="panel empty">
          <h3>{currency ? `No coins priced in ${currency} yet` : 'Nothing matches'}</h3>
          <p>{currency ? 'Be the first: launch one paired with it.' : 'Try another search, or clear the filters.'}</p>
          <Link to={currency ? `/launch?currency=${currency}` : '/launch'} className="btn btn-primary">
            Launch a coin
          </Link>
        </div>
      )}
    </div>
  );
}
