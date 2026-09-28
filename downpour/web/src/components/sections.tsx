import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { Trade } from '../backend/types';
import { ago, compact, money, shortAddr } from '../lib/format';
import { amount } from '../lib/views';
import { PairBadge } from './bits';

/* ------------------------------ recent fills ------------------------------ */

export function RecentFills({ trades, limit = 8, showPair = true }: { trades: Trade[]; limit?: number; showPair?: boolean }) {
  const pad = usePad();
  const now = pad.now();
  const list = trades.slice(-limit).reverse();
  if (!list.length) return <div className="empty small">No fills yet. The first trade shows up here the moment it lands.</div>;
  return (
    <div className="fills">
      {list.map((t) => {
        const coin = pad.coinByAddress.get(t.coin.toLowerCase());
        const cur = coin ? pad.currencyOf(coin) : undefined;
        return (
          <Link key={t.id} to={coin ? `/coin/${coin.address}` : '#'} className="fill">
            <span className={`fill-side ${t.isBuy ? 'up' : 'down'}`}>{t.isBuy ? 'BUY' : 'SELL'}</span>
            <span className="fill-who">
              {showPair && coin ? <PairBadge coin={coin} currency={cur} size="sm" /> : <b>{coin?.symbol}</b>}
              <span className="mono muted">{shortAddr(t.trader, 6, 3)}</span>
            </span>
            <span className="num fill-amt">{compact(amount(t.tokenAmount))}</span>
            <span className="num fill-quote">{cur ? money(amount(t.quoteAmount, cur.decimals), cur.symbol) : ''}</span>
            <span className="muted small fill-time">{ago(t.timestamp, now)}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------ keeper status ------------------------------ */

export function KeeperLine() {
  const pad = usePad();
  const moves = pad.snap?.rateMoves ?? [];
  const last = moves[moves.length - 1];
  const cur = last ? pad.currencyByToken.get(last.token.toLowerCase()) : undefined;
  const now = pad.now();
  const change = last ? Number(last.newRate - last.oldRate) / Number(last.oldRate) : 0;
  return (
    <div className="keeper small">
      <span className="dot live" />
      <span>KEEPER · RATES POSTED ONLY WHEN TWO FEEDS AGREE</span>
      {last && cur ? (
        <span className="muted">
          · LAST MOVE {cur.code} {change >= 0 ? '+' : ''}
          {(change * 100).toFixed(3)}% · {ago(last.timestamp, now).toUpperCase()} · {moves.length} MOVES
        </span>
      ) : (
        <span className="muted">· HOLDING, NO MOVES YET</span>
      )}
    </div>
  );
}

/* ------------------------------ curve picture ------------------------------ */

/** Price against coins out of the pool: the pool's curve (x · y = k) from the launch price up, and where a coin stands on it. */
export function CurveChart({ sold = 0.42, height = 170, color = '#3f8ce6' }: { sold?: number; height?: number; color?: string }) {
  const w = 460;
  const pad = 14;
  const SPAN = 0.8; // the chart shows the supply up to 80% out of the pool
  const priceAt = (f: number) => 1 / (1 - f) ** 2; // price grows as the pool's coins x shrink: y0 / x^2, normalised
  const pMax = priceAt(SPAN);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const f = (i / 60) * SPAN;
    const x = pad + (f / SPAN) * (w - pad * 2 - 40);
    const y = height - pad - (priceAt(f) / pMax) * (height - pad * 2.5);
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const at = Math.min(sold, SPAN);
  const nowX = pad + (at / SPAN) * (w - pad * 2 - 40);
  const nowY = height - pad - (priceAt(at) / pMax) * (height - pad * 2.5);
  const endX = pad + (w - pad * 2 - 40);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="curve-chart" role="img" aria-label="The pool's curve: price rises as coins leave the pool, from the first second on Uniswap">
      <line x1={pad} y1={height - pad} x2={w - pad} y2={height - pad} stroke="rgba(15,28,50,0.15)" />
      <path d={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" />
      <text x={endX} y={pad + 4} fill="#0c9a5f" fontSize="11" textAnchor="end">
        one Uniswap pool, from the first coin · liquidity locked
      </text>
      <circle cx={nowX} cy={nowY} r="6" fill="#5a3fd1" stroke="#fff" strokeWidth="2" />
      <text x={nowX + 10} y={nowY + 4} fill="#5a3fd1" fontSize="11">
        you are here
      </text>
      <text x={pad} y={height - 2} fill="#5b6679" fontSize="10">
        launch
      </text>
      <text x={endX} y={height - 2} fill="#5b6679" fontSize="10" textAnchor="middle">
        800M in wallets
      </text>
    </svg>
  );
}

/* ------------------------------ questions ------------------------------ */

export function Faq({ items, open: initial = 0 }: { items: Array<[string, ReactNode]>; open?: number }) {
  const [open, setOpen] = useState<number>(initial);
  return (
    <div className="faq">
      {items.map(([q, a], i) => (
        <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
          <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{q}</span>
            <span className="faq-sign" aria-hidden="true">
              {open === i ? '×' : '+'}
            </span>
          </button>
          {open === i && <div className="faq-a">{a}</div>}
        </div>
      ))}
    </div>
  );
}

export const CORE_FAQ: Array<[string, ReactNode]> = [
  [
    'What does it mean that a coin is paired with a currency?',
    'When you launch, you choose one currency from the desk: euros, yen, naira, gold, anything listed. Every buy is paid in it, every sell pays out in it, the price is quoted in it and the fees are collected in it. The badge on each coin, like PULSAR / EUR, is that pairing.',
  ],
  [
    'Can the currency be changed after launch?',
    'No. The pad writes the currency into the market when the coin is created and has no function that edits it. Verify checks this against the launch event on chain.',
  ],
  [
    'Where is the liquidity, and who can pull it?',
    'In the coin’s own Uniswap V3 pool, from the first second: the whole supply goes in at launch as one position the pad owns, and the pad has no function that withdraws, moves or burns it. Nobody holds LP tokens and there is no unlock date. Every DEX screen and terminal sees the pool with its liquidity the moment the coin launches.',
  ],
  [
    'Is any of this real money?',
    'In the playground, no: balances are simulated in your browser. In live mode you trade real tokens on chain; on a test network those are test currencies from the faucet, with no value. Nothing here is advice.',
  ],
];
