import { Link } from 'react-router-dom';
import type { CoinRow } from '../lib/views';
import { ago, money, pct, usd } from '../lib/format';
import { CoinOrb, ProgressBar, Sparkline, StatusPill } from './bits';

/** A coin's own patch of sky: its currency's colour and a starfield offset seeded from
 *  its address, so a coin looks the same on its card and on its page. */
export function skyStyle(address: string, color: string) {
  const seed = parseInt(address.slice(2, 10), 16) || 0;
  return { '--c': color, '--sx': `${seed % 420}px`, '--sy': `${(seed >>> 9) % 160}px` } as React.CSSProperties;
}

export function CoinCard({ row, now }: { row: CoinRow; now: number }) {
  const { coin, cur } = row;
  // each card shows its own patch of sky
  const sky = skyStyle(coin.address, cur.color);
  return (
    <Link to={`/coin/${coin.address}`} className="card coin-card" style={sky}>
      <div className="cc-sky">
        <span className="cc-code">{cur.code}</span>
        <span className="cc-age">{ago(coin.createdAt, now)}</span>
        <div className="cc-orb">
          <CoinOrb coin={coin} currency={cur} size={coin.meta.image ? 76 : 124} />
        </div>
        <span className="cc-ticker">{coin.symbol}</span>
      </div>
      <div className="cc-body">
        <div className="row-between">
          <h3 className="cc-name">{coin.name}</h3>
          <StatusPill coin={coin} now={now} />
        </div>
        <div className="cc-meta">
          {coin.symbol} · priced in {cur.name}
        </div>
        <ProgressBar value={row.progress} full={coin.graduated} />
        <div className="cc-line">
          <span className="num">{money(row.price, cur.symbol)}</span>
          <span>{coin.graduated ? 'graduated · on Uniswap' : `${pct(row.progress)} of curve`}</span>
        </div>
        <div className="cc-line cc-meta">
          <span>
            mcap {money(row.mcap, cur.symbol)} · {usd(row.mcapUsd)}
          </span>
          <span className={row.change24 >= 0 ? 'up' : 'down'}>
            {row.change24 >= 0 ? '+' : ''}
            {pct(row.change24)}
          </span>
        </div>
        <Sparkline points={row.spark} color={cur.color} height={34} />
      </div>
    </Link>
  );
}

export function CoinCardSkeleton() {
  return <div className="card coin-card skeleton" style={{ height: 356 }} />;
}
