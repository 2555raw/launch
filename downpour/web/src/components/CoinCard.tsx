import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { CoinRow } from '../lib/views';
import { ago, money, pct, usd } from '../lib/format';
import { useWallet } from '../wallet/WalletProvider';
import { CoinOrb, ProgressBar, Sparkline, StatusPill } from './bits';
import { Close } from './icons';

/** A coin's own patch of sky: its currency's colour and a starfield offset seeded from
 *  its address, so a coin looks the same on its card and on its page. */
export function skyStyle(address: string, color: string) {
  const seed = parseInt(address.slice(2, 10), 16) || 0;
  return { '--c': color, '--sx': `${seed % 420}px`, '--sy': `${(seed >>> 9) % 160}px` } as React.CSSProperties;
}

export function CoinCard({ row, now }: { row: CoinRow; now: number }) {
  const { coin, disp } = row;
  const pad = usePad();
  const me = useWallet().address;
  // a test coin of your own can go straight from its card
  const mine = pad.mode === 'playground' && !!me && coin.creator.toLowerCase() === me.toLowerCase();
  // each card shows its own patch of sky, in the colour of the money it is priced in
  const sky = skyStyle(coin.address, disp.color);
  return (
    <Link to={`/coin/${coin.address}`} className="card coin-card" style={sky}>
      <div className="cc-sky">
        <span className="cc-code">{disp.code}</span>
        <span className="cc-age">{ago(coin.createdAt, now)}</span>
        {mine && (
          <button
            type="button"
            className="cc-del"
            aria-label={`Delete ${coin.symbol}, a test coin of yours`}
            title="Delete this test coin"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (confirm(`Delete ${coin.symbol}? It is a test coin in this browser; it and its fills go away.`)) pad.removeTestCoin(me!, coin.address);
            }}
          >
            <Close size={11} />
          </button>
        )}
        <div className="cc-orb">
          <CoinOrb coin={coin} currency={disp} size={coin.meta.image ? 76 : 124} />
        </div>
        <span className="cc-ticker">{coin.symbol}</span>
      </div>
      <div className="cc-body">
        <div className="row-between">
          <h3 className="cc-name">{coin.name}</h3>
          <StatusPill coin={coin} now={now} />
        </div>
        <div className="cc-meta">
          {coin.symbol} · priced in {disp.name}
          {disp.paidIn ? ` · paid in ${disp.paidIn}` : ''}
        </div>
        <ProgressBar value={row.progress} full={coin.graduated} />
        <div className="cc-line">
          <span className="num">{money(row.dispPrice, disp.symbol)}</span>
          <span>{coin.graduated ? 'graduated · on Uniswap' : `${pct(row.progress)} of curve`}</span>
        </div>
        <div className="cc-line cc-meta">
          <span>
            mcap {money(row.dispMcap, disp.symbol)} · {usd(row.mcapUsd)}
          </span>
          <span className={row.change24 >= 0 ? 'up' : 'down'}>
            {row.change24 >= 0 ? '+' : ''}
            {pct(row.change24)}
          </span>
        </div>
        <Sparkline points={row.spark} color={disp.color} height={34} />
      </div>
    </Link>
  );
}

export function CoinCardSkeleton() {
  return <div className="card coin-card skeleton" style={{ height: 356 }} />;
}
