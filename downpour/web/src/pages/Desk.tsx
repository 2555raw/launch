import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { parseUnits } from 'viem';
import { usePad } from '../backend/PadProvider';
import type { Address, Currency } from '../backend/types';
import { useWallet } from '../wallet/WalletProvider';
import { CurrencyDot, Modal, PageHead } from '../components/bits';
import { KeeperLine } from '../components/sections';
import { Search } from '../components/icons';
import { CURRENCIES, CURRENCY_BY_CODE, REGIONS } from '../data/currencies';
import { ago, compact, money, parseAmount, toInput, usd } from '../lib/format';
import { quoteConvert } from '../lib/math';
import { amount, unitsPerUsd } from '../lib/views';

type Tab = 'all' | 'fiat' | 'other';

function DeskModal({ cur, onClose }: { cur: Currency; onClose(): void }) {
  const pad = usePad();
  const wallet = useWallet();
  const snap = pad.snap!;
  // into the dollar (or, from the dollar, the euro), else whatever else the desk lists
  const [toCode, setToCode] = useState(() => {
    const others = snap.currencies.filter((c) => c.code !== cur.code);
    return (others.find((c) => c.code === (cur.code === 'USD' ? 'EUR' : 'USD')) ?? others[0])?.code ?? '';
  });
  const [text, setText] = useState('');
  // the field as it is now, so a trade that goes through only clears what it sent
  const typed = useRef(text);
  useEffect(() => {
    typed.current = text;
  }, [text]);
  const [readyAt, setReadyAt] = useState(0);
  const to = snap.currencies.find((c) => c.code === toCode)!;
  const value = parseAmount(text, cur.decimals);
  const q = value && to ? quoteConvert(cur, to, value, snap.params.deskFeeBps) : null;
  // a real token comes out of the desk's reserve; a test currency is minted on the spot
  const short = !!(q && to && to.reserve !== undefined && q.amountOut > to.reserve);
  const bal = pad.balances[cur.token.toLowerCase()] ?? 0n;
  const canUse = !!wallet.address;
  const now = pad.now();

  useEffect(() => {
    if (!canUse || !wallet.address) return;
    pad.backend.faucetReadyAt(wallet.address, cur.token).then(setReadyAt).catch(() => setReadyAt(0));
  }, [canUse, wallet.address, cur.token, pad.backend, pad.snap]);

  const faucetWait = readyAt && readyAt > now ? Math.ceil((readyAt - now) / 60) : 0;
  const faucetUsd = Number(snap.params.faucetUsd) / 1e18;

  return (
    <Modal open onClose={onClose} title={`${cur.code} · ${cur.name}`} wide>
      <div className="row" style={{ marginBottom: 14 }}>
        <CurrencyDot c={cur} size={44} />
        <div>
          <div className="num">{cur.code === 'USD' ? 'The reference currency' : `1 USD = ${compact(unitsPerUsd(cur), 6)} ${cur.code}`}</div>
          <div className="muted small">
            Rate updated {ago(cur.updatedAt, now)} ·{' '}
            {cur.mintable
              ? 'test currency, minted by the desk'
              : `${cur.tokenSymbol ?? 'external token'} on chain · the desk holds ${money(amount(cur.reserve ?? 0n, cur.decimals), cur.symbol)} to convert into`}
          </div>
        </div>
      </div>

      <div className="label" style={{ marginBottom: 6 }}>
        Convert {cur.code} into
      </div>
      <select className="select" value={toCode} onChange={(e) => setToCode(e.target.value)} style={{ marginBottom: 10 }}>
        {snap.currencies
          .filter((c) => c.code !== cur.code)
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
      </select>
      <div className="big-input" style={{ marginBottom: 8 }}>
        <input inputMode="decimal" placeholder="0" value={text} onChange={(e) => setText(e.target.value)} aria-label={`Amount of ${cur.code}`} />
        <span className="unit">{cur.code}</span>
      </div>
      <div className="row-between small muted" style={{ marginBottom: 12 }}>
        <button className="link small" onClick={() => setText(toInput(bal, cur.decimals, 8))}>
          Balance {money(amount(bal, cur.decimals), cur.symbol)}
        </button>
        {q && to && (
          <span className="num">
            → {money(amount(q.amountOut, to.decimals), to.symbol, { compact: false })} (fee {money(amount(q.fee, to.decimals), to.symbol)})
          </span>
        )}
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!!canUse && (!value || value > bal || short)}
        onClick={async () => {
          if (!canUse) return wallet.openModal();
          if (!value || !q) return;
          const sent = text;
          const r = await pad.run(`Convert ${cur.code} → ${to.code}`, (a, o) =>
            pad.backend.swap(a, cur.token, to.token, value, (q.amountOut * 995n) / 1000n, o),
          );
          if (r && typed.current === sent) setText('');
        }}
      >
        {!canUse
          ? 'Connect wallet'
          : value && value > bal
            ? `Not enough ${cur.code}`
            : short
              ? `The desk holds ${to.reserve === 0n ? 'no' : 'too little'} ${to.code}`
              : `Convert to ${to?.code}`}
      </button>

      {!cur.mintable && cur.code === 'ETH' && cur.tokenSymbol === 'WETH' && pad.backend.unwrap && canUse && (
        <div className="callout" style={{ marginTop: 16 }}>
          <b>Wrapped ether.</b> Paying in ETH wraps it for you; what you get back from a sale is WETH. Turn it back into plain ETH any time.
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-sm"
              disabled={bal === 0n}
              onClick={() => pad.run('Unwrap ETH', (a, o) => pad.backend.unwrap!(a, cur.token, bal, o))}
            >
              Unwrap {money(amount(bal, cur.decimals), cur.symbol)} to ETH
            </button>
          </div>
        </div>
      )}
      {cur.mintable && (
        <div className="callout" style={{ marginTop: 16 }}>
          <b>Need some {cur.code}?</b> The faucet hands out {usd(faucetUsd)} worth of test {cur.code}
          {snap.params.faucetCooldown ? `, once every ${Math.round(snap.params.faucetCooldown / 60)} minutes per currency` : ''}. Test currencies have no value.
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-sm"
              disabled={!!faucetWait}
              onClick={() => (canUse ? pad.run(`Faucet: test ${cur.code}`, (a, o) => pad.backend.faucet(a, cur.token, o)) : wallet.openModal())}
            >
              {faucetWait ? `Ready in ${faucetWait} min` : `Get test ${cur.code}`}
            </button>
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <Link to={`/board?currency=${cur.code}`} className="chip" onClick={onClose}>
          Coins priced in {cur.code}
        </Link>
        <Link to={`/launch?currency=${cur.code}`} className="chip" onClick={onClose}>
          Launch a coin in {cur.code}
        </Link>
      </div>
    </Modal>
  );
}

/** The desk's owner, on chain: list a token that trades there under a currency code, so
 *  coins can pair with it (a euro stablecoin that reaches the chain, USDC…). */
function ListTokenPanel() {
  const pad = usePad();
  const wallet = useWallet();
  const [owner, setOwner] = useState<string>();
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (pad.mode !== 'live' || !pad.backend.deskOwner) return;
    pad.backend.deskOwner().then(setOwner, () => setOwner(undefined));
  }, [pad.mode, pad.backend]);
  const me = wallet.address;
  if (pad.mode !== 'live' || !owner || !me || owner.toLowerCase() !== me.toLowerCase() || !pad.backend.listCurrency) return null;
  const listed = new Set((pad.snap?.currencies ?? []).map((c) => c.code));
  const options = CURRENCIES.filter((c) => !listed.has(c.code));
  const rate = code === 'USD' ? 1 : (pad.fx[code] ?? CURRENCY_BY_CODE[code]?.rate);
  const ok = /^0x[0-9a-fA-F]{40}$/.test(token) && !!code && !!rate;
  return (
    <div className="panel" data-solid style={{ marginBottom: 18 }}>
      <div className="kicker">You own this desk</div>
      <h3 className="card-title">List a token that trades on this chain</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        A euro, yen or any other token that reaches the chain goes on the desk under its currency code, and coins can pair with it from then on. One
        transaction from your wallet; the desk reads the token’s decimals itself. Its first rate is today’s from two public feeds (
        {Object.keys(pad.fx).length ? 'reachable now' : 'unreachable now, so the reference rate on file'}); the keeper posts the next ones.
      </p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <input
          className="input mono"
          placeholder="0x… the token’s address"
          value={token}
          onChange={(e) => setToken(e.target.value.trim())}
          style={{ flex: '1 1 320px' }}
          aria-label="Token address"
        />
        <select className="select" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: '0 1 260px' }} aria-label="Currency code">
          <option value="">Listed as…</option>
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => pad.run(`List ${code}`, (a, o) => pad.backend.listCurrency!(a, token as Address, code, parseUnits(Number(rate).toFixed(18), 18), o))}
        >
          {code && rate ? `List as ${code} at ${Number(rate) < 0.01 ? Number(rate).toPrecision(4) : Number(rate)} per USD` : 'List the token'}
        </button>
      </div>
    </div>
  );
}

