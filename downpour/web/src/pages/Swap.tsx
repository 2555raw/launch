import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { Address } from '../backend/types';
import { useWallet } from '../wallet/WalletProvider';
import { TokenSelect } from '../components/TokenSelect';
import { CoinOrb, CurrencyDot, PageHead, PairBadge } from '../components/bits';
import { Arrow, Sparkle, Gear, Swap as SwapIcon } from '../components/icons';
import { quoteSwap, type Step } from '../lib/route';
import { compact, money, parseAmount, pct, toDisplay, toInput, usd } from '../lib/format';
import { amount, sortRows, useRows } from '../lib/views';

const SLIPPAGES = [50, 100, 300];
/** One-tap targets under "You receive". */
const QUICK = ['USD', 'EUR', 'BTC', 'ETH', 'SOL'];

function TokenButton({ token, onClick }: { token?: string; onClick(): void }) {
  const pad = usePad();
  if (!token) {
    return (
      <button className="token-btn empty" onClick={onClick}>
        Select
      </button>
    );
  }
  const coin = pad.coinByAddress.get(token.toLowerCase());
  const cur = coin ? pad.currencyOf(coin) : pad.currencyByToken.get(token.toLowerCase());
  return (
    <button className="token-btn" onClick={onClick}>
      {coin ? <CoinOrb coin={coin} currency={cur} size={22} /> : cur && <CurrencyDot c={cur} size={26} />}
      {coin ? coin.symbol : cur?.code}
      <span className="muted" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}

function RouteView({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <div className="route" aria-label="Route">
      <span className="hop">{steps[0].from}</span>
      {steps.map((s, i) => (
        <span key={i} className="row" style={{ gap: 6 }}>
          <span className="via">→ {s.kind === 'desk' ? 'desk' : s.kind === 'buy' ? 'curve buy' : 'curve sell'} →</span>
          <span className="hop">{s.to}</span>
        </span>
      ))}
    </div>
  );
}

export default function Swap() {
  const pad = usePad();
  const wallet = useWallet();
  const rows = useRows();
  const [params, setParams] = useSearchParams();
  const snap = pad.snap;

  const [tokenIn, setTokenIn] = useState<Address | undefined>(params.get('in') as Address | undefined);
  const [tokenOut, setTokenOut] = useState<Address | undefined>(params.get('out') as Address | undefined);
  const [text, setText] = useState('');
  const [maxed, setMaxed] = useState(false);
  const [slip, setSlip] = useState(100);
  const [picking, setPicking] = useState<'in' | 'out' | null>(null);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sensible defaults once the pad has loaded: pay in USD, receive the busiest coin.
  useEffect(() => {
    if (!snap) return;
    if (!tokenIn) {
      const usdCur = snap.currencies.find((c) => c.code === 'USD') ?? snap.currencies[0];
      setTokenIn(usdCur?.token);
    }
    if (!tokenOut) {
      const top = sortRows(rows, 'active').find((r) => !r.coin.graduated) ?? rows[0];
      if (top) setTokenOut(top.coin.address);
    }
  }, [snap, rows, tokenIn, tokenOut]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (tokenIn) next.set('in', tokenIn);
    if (tokenOut) next.set('out', tokenOut);
    setParams(next, { replace: true });
  }, [tokenIn, tokenOut, setParams]);

  const decOf = (t?: string) => (t ? pad.currencyByToken.get(t.toLowerCase())?.decimals ?? 18 : 18);
  const labelOf = (t?: string) => {
    if (!t) return '';
    const c = pad.currencyByToken.get(t.toLowerCase());
    return c ? c.code : pad.coinByAddress.get(t.toLowerCase())?.symbol ?? '';
  };
  const bal = tokenIn ? pad.balances[tokenIn.toLowerCase()] ?? 0n : 0n;
  // "Max" spends the exact balance, not the rounded number shown in the field.
  const amountIn = maxed ? bal : parseAmount(text, decOf(tokenIn));
  const q = useMemo(() => (pad.book && tokenIn && tokenOut && amountIn ? quoteSwap(pad.book, tokenIn, tokenOut, amountIn) : null), [pad.book, tokenIn, tokenOut, amountIn]);
  const balOut = tokenOut ? pad.balances[tokenOut.toLowerCase()] ?? 0n : 0n;
  const minOut = q ? (q.amountOut * BigInt(10_000 - slip)) / 10_000n : 0n;
  const usdIn = tokenIn && amountIn ? pad.usdValue(tokenIn, amountIn) : 0;
  const usdOut = tokenOut && q ? pad.usdValue(tokenOut, q.amountOut) : 0;

  const outCoin = tokenOut ? pad.coinByAddress.get(tokenOut.toLowerCase()) : undefined;
  const inCoin = tokenIn ? pad.coinByAddress.get(tokenIn.toLowerCase()) : undefined;
  const pairCoin = outCoin ?? inCoin;
  const pairCur = pairCoin ? pad.currencyOf(pairCoin) : undefined;
  // A buy pays its fee in the currency going in; a sell or a conversion in the currency coming out.
  const tokenOfCode = (code: string) => snap?.currencies.find((c) => c.code === code)?.token ?? '';
  const fees = q ? q.steps.reduce((a, s) => a + pad.usdValue(tokenOfCode(s.kind === 'buy' ? s.from : s.to), s.fee + (s.snipeTax ?? 0n)), 0) : 0;
  const snipe = q?.steps.find((s) => (s.snipeTax ?? 0n) > 0n);

  let action: { label: string; disabled: boolean; onClick?: () => void } = { label: 'Swap', disabled: true };
  if (!wallet.address || (pad.mode === 'live' && wallet.isGuest)) action = { label: 'Connect wallet', disabled: false, onClick: wallet.openModal };
  else if (pad.wrongChain && pad.chainId) action = { label: 'Switch network', disabled: false, onClick: () => wallet.switchChain(pad.chainId!) };
  else if (!tokenIn || !tokenOut) action = { label: 'Select a token', disabled: true };
  else if (!amountIn) action = { label: 'Enter an amount', disabled: true };
  else if (q?.error) action = { label: q.error, disabled: true };
  else if (amountIn > bal) action = { label: `Not enough ${labelOf(tokenIn)}`, disabled: true };
  else if (busy) action = { label: 'Swapping…', disabled: true };
  else
    action = {
      label: q && q.impact > 0.15 ? 'Swap anyway (high price impact)' : 'Swap',
      disabled: false,
      onClick: async () => {
        setBusy(true);
        const r = await pad.run(`Swap ${labelOf(tokenIn)} → ${labelOf(tokenOut)}`, (acct, o) => pad.backend.swap(acct, tokenIn, tokenOut, amountIn, minOut, o));
        setBusy(false);
        if (r) {
          setText('');
          setMaxed(false);
        }
      },
    };

  const flip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setMaxed(false);
    setText(q && q.amountOut > 0n ? toInput(q.amountOut, decOf(tokenOut)) : '');
  };
  const outText = q && q.amountOut > 0n ? toDisplay(q.amountOut, decOf(tokenOut)) : '';
  const sizeClass = (t: string) => (t.length > 14 ? 'longer' : t.length > 10 ? 'long' : '');

  const pairs = useMemo(() => sortRows(rows, 'volume').slice(0, 12), [rows]);

  return (
    <div className="wrap">
      <PageHead
        kicker="Anything for anything"
        title="Swap"
        lead="Trade any coin for any other, or for any currency on the desk. If the two sides live in different currencies, the router converts in between, in one transaction."
      />
      <div className="swap-page">
        <div className="panel swap-card" data-solid>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <b>Swap</b>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setSettings((s) => !s)} aria-label="Slippage settings" aria-expanded={settings}>
                <Gear />
              </button>
              {settings && (
                <div className="acct-menu glass" style={{ width: 250 }}>
                  <div className="label">Max slippage</div>
                  <div className="chips">
                    {SLIPPAGES.map((s) => (
                      <button key={s} className={`chip ${slip === s ? 'on' : ''}`} onClick={() => setSlip(s)}>
                        {s / 100}%
                      </button>
                    ))}
                  </div>
                  <p className="hint" style={{ margin: 0 }}>
                    If the price moves more than this before your swap lands, it is cancelled and nothing is spent.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="swap-box">
            <div className="row-between">
              <span>You pay</span>
              <span className="num">
                Balance {compact(amount(bal, decOf(tokenIn)))}{' '}
                {bal > 0n && (
                  <button
                    className="link accent-text"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      setText(toDisplay(bal, decOf(tokenIn)));
                      setMaxed(true);
                    }}
                  >
                    Max
                  </button>
                )}
              </span>
            </div>
            <div className="big-input">
              <input
                inputMode="decimal"
                placeholder="0"
                className={sizeClass(text)}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setMaxed(false);
                }}
                aria-label="Amount to pay"
              />
              <TokenButton token={tokenIn} onClick={() => setPicking('in')} />
            </div>
            <div className="small muted">{usdIn ? `≈ ${usd(usdIn)}` : ' '}</div>
          </div>

          <button className="flip" onClick={flip} aria-label="Flip">
            <SwapIcon />
          </button>

          <div className="swap-box">
            <div className="row-between">
              <span>You receive</span>
              <span className="num">Balance {compact(amount(balOut, decOf(tokenOut)))}</span>
            </div>
            <div className="big-input">
              <input readOnly placeholder="0" className={sizeClass(outText)} value={outText} aria-label="Amount to receive" />
              <TokenButton token={tokenOut} onClick={() => setPicking('out')} />
            </div>
            <div className="small muted">{usdOut ? `≈ ${usd(usdOut)}` : ' '}</div>
          </div>

          <div className="swap-quick" aria-label="Popular">
            {QUICK.map((code) => {
              const c = snap?.currencies.find((x) => x.code === code);
              if (!c) return null;
              const on = tokenOut?.toLowerCase() === c.token.toLowerCase();
              return (
                <button key={code} type="button" className={`quick-pick ${on ? 'on' : ''}`} onClick={() => setTokenOut(c.token)} aria-pressed={on}>
                  <CurrencyDot c={c} size={18} />
                  {code}
                </button>
              );
            })}
          </div>

          {pairCoin && pairCur && (
            <div className="pair-callout" style={{ '--c': pairCur.color, marginTop: 14 } as React.CSSProperties}>
              <PairBadge coin={pairCoin} currency={pairCur} />
              <span>
                <b>{pairCoin.symbol}</b> is paired with <b>{pairCur.name}</b>. Its price, fees and payouts are all in {pairCur.code}.
              </span>
            </div>
          )}

          {q && amountIn && !q.error && (
            <div style={{ marginTop: 14 }}>
              <div className="kv">
                <span>Rate</span>
                <span className="num">
                  1 {labelOf(tokenIn)} = {compact(amount(q.amountOut, decOf(tokenOut)) / amount(amountIn, decOf(tokenIn)), 4)} {labelOf(tokenOut)}
                </span>
              </div>
              <div className="kv">
                <span>Route</span>
                <span>
                  <RouteView steps={q.steps} />
                </span>
              </div>
              <div className="kv">
                <span>Price impact</span>
                <span className={q.impact > 0.05 ? 'down' : ''}>{pct(q.impact, 2)}</span>
              </div>
              <div className="kv">
                <span>Fees</span>
                <span>≈ {usd(fees)}</span>
              </div>
              {snipe && (
                <div className="kv">
                  <span className="gold-text">Snipe tax (coin just launched)</span>
                  <span className="gold-text">{money(amount(snipe.snipeTax ?? 0n), '')} {snipe.from}</span>
                </div>
              )}
              <div className="kv">
                <span>Minimum received</span>
                <span className="num">
                  {compact(amount(minOut, decOf(tokenOut)))} {labelOf(tokenOut)}
                </span>
              </div>
              {q.refund > 0n && (
                <div className="callout bolt small" style={{ marginTop: 10 }}>
                  This buy fills the rest of the curve and graduates the coin. The part it does not need,{' '}
                  {compact(amount(q.refund, decOf(q.refundToken)))} {labelOf(q.refundToken)}, comes back to you.
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} disabled={action.disabled} onClick={action.onClick}>
            {action.label === 'Swap' && <Sparkle />} {action.label}
          </button>
          {pad.mode === 'playground' && <p className="hint center" style={{ marginBottom: 0 }}>Playground: simulated balances, nothing is signed.</p>}
        </div>

        <aside className="pairs-side">
          <div className="panel">
            <div className="kicker">Pairs at a glance</div>
            <h3 className="card-title">Which coin lives in which money</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Tap a pair to swap into it. The right half of each badge is the currency the coin is priced in.
            </p>
            {pairs.map((r) => (
              <div key={r.coin.address} className="pair-row" onClick={() => setTokenOut(r.coin.address)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setTokenOut(r.coin.address)}>
                <span className="row" style={{ minWidth: 0 }}>
                  <PairBadge coin={r.coin} currency={r.cur} size="sm" />
                  <span className="muted small pair-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.coin.name}
                  </span>
                </span>
                <span className="num small">{money(r.price, r.cur.symbol)}</span>
                <span className={`small num ${r.change24 >= 0 ? 'up' : 'down'}`}>
                  {r.change24 >= 0 ? '+' : ''}
                  {pct(r.change24)}
                </span>
              </div>
            ))}
            <Link to="/board" className="link" style={{ marginTop: 14 }}>
              Every pair on the board <Arrow dir="right" />
            </Link>
          </div>
          <div className="panel" style={{ marginTop: 18 }}>
            <div className="kicker">How a swap travels</div>
            <ul className="muted small" style={{ paddingLeft: 18, marginBottom: 0 }}>
              <li>
                <b>Currency → currency</b>: the desk converts at the posted rate, {((pad.snap?.params.deskFeeBps ?? 10) / 100).toFixed(2)}% fee.
              </li>
              <li>
                <b>Currency → coin</b>: converted into the coin's currency if needed, then bought on its curve (or pool).
              </li>
              <li>
                <b>Coin → coin</b>: sold into its currency, converted if the other coin lives in a different one, then bought.
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <TokenSelect
        open={picking !== null}
        onClose={() => setPicking(null)}
        exclude={picking === 'in' ? tokenOut : tokenIn}
        onPick={(t) => (picking === 'in' ? setTokenIn(t) : setTokenOut(t))}
      />
    </div>
  );
}
