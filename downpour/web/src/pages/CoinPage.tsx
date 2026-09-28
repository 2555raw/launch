import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { Address, Coin, Currency } from '../backend/types';
import { useWallet } from '../wallet/WalletProvider';
import { DEXSCREENER, explorerAddress } from '../config/chains';
import { CoinOrb, CopyButton, PairBadge, StatusPill } from '../components/bits';
import { PriceChart } from '../components/PriceChart';
import { skyStyle } from '../components/CoinCard';
import { RecentFills } from '../components/sections';
import { Arrow, Sparkle } from '../components/icons';
import { ago, compact, money, parseAmount, pct, shortAddr, toInput, usd } from '../lib/format';
import { amount, buildRows, unitsPerUsd } from '../lib/views';
import { TOTAL_SUPPLY, fromUsd, quoteBuy, quoteSell, WAD } from '../lib/math';
import { imageSrc } from '../lib/meta';

function TradePanel({ coin, cur, disp, factor }: { coin: Coin; cur: Currency; disp: Currency; factor: number }) {
  const pad = usePad();
  const wallet = useWallet();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [text, setText] = useState('');
  // the field as it is now, so a trade that goes through only clears what it sent
  const typed = useRef(text);
  useEffect(() => {
    typed.current = text;
  }, [text]);
  const [maxed, setMaxed] = useState(false);
  const [slip, setSlip] = useState(100);
  const [busy, setBusy] = useState(false);
  const params = pad.snap!.params;

  const curBal = pad.spendable(cur.token);
  const coinBal = pad.balances[coin.address.toLowerCase()] ?? 0n;
  const dec = side === 'buy' ? cur.decimals : 18;
  const have = side === 'buy' ? curBal : coinBal;
  // Max and 100% use the exact balance, so selling everything leaves no dust behind.
  const value = maxed ? have : parseAmount(text, dec);

  const quote = useMemo(() => {
    if (!value) return null;
    if (side === 'buy') {
      const q = quoteBuy(coin, value, params);
      return { out: q.tokensOut, fee: q.fee };
    }
    const q = quoteSell(coin, value, params);
    return { out: q.quoteOut, fee: q.fee };
  }, [value, side, coin, params]);

  const minOut = quote ? (quote.out * BigInt(10_000 - slip)) / 10_000n : 0n;

  const quick =
    side === 'buy'
      ? [10, 50, 100, 500].map((u) => ({ label: `$${u}`, value: toInput(fromUsd(cur, BigInt(u) * WAD), cur.decimals, 6) }))
      : [25, 50, 75, 100].map((p) => ({ label: `${p}%`, value: toInput((coinBal * BigInt(p)) / 100n, 18, 6), max: p === 100 }));

  let action: { label: string; disabled: boolean; onClick?: () => void } = { label: side === 'buy' ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`, disabled: true };
  if (!wallet.address) action = { label: 'Connect wallet', disabled: false, onClick: wallet.openModal };
  else if (pad.wrongChain && pad.chainId) action = { label: 'Switch network', disabled: false, onClick: () => wallet.switchChain(pad.chainId!) };
  else if (!value) action = { ...action, disabled: true };
  else if (value > have) action = { label: `Not enough ${side === 'buy' ? cur.code : coin.symbol}`, disabled: true };
  else if (busy) action = { label: 'Working…', disabled: true };
  else
    action = {
      ...action,
      disabled: false,
      onClick: async () => {
        setBusy(true);
        const sent = text;
        const r =
          side === 'buy'
            ? await pad.run(`Buy ${coin.symbol} with ${cur.code}`, (a, o) => pad.backend.buy(a, coin.address, value, minOut, o))
            : await pad.run(`Sell ${coin.symbol} for ${cur.code}`, (a, o) => pad.backend.sell(a, coin.address, value, minOut, o));
        setBusy(false);
        if (r && typed.current === sent) {
          setText('');
          setMaxed(false);
        }
      },
    };

  const usdBase = pad.snap?.currencies.find((c) => c.code === 'USD');
  const feePct = params.poolFeePips / 10_000;

  return (
    <div className="panel trade-panel" data-solid>
      <div className="tabs" role="tablist">
        <button className={`buy ${side === 'buy' ? 'on' : ''}`} onClick={() => (setSide('buy'), setText(''), setMaxed(false))} role="tab" aria-selected={side === 'buy'}>
          Buy
        </button>
        <button className={`sell ${side === 'sell' ? 'on' : ''}`} onClick={() => (setSide('sell'), setText(''), setMaxed(false))} role="tab" aria-selected={side === 'sell'}>
          Sell
        </button>
      </div>

      <div className="row-between small muted" style={{ marginBottom: 8 }}>
        <span>{side === 'buy' ? `You pay in ${cur.name}` : `You sell ${coin.symbol}`}</span>
        <button className="link small" onClick={() => (setText(toInput(have, dec, 6)), setMaxed(true))}>
          Balance {compact(amount(have, dec))}
          {side === 'buy' && pad.wrapNote(cur.token) ? ` (${pad.wrapNote(cur.token)})` : ''}
        </button>
      </div>
      <div className="big-input" style={{ marginBottom: 14 }}>
        <input
          inputMode="decimal"
          placeholder="0"
          value={text}
          onChange={(e) => (setText(e.target.value), setMaxed(false))}
          aria-label={side === 'buy' ? `Amount of ${cur.code}` : `Amount of ${coin.symbol}`}
        />
        <span className="unit">{side === 'buy' ? cur.code : coin.symbol}</span>
      </div>
      <div className="quick">
        {quick.map((q) => (
          <button key={q.label} className="chip" onClick={() => (setText(q.value), setMaxed('max' in q && !!q.max))}>
            {q.label}
          </button>
        ))}
      </div>
      {disp.paidIn && !!value && value > 0n && (
        <div className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>
          ≈ {money(amount(side === 'buy' ? value : (quote?.out ?? 0n), cur.decimals) * factor, disp.symbol)} at today’s {disp.code} rate
        </div>
      )}

      {quote && (
        <div style={{ marginBottom: 12 }}>
          <div className="kv">
            <span>You receive</span>
            <span className="num">
              {side === 'buy' ? `${compact(amount(quote.out))} ${coin.symbol}` : money(amount(quote.out, cur.decimals), cur.symbol, { compact: false })}
            </span>
          </div>
          <div className="kv">
            <span>Pool fee ({feePct}%, half to the creator)</span>
            <span className="num">{money(amount(quote.fee, cur.decimals), cur.symbol)}</span>
          </div>
          <div className="kv">
            <span>Minimum, with {slip / 100}% slippage</span>
            <span className="num">{side === 'buy' ? `${compact(amount(minOut))} ${coin.symbol}` : money(amount(minOut, cur.decimals), cur.symbol)}</span>
          </div>
        </div>
      )}

      <button className={`btn btn-lg btn-block ${side === 'buy' ? 'btn-primary' : ''}`} disabled={action.disabled} onClick={action.onClick}>
        {side === 'buy' && !action.disabled && <Sparkle />} {action.label}
      </button>

      <div className="row-between small" style={{ marginTop: 12 }}>
        <span className="muted">Slippage</span>
        <span className="chips">
          {[50, 100, 300].map((s) => (
            <button key={s} className={`chip ${slip === s ? 'on' : ''}`} style={{ height: 24, fontSize: 11 }} onClick={() => setSlip(s)}>
              {s / 100}%
            </button>
          ))}
        </span>
      </div>

      {side === 'buy' && wallet.address && curBal === 0n && (
        <div className="callout small" style={{ marginTop: 14 }}>
          No {cur.code} yet?{' '}
          {cur.mintable && (
            <>
              <Link to={`/desk?code=${cur.code}`} className="accent-text">
                Get test {cur.code} at the desk
              </Link>{' '}
              or{' '}
            </>
          )}
          <Link to={`/swap?in=${usdBase?.token ?? ''}&out=${coin.address}`} className="accent-text">
            pay with another currency
          </Link>
          .
        </div>
      )}
    </div>
  );
}

function Holders({ coin }: { coin: Coin }) {
  const pad = usePad();
  const list = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const t of pad.snap?.trades ?? []) {
      if (t.coin.toLowerCase() !== coin.address.toLowerCase()) continue;
      const k = t.trader.toLowerCase();
      m.set(k, (m.get(k) ?? 0n) + (t.isBuy ? t.tokenAmount : -t.tokenAmount));
    }
    return [...m.entries()].filter(([, v]) => v > 0n).sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 10);
  }, [pad.snap, coin.address]);
  return (
    <div className="panel">
      <div className="kicker">Top holders</div>
      <p className="hint" style={{ marginTop: 6 }}>
        From fills on the pad and in the pool; transfers between wallets are not counted.
      </p>
      <div className="kv">
        <span>In the pool, locked</span>
        <span className="num">{pct(Number((coin.reserveToken * 10000n) / TOTAL_SUPPLY) / 10000)}</span>
      </div>
      {list.map(([who, bal]) => (
        <div key={who} className="kv">
          <span className="mono">
            {shortAddr(who)}
            {who === coin.creator.toLowerCase() && <span className="pill new" style={{ marginLeft: 8, height: 20 }}>creator</span>}
          </span>
          <span className="num">{pct(Number((bal * 10000n) / TOTAL_SUPPLY) / 10000)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CoinPage() {
  const { address = '' } = useParams();
  const pad = usePad();
  const me = useWallet().address as Address | undefined;
  const navigate = useNavigate();
  const [inUsd, setInUsd] = useState(false);
  const coin = pad.coinByAddress.get(address.toLowerCase());
  const cur = coin ? pad.currencyOf(coin) : undefined;
  const row = useMemo(() => (pad.snap && coin ? buildRows({ ...pad.snap, coins: [coin] }, pad.now(), pad.displayOf).at(0) : undefined), [pad.snap, coin, pad]);
  const trades = useMemo(() => (pad.snap?.trades ?? []).filter((t) => t.coin.toLowerCase() === address.toLowerCase()), [pad.snap, address]);

  if (!pad.snap) {
    return (
      <div className="wrap">
        <div className="skeleton" style={{ height: 420 }} />
      </div>
    );
  }
  if (!coin || !cur || !row) {
    return (
      <div className="wrap">
        <div className="panel empty">
          <h3>No coin at this address</h3>
          <p>It may be on another chain, or in the other mode ({pad.mode === 'live' ? 'playground' : 'live'}).</p>
          <Link to="/board" className="btn">
            Back to the board
          </Link>
        </div>
      </div>
    );
  }

  const now = pad.now();
  const perUsd = unitsPerUsd(cur);
  const { disp, factor } = row;
  const exp = pad.chainId ? explorerAddress(pad.chainId, coin.address) : '';
  const poolExp = pad.chainId && coin.pool ? explorerAddress(pad.chainId, coin.pool) : '';
  const fee = pad.snap.params.poolFeePips / 10_000;

  return (
    <div className="wrap">
      <div className="coin-head">
        <div className="coin-avatar" style={skyStyle(coin.address, disp.color)}>
          <CoinOrb coin={coin} currency={disp} size={coin.meta.image ? 76 : 124} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="kicker">Trading on Uniswap · liquidity locked since launch</div>
          <h1>{coin.name}</h1>
          <div className="meta-line">
            <PairBadge coin={coin} currency={disp} size="lg" />
            <StatusPill coin={coin} now={now} />
            <span className="muted small">
              priced in <b style={{ color: disp.color }}>{disp.name}</b>
              {disp.paidIn ? (
                <>
                  {' '}
                  · paid in <b>{disp.paidIn}</b> at {pad.fx[disp.code] ? 'today’s rate' : 'the reference rate'}
                </>
              ) : null}{' '}
              · launched {ago(coin.createdAt, now)} by <span className="mono">{shortAddr(coin.creator)}</span>
            </span>
          </div>
          <div className="meta-line small">
            <span className="mono muted addr-full">{coin.address}</span>
            <span className="mono muted addr-short">{shortAddr(coin.address)}</span>
            <CopyButton text={coin.address} />
            {exp && (
              <a href={exp} target="_blank" rel="noreferrer" className="accent-text">
                Explorer ↗
              </a>
            )}
            {coin.pool && pad.chainId && DEXSCREENER[pad.chainId] && (
              <a href={`https://dexscreener.com/${DEXSCREENER[pad.chainId]}/${coin.pool}`} target="_blank" rel="noopener noreferrer" className="accent-text">
                DexScreener ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="coin-layout">
        <div>
          <div className="coin-stats glass">
            <div className="stat">
              <span className="kicker">Price</span>
              <b className="num">{money(row.dispPrice, disp.symbol)}</b>
              <span className="muted small">{disp.paidIn ? `${money(row.price, cur.symbol)} · ` : ''}{usd(row.priceUsd)}</span>
            </div>
            <div className="stat">
              <span className="kicker">Market cap</span>
              <b className="num">{money(row.dispMcap, disp.symbol)}</b>
              <span className="muted small">{usd(row.mcapUsd)}</span>
            </div>
            <div className="stat">
              <span className="kicker">Liquidity</span>
              <b className="num">{money(row.dispPooled, disp.symbol)}</b>
              <span className="muted small">{usd(row.pooledUsd)} in the pool</span>
            </div>
            <div className="stat">
              <span className="kicker">24h</span>
              <b className={`num ${row.change24 >= 0 ? 'up' : 'down'}`}>
                {row.change24 >= 0 ? '+' : ''}
                {pct(row.change24)}
              </b>
              <span className="muted small">vol {money(row.dispVol24, disp.symbol)}</span>
            </div>
          </div>

          <div className="panel">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <div className="kicker">Price in {inUsd ? 'US dollars' : disp.name}</div>
              <div className="chips">
                <button className={`chip ${!inUsd ? 'on' : ''}`} onClick={() => setInUsd(false)}>
                  {disp.code}
                </button>
                <button className={`chip ${inUsd ? 'on' : ''}`} onClick={() => setInUsd(true)}>
                  USD
                </button>
              </div>
            </div>
            <PriceChart trades={trades} current={row.price} decimals={cur.decimals} color={disp.color} divisor={inUsd ? perUsd : 1 / factor} now={now} />
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="panel">
              <div className="kicker">The pool</div>
              <h3 className="card-title">
                {row.sinceLaunch >= 1 ? `×${row.sinceLaunch.toFixed(2)} since launch` : `${pct(row.sinceLaunch - 1)} since launch`}
              </h3>
              <p className="muted small" style={{ marginTop: 0 }}>
                The whole supply went into this Uniswap pool at launch as one position the pad owns and cannot withdraw. Every buy lifts the price
                along the curve; every sell lowers it.
              </p>
              <div className="kv">
                <span>Coins in the pool</span>
                <span className="num">{compact(amount(coin.reserveToken))} / 1B</span>
              </div>
              <div className="kv">
                <span>In wallets</span>
                <span className="num">{pct(row.sold)} of the supply</span>
              </div>
              <div className="kv">
                <span>{cur.code} in the pool</span>
                <span className="num">{money(row.pooled, cur.symbol)}</span>
              </div>
              <div className="kv">
                <span>Launch price</span>
                <span className="num">{money(row.startPrice * factor, disp.symbol)}</span>
              </div>
              <div className="kv">
                <span>Pool fee</span>
                <span>
                  {fee}% · {fee / 2}% to the creator · {money(amount(coin.creatorFees, cur.decimals), cur.symbol)} paid out so far
                </span>
              </div>
              <div className="kv">
                <span>Pair</span>
                <span>
                  <PairBadge coin={coin} currency={cur} size="sm" />
                </span>
              </div>
              {coin.pool && (
                <div className="kv">
                  <span>Uniswap pool</span>
                  <span className="row" style={{ gap: 10 }}>
                    {poolExp ? (
                      <a className="link mono" href={poolExp} target="_blank" rel="noopener noreferrer">
                        {shortAddr(coin.pool)}
                      </a>
                    ) : (
                      <span className="mono">{shortAddr(coin.pool)}</span>
                    )}
                    {pad.chainId && DEXSCREENER[pad.chainId] && (
                      <a className="link" href={`https://dexscreener.com/${DEXSCREENER[pad.chainId]}/${coin.pool}`} target="_blank" rel="noopener noreferrer">
                        DexScreener
                      </a>
                    )}
                  </span>
                </div>
              )}
            </div>
            <Holders coin={coin} />
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>
              Fills
            </div>
            <RecentFills trades={trades} limit={14} showPair={false} />
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="kicker">About</div>
            <div className="row" style={{ alignItems: 'flex-start', marginTop: 12, gap: 16 }}>
              {coin.meta.image && <img className="about-img" src={imageSrc(coin.meta.image)} alt="" />}
              <div>
                <p style={{ marginTop: 0 }}>{coin.meta.description || <span className="muted">The creator did not write a description.</span>}</p>
                <div className="chips">
                  {coin.meta.links.website && (
                    <a className="chip" href={coin.meta.links.website} target="_blank" rel="noreferrer nofollow">
                      Website ↗
                    </a>
                  )}
                  {coin.meta.links.x && (
                    <a className="chip" href={coin.meta.links.x} target="_blank" rel="noreferrer nofollow">
                      X ↗
                    </a>
                  )}
                  {coin.meta.links.telegram && (
                    <a className="chip" href={coin.meta.links.telegram} target="_blank" rel="noreferrer nofollow">
                      Telegram ↗
                    </a>
                  )}
                  <Link className="chip" to={`/verify?coin=${coin.address}`}>
                    Verify this pairing <Arrow />
                  </Link>
                  {pad.mode === 'playground' && me && coin.creator.toLowerCase() === me.toLowerCase() && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        if (confirm(`Delete ${coin.symbol}? It is a test coin in this browser; it and its fills go away.`) && pad.removeTestCoin(me, coin.address)) {
                          navigate('/board');
                        }
                      }}
                    >
                      Delete this test coin
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <TradePanel coin={coin} cur={cur} disp={disp} factor={factor} />
      </div>
    </div>
  );
}