export default function Desk() {
  const pad = usePad();
  const snap = pad.snap;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const openCode = params.get('code');

  const stats = useMemo(() => {
    const m = new Map<string, { coins: number; pooled: bigint }>();
    for (const c of snap?.coins ?? []) {
      const k = c.currency.toLowerCase();
      const e = m.get(k) ?? { coins: 0, pooled: 0n };
      e.coins++;
      // what the coins' Uniswap pools hold of it
      e.pooled += c.realQuote;
      m.set(k, e);
    }
    return m;
  }, [snap]);

  const lastMove = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of snap?.rateMoves ?? []) m.set(r.token.toLowerCase(), Number(r.newRate - r.oldRate));
    return m;
  }, [snap]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (snap?.currencies ?? []).filter((c) => {
      if (tab === 'fiat' && c.kind !== 'fiat') return false;
      if (tab === 'other' && c.kind === 'fiat') return false;
      if (region && c.region !== region) return false;
      return !needle || `${c.code} ${c.name} ${c.region}`.toLowerCase().includes(needle);
    });
  }, [snap, tab, q, region]);

  const open = openCode ? snap?.currencies.find((c) => c.code === openCode) : undefined;
  const setOpen = (code?: string) => {
    const next = new URLSearchParams(params);
    if (code) next.set('code', code);
    else next.delete('code');
    setParams(next, { replace: true });
  };

  return (
    <div className="wrap">
      <PageHead
        kicker="Denominations"
        title="The currency desk"
        lead={`${snap?.currencies.length ?? 149} currencies a coin can be paired with, each with its USD rate, how many coins live in it and how much of it sits in their pools. Tap one to convert, or to top up test money from the faucet.`}
      />

      <div className="toolbar" data-solid>
        <div className="chips">
          {(['all', 'fiat', 'other'] as Tab[]).map((t) => (
            <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'all' ? 'All' : t === 'fiat' ? 'Currencies' : 'Metals & crypto'}
            </button>
          ))}
        </div>
        <div className="search">
          <Search />
          <input className="input" placeholder="Find a currency" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="">Every region</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="kicker">{list.length} denominations</span>
        <KeeperLine />
      </div>

      <ListTokenPanel />

      <div className="desk-grid">
        {list.map((c) => {
          const s = stats.get(c.token.toLowerCase());
          const mv = lastMove.get(c.token.toLowerCase());
          return (
            <button key={c.token} className="card desk-card" onClick={() => setOpen(c.code)} style={{ '--c': c.color } as React.CSSProperties}>
              <CurrencyDot c={c} size={34} />
              <div style={{ minWidth: 0 }}>
                <b>{c.code}</b>
                <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                </div>
                <div className="small num">
                  {c.code === 'USD' ? 'reference' : `1 USD = ${compact(unitsPerUsd(c), 4)}`}{' '}
                  {mv !== undefined && mv !== 0 && <span className={mv > 0 ? 'move-down' : 'move-up'}>{mv > 0 ? '▼' : '▲'}</span>}
                </div>
                <div className="muted small">{s ? `${s.coins} coin${s.coins > 1 ? 's' : ''} · in pools ${money(amount(s.pooled, c.decimals), c.symbol)}` : 'no coins yet'}</div>
              </div>
            </button>
          );
        })}
      </div>
      {open && <DeskModal cur={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
