import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { Coin, Currency } from '../backend/types';
import { useWallet } from '../wallet/WalletProvider';
import { explorerAddress } from '../config/chains';
import { CoinOrb, CopyButton, PairBadge, ProgressBar, StatusPill } from '../components/bits';
import { PriceChart } from '../components/PriceChart';
import { skyStyle } from '../components/CoinCard';
import { RecentFills } from '../components/sections';
import { Arrow, Sparkle } from '../components/icons';
import { ago, compact, money, parseAmount, pct, shortAddr, toInput, usd } from '../lib/format';
import { amount, buildRows, unitsPerUsd } from '../lib/views';
import { CURVE_SUPPLY, TOTAL_SUPPLY, fromUsd, graduationPrice, quoteBuy, quoteSell, snipeBps, WAD } from '../lib/math';
import { imageSrc } from '../lib/meta';

function TradePanel({ coin, cur }: { coin: Coin; cur: Currency }) {
  const pad = usePad();
  const wallet = useWallet();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [text, setText] = useState('');
  const [maxed, setMaxed] = useState(false);
  const [slip, setSlip] = useState(100);
  const [busy, setBusy] = useState(false);
  const params = pad.snap!.params;
  const now = pad.now();

  const curBal = pad.balances[cur.token.toLowerCase()] ?? 0n;
  const coinBal = pad.balances[coin.address.toLowerCase()] ?? 0n;
  const dec = side === 'buy' ? cur.decimals : 18;
  const have = side === 'buy' ? curBal : coinBal;
  // Max and 100% use the exact balance, so selling everything leaves no dust behind.
  const value = maxed ? have : parseAmount(text, dec);
  const snipe = snipeBps(coin.createdAt, now, params);

  const quote = useMemo(() => {
    if (!value) return null;
    if (side === 'buy') {
      const q = quoteBuy(coin, value, params, now);
      return { out: q.tokensOut, used: q.quoteUsed, fee: q.protocolFee + q.creatorFee, snipe: q.snipeTax, graduates: q.graduates };
    }
    const q = quoteSell(coin, value, params);
    return { out: q.quoteOut, used: value, fee: q.protocolFee + q.creatorFee, snipe: 0n, graduates: false };
  }, [value, side, coin, params, now]);

  const minOut = quote ? (quote.out * BigInt(10_000 - slip)) / 10_000n : 0n;

  const quick =
    side === 'buy'
      ? [10, 50, 100, 500].map((u) => ({ label: `$${u}`, value: toInput(fromUsd(cur, BigInt(u) * WAD), cur.decimals, 6) }))
      : [25, 50, 75, 100].map((p) => ({ label: `${p}%`, value: toInput((coinBal * BigInt(p)) / 100n, 18, 6), max: p === 100 }));

  let action: { label: string; disabled: boolean; onClick?: () => void } = { label: side === 'buy' ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`, disabled: true };
  if (!wallet.address || (pad.mode === 'live' && wallet.isGuest)) action = { label: 'Connect wallet', disabled: false, onClick: wallet.openModal };
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
        const r =
          side === 'buy'
            ? await pad.run(`Buy ${coin.symbol} with ${cur.code}`, (a, o) => pad.backend.buy(a, coin.address, value, minOut, o))
            : await pad.run(`Sell ${coin.symbol} for ${cur.code}`, (a, o) => pad.backend.sell(a, coin.address, value, minOut, o));
        setBusy(false);
        if (r) {
          setText('');
          setMaxed(false);
        }
      },
    };

  const usdBase = pad.snap?.currencies.find((c) => c.code === 'USD');

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

      {snipe > 0 && side === 'buy' && (
        <div className="callout bolt small" style={{ marginBottom: 12 }}>
          <b>Snipe tax {(snipe / 100).toFixed(1)}%</b> right now: this coin opened {Math.floor(now - coin.createdAt)}s ago. It falls to zero at {params.snipeWindow}s.
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
            <span>Fee ({(params.protocolFeeBps + params.creatorFeeBps) / 100}%)</span>
            <span className="num">{money(amount(quote.fee + quote.snipe, cur.decimals), cur.symbol)}</span>
          </div>
          <div className="kv">
            <span>Minimum, with {slip / 100}% slippage</span>
            <span className="num">{side === 'buy' ? `${compact(amount(minOut))} ${coin.symbol}` : money(amount(minOut, cur.decimals), cur.symbol)}</span>
          </div>
          {quote.graduates && (
            <div className="callout small" style={{ marginTop: 8 }}>
              This buy takes the last coins on the curve and graduates {coin.symbol} into its pool. You only pay for what is left.
            </div>
          )}
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
  const inPad = coin.graduated ? coin.reserveToken : coin.curveLeft + (TOTAL_SUPPLY - CURVE_SUPPLY);
  return (
    <div className="panel">
      <div className="kicker">Top holders</div>
      <p className="hint" style={{ marginTop: 6 }}>
        From fills on the pad; transfers between wallets are not counted.
      </p>
      <div className="kv">
        <span>{coin.graduated ? 'Pool (locked)' : 'Curve + pool reserve (unsold)'}</span>
        <span className="num">{pct(Number((inPad * 10000n) / TOTAL_SUPPLY) / 10000)}</span>
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
  const [inUsd, setInUsd] = useState(false);
  const coin = pad.coinByAddress.get(address.toLowerCase());
  const cur = coin ? pad.currencyOf(coin) : undefined;
  const row = useMemo(() => (pad.snap && coin ? buildRows({ ...pad.snap, coins: [coin] }, pad.now()).at(0) : undefined), [pad.snap, coin, pad]);
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
  const sold = CURVE_SUPPLY - coin.curveLeft;
  const gradPrice = graduationPrice(coin.virtualQuote) / 10 ** (cur.decimals - 18);
  const exp = pad.chainId ? explorerAddress(pad.chainId, coin.address) : '';

  return (
    <div className="wrap">
      <div className="coin-head">
        <div className="coin-avatar" style={skyStyle(coin.address, cur.color)}>
          <CoinOrb coin={coin} currency={cur} size={coin.meta.image ? 76 : 124} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="kicker">{coin.graduated ? 'Graduated · trading in its pool' : 'On the curve'}</div>
          <h1>{coin.name}</h1>
          <div className="meta-line">
            <PairBadge coin={coin} currency={cur} size="lg" />
            <StatusPill coin={coin} now={now} />
            <span className="muted small">
              priced in <b style={{ color: cur.color }}>{cur.name}</b> · launched {ago(coin.createdAt, now)} by <span className="mono">{shortAddr(coin.creator)}</span>
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
          </div>
        </div>
      </div>

      <div className="coin-layout">
        <div>
          <div className="coin-stats glass">
            <div className="stat">
              <span className="kicker">Price</span>
              <b className="num">{money(row.price, cur.symbol)}</b>
              <span className="muted small">{usd(row.priceUsd)}</span>
            </div>
            <div className="stat">
              <span className="kicker">Market cap</span>
              <b className="num">{money(row.mcap, cur.symbol)}</b>
              <span className="muted small">{usd(row.mcapUsd)}</span>
            </div>
            <div className="stat">
              <span className="kicker">Backing</span>
              <b className="num">{money(row.raised, cur.symbol)}</b>
              <span className="muted small">{usd(row.raised / perUsd)}</span>
            </div>
            <div className="stat">
              <span className="kicker">24h</span>
              <b className={`num ${row.change24 >= 0 ? 'up' : 'down'}`}>
                {row.change24 >= 0 ? '+' : ''}
                {pct(row.change24)}
              </b>
              <span className="muted small">vol {money(row.vol24, cur.symbol)}</span>
            </div>
          </div>

          <div className="panel">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <div className="kicker">Price in {inUsd ? 'US dollars' : cur.name}</div>
              <div className="chips">
                <button className={`chip ${!inUsd ? 'on' : ''}`} onClick={() => setInUsd(false)}>
                  {cur.code}
                </button>
                <button className={`chip ${inUsd ? 'on' : ''}`} onClick={() => setInUsd(true)}>
                  USD
                </button>
              </div>
            </div>
            <PriceChart trades={trades} current={row.price} decimals={cur.decimals} color={cur.color} divisor={inUsd ? perUsd : 1} now={now} />
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="panel">
              <div className="kicker">{coin.graduated ? 'The pool' : 'The curve'}</div>
              <h3 className="card-title">{coin.graduated ? 'Graduated. Liquidity is locked for good.' : `${pct(row.progress)} of the curve is sold`}</h3>
              <ProgressBar value={row.progress} full={coin.graduated} />
              <div className="kv" style={{ marginTop: 10 }}>
                <span>Sold on the curve</span>
                <span className="num">{compact(amount(coin.graduated ? CURVE_SUPPLY : sold))} / 800M</span>
              </div>
              <div className="kv">
                <span>Raised</span>
                <span className="num">
                  {money(row.raised, cur.symbol)} of {money(row.raiseTarget, cur.symbol)}
                </span>
              </div>
              <div className="kv">
                <span>{coin.graduated ? 'Pool reserves' : 'Graduates at price'}</span>
                <span className="num">
                  {coin.graduated ? `${compact(amount(coin.reserveToken))} ${coin.symbol} · ${money(amount(coin.reserveQuote, cur.decimals), cur.symbol)}` : money(gradPrice, cur.symbol)}
                </span>
              </div>
              <div className="kv">
                <span>Pair</span>
                <span>
                  <PairBadge coin={coin} currency={cur} size="sm" />
                </span>
              </div>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        <TradePanel coin={coin} cur={cur} />
      </div>
    </div>
  );
}
