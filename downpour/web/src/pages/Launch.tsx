import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import type { Address } from '../backend/types';
import { useWallet } from '../wallet/WalletProvider';
import { CurrencyPicker } from '../components/CurrencyPicker';
import { Orb, PageHead, PairBadge } from '../components/bits';
import { Sparkle } from '../components/icons';
import { CURRENCIES, CURRENCY_BY_CODE, dropGlyph } from '../data/currencies';
import { compact, money, parseAmount, usd } from '../lib/format';
import { amount, displayCurrency, unitsPerUsd } from '../lib/views';
import { chainMeta } from '../config/chains';
import type { Currency } from '../backend/types';
import { applyBuy, curveRaise, graduationPrice, marketCap, newMarket, priceOf, progress, quoteBuy, virtualQuoteFor } from '../lib/math';
import { MAX_META_BYTES, shrinkImage } from '../lib/meta';

const bytes = (s: string) => new TextEncoder().encode(s).length;

export default function Launch() {
  const pad = usePad();
  const wallet = useWallet();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const snap = pad.snap;

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [imageErr, setImageErr] = useState('');
  const [website, setWebsite] = useState('');
  const [x, setX] = useState('');
  const [telegram, setTelegram] = useState('');
  // the currency the coin lives in, by code; and, when the desk does not list that one (euros
  // on mainnet), the desk token buyers pay in
  const [code, setCode] = useState('');
  const [paid, setPaid] = useState<Address>();
  const [firstBuy, setFirstBuy] = useState('');
  const [busy, setBusy] = useState(false);

  const listedByCode = useMemo(() => new Map((snap?.currencies ?? []).map((c) => [c.code, c])), [snap]);
  // a desk that lists only a few real tokens (mainnet) still lets a coin be priced in any currency
  const canPrice = !!snap && snap.currencies.length < CURRENCIES.length;

  useEffect(() => {
    if (!snap || code) return;
    const want = params.get('currency') || (listedByCode.has('EUR') ? 'EUR' : listedByCode.has('ETH') ? 'ETH' : 'USD');
    const ok = listedByCode.has(want) || (canPrice && !!CURRENCY_BY_CODE[want]);
    setCode(ok ? want : (listedByCode.get('USD') ?? snap.currencies[0])?.code ?? '');
  }, [snap, code, params, listedByCode, canPrice]);

  // ether by default, the dollar where the desk has no ether
  const base = listedByCode.get('ETH') ?? listedByCode.get('USD') ?? snap?.currencies[0];
  const listed = code ? listedByCode.get(code) : undefined;
  // what buyers pay in: the chosen currency's own token, else the token picked (ether by default)
  const cur = listed ?? (paid ? pad.currencyByToken.get(paid.toLowerCase()) : undefined) ?? (code ? base : undefined);
  const dispCode = cur && code && code !== cur.code ? code : undefined;
  const disp = cur ? pad.displayOf({ currency: cur.token, meta: { priced: dispCode } } as never, cur) : undefined;
  const chainName = pad.chainId ? chainMeta(pad.chainId).name : 'this chain';
  // every currency on offer: the desk's as they are, the rest priced on the base token
  const options = useMemo<Currency[]>(() => {
    if (!snap) return [];
    if (!canPrice || !base) return snap.currencies;
    return CURRENCIES.map((s) => listedByCode.get(s.code) ?? displayCurrency(base, s.code, listedByCode, pad.fx)).filter((c, i) => c.code === CURRENCIES[i].code);
  }, [snap, canPrice, base, listedByCode, pad.fx]);
  const numbers = useMemo(() => {
    if (!snap || !cur) return null;
    const vq = virtualQuoteFor(cur, snap.params.targetRaiseUsd);
    const m = newMarket(vq, Math.floor(pad.now()));
    const start = priceOf(m, cur.decimals);
    const end = graduationPrice(vq) / 10 ** (cur.decimals - 18);
    const buy = parseAmount(firstBuy, cur.decimals);
    const q = buy ? quoteBuy(m, buy, snap.params, pad.now(), true) : null;
    // where the coin stands right after that first buy
    const after = q ? applyBuy(m, q) : null;
    return {
      vq,
      start,
      end,
      raise: amount(curveRaise(vq), cur.decimals),
      buy,
      q,
      perUsd: unitsPerUsd(cur),
      after: after ? { price: priceOf(after, cur.decimals), mcap: marketCap(after, cur.decimals), sold: progress(after) } : null,
    };
  }, [snap, cur, firstBuy, pad]);

  const factor = cur && disp && disp !== cur ? unitsPerUsd(disp) / unitsPerUsd(cur) : 1;
  const meta = {
    description: description.trim(),
    image,
    links: { website: website.trim() || undefined, x: x.trim() || undefined, telegram: telegram.trim() || undefined },
    priced: dispCode,
  };
  const metaSize = bytes(JSON.stringify(meta));
  const nameOk = bytes(name.trim()) > 0 && bytes(name.trim()) <= 40;
  const tickerOk = /^[A-Z0-9]{1,10}$/.test(ticker);
  const bal = cur ? pad.spendable(cur.token) : 0n;
  const buyTooBig = !!numbers?.buy && numbers.buy > bal;
  const symbolTaken = snap?.coins.some((c) => c.symbol === ticker);

  const onImage = async (file?: File) => {
    setImageErr('');
    if (!file) return;
    try {
      setImage(await shrinkImage(file));
    } catch (e: any) {
      setImageErr(e.message);
    }
  };

  let action: { label: string; disabled: boolean; onClick?: () => void } = { label: 'Launch the coin', disabled: true };
  if (!wallet.address) action = { label: 'Connect a wallet to launch', disabled: false, onClick: wallet.openModal };
  else if (pad.wrongChain && pad.chainId) action = { label: 'Switch network', disabled: false, onClick: () => wallet.switchChain(pad.chainId!) };
  else if (!nameOk) action = { label: 'Name your coin', disabled: true };
  else if (!tickerOk) action = { label: 'Give it a ticker', disabled: true };
  else if (!cur) action = { label: 'Pick a currency', disabled: true };
  else if (metaSize > MAX_META_BYTES) action = { label: 'Image or text too large', disabled: true };
  else if (buyTooBig) action = { label: `Not enough ${cur.code} for that first buy`, disabled: true };
  else if (busy) action = { label: 'Launching…', disabled: true };
  else
    action = {
      label: 'Launch the coin',
      disabled: false,
      onClick: async () => {
        setBusy(true);
        const q = numbers?.q;
        const r = await pad.run(`Launch ${ticker} / ${cur.code}`, (a, o) =>
          pad.backend.createCoin(
            a,
            {
              name: name.trim(),
              symbol: ticker,
              meta,
              currency: cur.token,
              firstBuy: numbers?.buy ?? 0n,
              minTokensOut: q ? (q.tokensOut * 98n) / 100n : 0n,
            },
            o,
          ),
        );
        setBusy(false);
        const coin = (r as { coin?: string } | null)?.coin;
        if (coin) nav(`/coin/${coin}`);
      },
    };

  const fee = snap ? (snap.params.protocolFeeBps + snap.params.creatorFeeBps) / 100 : 1;

  return (
    <div className="wrap">
      <PageHead
        kicker="Launch"
        title="Light a new star"
        lead="A name, a ticker and a currency. The market opens in the same transaction, and the currency you pick is the one your coin trades in for as long as it exists."
      />
      <div className="launch-layout">
        <form className="panel" data-solid onSubmit={(e) => (e.preventDefault(), action.onClick?.())}>
          <div className="field">
            <label htmlFor="name">Coin name</label>
            <input id="name" className={`input ${name && !nameOk ? 'bad' : ''}`} placeholder="Lisbon Lightyear" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <span className="hint">Up to 40 characters. It is what people read on the board.</span>
          </div>
          <div className="field">
            <label htmlFor="ticker">Ticker</label>
            <input
              id="ticker"
              className={`input mono ${ticker && !tickerOk ? 'bad' : ''}`}
              placeholder="LIGHT"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            />
            <span className="hint">
              Capital letters and digits, up to 10.{symbolTaken && <span className="gold-text"> Another coin already uses {ticker}; that is allowed, but buyers may mix them up.</span>}
            </span>
          </div>
          <div className="field">
            <label>Currency</label>
            <CurrencyPicker value={code} options={options} onChange={setCode} />
            {dispCode && cur && snap && (
              <div className="row small paid-in" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                <span className="muted">No {dispCode} token on {chainName} yet, so buyers pay in</span>
                <select className="select" style={{ width: 'auto', height: 32 }} value={cur.token} onChange={(e) => setPaid(e.target.value as Address)} aria-label="Paid in">
                  {snap.currencies.map((c) => (
                    <option key={c.token} value={c.token}>
                      {c.tokenSymbol ?? c.code} · {c.name}
                    </option>
                  ))}
                </select>
                <span className="muted">at today’s {dispCode} rate; the coin is shown and quoted in {dispCode}.</span>
              </div>
            )}
            <span className="hint">Chosen once. Prices, fees and payouts for this coin will all be in it, forever.</span>
          </div>
          <div className="field">
            <label htmlFor="desc">Description (optional)</label>
            <textarea id="desc" className="input" placeholder="What is this coin about?" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} />
          </div>
          <div className="field">
            <label>Picture (optional)</label>
            <div className="image-pick">
              {image && <img src={image} alt="" />}
              <label className="btn btn-sm">
                {image ? 'Change picture' : 'Choose a picture'}
                <input type="file" accept="image/*" hidden onChange={(e) => onImage(e.target.files?.[0])} />
              </label>
              {image && (
                <button type="button" className="link muted small" onClick={() => setImage('')}>
                  Remove
                </button>
              )}
            </div>
            <span className={`hint ${imageErr ? 'down' : ''}`}>{imageErr || 'Shrunk to a small square in your browser and stored with the launch, no upload service involved.'}</span>
          </div>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <div className="field">
              <label htmlFor="web">Website</label>
              <input id="web" className="input" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="x">X</label>
              <input id="x" className="input" placeholder="https://x.com/…" value={x} onChange={(e) => setX(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="tg">Telegram</label>
              <input id="tg" className="input" placeholder="https://t.me/…" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="first">Your first buy (optional)</label>
            <div className="input-affix">
              <input id="first" className={`input ${buyTooBig ? 'bad' : ''}`} inputMode="decimal" placeholder="0" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} />
              <span className="affix">{cur?.code}</span>
            </div>
            {numbers?.q && numbers.after && cur && (
              <div className="first-buy-preview num" aria-live="polite">
                <span>
                  You get <b>{compact(amount(numbers.q.tokensOut))}</b> {ticker || 'coins'} · <b>{((Number(numbers.q.tokensOut) / 1e27) * 100).toFixed(2)}%</b> of the 1B supply
                </span>
                <span className="muted small">
                  Price after {money(numbers.after.price, cur.symbol)} · market cap {money(numbers.after.mcap, cur.symbol)} ·{' '}
                  {usd(numbers.after.mcap / numbers.perUsd)} · {(numbers.after.sold * 100).toFixed(1)}% of the curve sold
                </span>
              </div>
            )}
            <span className="hint">
              Buys in the same transaction as the launch, before anyone else can, and skips the snipe tax.{cur && ` Balance: ${money(amount(bal, cur.decimals), cur.symbol)}`}
              {cur && pad.wrapNote(cur.token) ? ` (${pad.wrapNote(cur.token)})` : ''}
            </span>
          </div>

          {!wallet.address && (
            <div className="callout" style={{ marginBottom: 16 }}>
              <b>Connect a wallet to launch.</b>{' '}
              {pad.mode === 'playground' ? 'In the playground nothing is signed; your address simply becomes the creator.' : 'You will sign one transaction (two if you add a first buy and need to approve the currency).'}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={action.disabled}>
            {!action.disabled && <Sparkle />} {action.label}
          </button>
          <p className="hint center" style={{ marginBottom: 0 }}>
            The currency cannot be changed after launch. Pick the money your buyers already use.
          </p>
        </form>

        <div className="stack" style={{ gap: 18 }}>
          <div className="card" style={{ '--c': (disp ?? cur)?.color ?? '#7cc4ff' } as React.CSSProperties}>
            <div className="preview">
              <span className="cc-code">{(disp ?? cur)?.code}</span>
              <div className="cc-orb">
                <Orb color={(disp ?? cur)?.color ?? '#7cc4ff'} glyph={disp ?? cur ? dropGlyph((disp ?? cur)!.code) : '?'} image={image || undefined} size={image ? 96 : 150} />
              </div>
              <span className="cc-ticker">{ticker || 'TICKER'}</span>
            </div>
          </div>
          <div className="panel">
            <div className="kicker">Launch summary</div>
            <h3 className="card-title" style={{ marginBottom: 4 }}>
              {name.trim() || 'Your coin'}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <PairBadge coin={{ symbol: ticker || 'TICKER' }} currency={disp ?? cur} />
            </div>
            {numbers && cur && disp && (
              <>
                <div className="kv">
                  <span>Paid in</span>
                  <span>
                    {cur.code} · {cur.name}
                  </span>
                </div>
                {disp !== cur && (
                  <div className="kv">
                    <span>Priced in</span>
                    <span>
                      {disp.code} · {disp.name}
                    </span>
                  </div>
                )}
                <div className="kv">
                  <span>Starting price</span>
                  <span className="num">
                    {money(numbers.start * factor, disp.symbol)}
                    {disp !== cur ? ` · ${money(numbers.start, cur.symbol)}` : ''}
                  </span>
                </div>
                <div className="kv">
                  <span>Supply</span>
                  <span>1B</span>
                </div>
                <div className="kv">
                  <span>Sold on the curve</span>
                  <span>800M</span>
                </div>
                <div className="kv">
                  <span>Held back for its Uniswap pool</span>
                  <span>200M</span>
                </div>
                <div className="kv">
                  <span>A full curve raises</span>
                  <span className="num">
                    {money(numbers.raise, cur.symbol)} · {usd(numbers.raise / numbers.perUsd)}
                  </span>
                </div>
                <div className="kv">
                  <span>Graduates at market cap</span>
                  <span className="num">{money(numbers.end * 1e9, cur.symbol)}</span>
                </div>
                <div className="kv">
                  <span>Trade fee</span>
                  <span>
                    {fee}% · {fee / 2}% to you · {fee / 2}% protocol
                  </span>
                </div>
                <div className="kv">
                  <span>Snipe tax</span>
                  <span>
                    {(snap!.params.snipeTaxBps / 100).toFixed(0)}% → 0 over {snap!.params.snipeWindow}s
                  </span>
                </div>
                {numbers.q && (
                  <div className="kv">
                    <span>Your first buy gets</span>
                    <span className="num up">
                      {compact(amount(numbers.q.tokensOut))} {ticker || 'coins'} ({((Number(numbers.q.tokensOut) / 1e27) * 100).toFixed(2)}%)
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
