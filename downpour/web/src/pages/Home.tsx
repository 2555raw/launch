import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { useStorm } from '../storm/Storm';
import { CoinCard, CoinCardSkeleton } from '../components/CoinCard';
import { CurrencyDot } from '../components/bits';
import { CORE_FAQ, CurveChart, Faq, KeeperLine, RecentFills } from '../components/sections';
import { Arrow, Sparkle } from '../components/icons';
import { CURRENCY_BY_CODE, HERO_WORDS, POPULAR } from '../data/currencies';
import { sortRows, totalVolumeUsd, unitsPerUsd, useRows } from '../lib/views';
import { compact, money, usd } from '../lib/format';
import { fromUsd, quoteBuy, newMarket, virtualQuoteFor, graduationPrice, WAD } from '../lib/math';

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % HERO_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  const [word, code] = HERO_WORDS[i];
  const c = CURRENCY_BY_CODE[code];
  return (
    <span className="hero-word" key={word}>
      {word}
      <span className="hero-word-sym" aria-hidden="true">
        {c?.symbol}
      </span>
    </span>
  );
}

function StormControls() {
  const storm = useStorm();
  return (
    <div className="hero-controls" data-solid>
      <div className="row small">
        <button className="link muted" onClick={storm.toggle}>
          {storm.running ? 'Pause the sky' : 'Let it shine'}
        </button>
        <span className="muted">/</span>
        <button className="link muted" onClick={() => storm.setIntensity(storm.intensity === 'storm' ? 'drizzle' : 'storm')}>
          {storm.intensity === 'storm' ? 'Calm sky' : 'Meteor shower'}
        </button>
      </div>
      <div className="small muted hero-hint">
        <Sparkle size={12} /> Tap a star to make it burst.
      </div>
      <a href="#coins" className="kicker hero-scroll">
        Scroll <Arrow dir="down" size={12} />
      </a>
    </div>
  );
}

/** "If I put this much into a brand-new coin...": the curve in one card. */
function StarCalculator() {
  const pad = usePad();
  const [code, setCode] = useState('EUR');
  const [spendUsd, setSpendUsd] = useState(100);
  const cur = pad.snap?.currencies.find((c) => c.code === code);
  const out = useMemo(() => {
    if (!cur || !pad.snap) return null;
    const p = pad.snap.params;
    const vq = virtualQuoteFor(cur, p.targetRaiseUsd);
    const m = newMarket(vq, 0);
    const spend = fromUsd(cur, BigInt(Math.round(spendUsd * 100)) * (WAD / 100n));
    const q = quoteBuy(m, spend, p, 1e9, false);
    const tokens = Number(q.tokensOut) / 1e18;
    const endPrice = graduationPrice(vq) / 10 ** (cur.decimals - 18);
    return { spend: Number(spend) / 10 ** cur.decimals, tokens, atGrad: tokens * endPrice, perUsd: unitsPerUsd(cur) };
  }, [cur, spendUsd, pad.snap]);
  return (
    <div className="panel calc">
      <div className="row-between">
        <div className="kicker">A quick what-if</div>
        <select className="select calc-select" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Currency">
          {POPULAR.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <h3 className="calc-title">
        Be first into a new coin with {usd(spendUsd)} of {code}.
      </h3>
      <input className="range" type="range" min={10} max={1000} step={10} value={spendUsd} onChange={(e) => setSpendUsd(Number(e.target.value))} aria-label="Amount in USD" />
      {out && cur && (
        <div className="calc-out">
          <div className="kv">
            <span>You pay</span>
            <span>{money(out.spend, cur.symbol, { compact: false })}</span>
          </div>
          <div className="kv">
            <span>You get</span>
            <span>{compact(out.tokens)} coins</span>
          </div>
          <div className="kv">
            <span>Worth at graduation</span>
            <span className="up">
              {money(out.atGrad, cur.symbol)} · {usd(out.atGrad / out.perUsd)}
            </span>
          </div>
          <p className="hint" style={{ margin: '8px 0 0' }}>
            Only if the whole curve fills after you. Most curves never do.
          </p>
        </div>
      )}
    </div>
  );
}

export function Home() {
  const pad = usePad();
  const rows = useRows();
  const storm = useStorm();
  const now = pad.now();
  const featured = useMemo(() => sortRows(rows, 'active').slice(0, 6), [rows]);
  const snap = pad.snap;

  // Stars gather around the headline while the hero is on screen, then move to the margins.
  const heroRef = useRef<HTMLElement>(null);
  const { setScene } = storm;
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScene(e.intersectionRatio > 0.35 ? 'hero' : 'content'), { threshold: [0, 0.35, 0.7, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      setScene('content');
    };
  }, [setScene]);

  // Light up the currencies people actually launched in, plus the popular ones.
  useEffect(() => {
    const codes = new Set(POPULAR);
    rows.forEach((r) => codes.add(r.cur.code));
    storm.setCurrencies([...codes]);
  }, [rows, storm]);

  const coinsPer = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.cur.code, (m.get(r.cur.code) ?? 0) + 1));
    return m;
  }, [rows]);

  const sampleSold = rows.length ? rows.reduce((a, r) => a + (r.coin.graduated ? 0 : r.progress), 0) / Math.max(1, rows.filter((r) => !r.coin.graduated).length) : 0.42;

  return (
    <>
      <section className="hero" data-sky ref={heroRef}>
        <div className="wrap hero-inner">
          <div className="kicker">Every star is a currency</div>
          <h1 className="hero-title">
            Mint a star
            <br />
            in any currency
          </h1>
          <p className="hero-sub">
            Launch a coin that trades in <RotatingWord />
          </p>
          <div className="hero-cta" data-solid>
            <Link to="/launch" className="btn btn-primary btn-lg">
              Launch a coin <Sparkle />
            </Link>
            <Link to="/board" className="link">
              Browse the board <Arrow dir="right" />
            </Link>
          </div>
        </div>
        <StormControls />
      </section>

      <section className="section intro" data-sky>
        <div className="wrap center">
          <div className="kicker">One coin, one currency</div>
          <p className="intro-line">
            A meme can come from anywhere.
            <br />
            <span className="accent-text">So can the money it trades in.</span>
          </p>
        </div>
      </section>

      <section className="section" id="coins">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">Shining right now</div>
              <h2 className="h-section">Pick a star</h2>
              <p className="lead">
                Every coin is paired with one of {snap?.currencies.length ?? 147} currencies, picked at launch and fixed for good. The badge on each card
                says which: <b>coin / currency</b>.
              </p>
            </div>
            <Link to="/launch" className="link">
              Launch your own <Arrow />
            </Link>
          </div>
          <div className="grid grid-3">
            {snap ? featured.map((r) => <CoinCard key={r.coin.address} row={r} now={now} />) : Array.from({ length: 6 }, (_, i) => <CoinCardSkeleton key={i} />)}
          </div>
          <div className="center" style={{ marginTop: 26 }}>
            <Link to="/board" className="btn">
              See every coin on the board <Arrow dir="right" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">Mission control</div>
              <h2 className="h-section">What the universe is doing</h2>
            </div>
            <Link to="/how-it-works" className="link">
              How the curve works <Arrow />
            </Link>
          </div>
          <div className="stats glass">
            <div className="stat">
              <span className="kicker">Coins trading</span>
              <b>{snap ? snap.coins.length : '—'}</b>
            </div>
            <div className="stat">
              <span className="kicker">Currencies</span>
              <b>{snap ? snap.currencies.length : '—'}</b>
            </div>
            <div className="stat">
              <span className="kicker">Volume, all time</span>
              <b>{snap ? usd(totalVolumeUsd(snap)) : '—'}</b>
            </div>
            <div className="stat">
              <span className="kicker">Trade fee</span>
              <b>{snap ? `${(snap.params.protocolFeeBps + snap.params.creatorFeeBps) / 100}%` : '—'}</b>
            </div>
            <div className="stat">
              <span className="kicker">Snipe window</span>
              <b>{snap ? `${snap.params.snipeWindow}s` : '—'}</b>
            </div>
          </div>
          <KeeperLine />
          <div className="grid report">
            <div>
              <div className="kicker" style={{ margin: '26px 0 10px' }}>
                Latest fills
              </div>
              <div className="panel fills-panel">
                <RecentFills trades={snap?.trades ?? []} limit={8} />
              </div>
            </div>
            <div className="panel curve-card">
              <div className="kicker">Curve first, pool after</div>
              <h3 className="card-title">Every buy lifts the price a little.</h3>
              <p className="muted small">
                A coin starts cheap and gets dearer as its 800 million curve coins sell. When the last one goes, the curve becomes a pool at the exact
                same price, and it keeps trading there.
              </p>
              <CurveChart sold={sampleSold} />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid grid-2 steps-wrap">
          <div>
            <div className="kicker">Three steps to a new star</div>
            <h2 className="h-section">
              Pick the money.
              <br />
              Name the coin.
            </h2>
            <ol className="steps">
              <li>
                <span className="step-n">01</span>
                <div>
                  <b>Choose a currency.</b>
                  <p className="muted small">Pesos for a taco coin, yen for a ramen coin, gold for a pirate coin. It is yours to pick, once.</p>
                </div>
              </li>
              <li>
                <span className="step-n">02</span>
                <div>
                  <b>Give it a name and a ticker.</b>
                  <p className="muted small">Add a picture and a line about it. One transaction and the market is open.</p>
                </div>
              </li>
              <li>
                <span className="step-n">03</span>
                <div>
                  <b>Watch it rise.</b>
                  <p className="muted small">People buy and sell in your currency. You earn half of every trade fee, paid in that same currency.</p>
                </div>
              </li>
            </ol>
          </div>
          <StarCalculator />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="kicker">The other half of the pair</div>
              <h2 className="h-section">Money people already count in</h2>
              <p className="lead">
                {snap?.currencies.length ?? 147} currencies, plus gold, silver, platinum, bitcoin and ether. Each keeps its own backing: a rush on one
                never touches another.
              </p>
            </div>
            <Link to="/desk" className="link">
              Open the currency desk <Arrow />
            </Link>
          </div>
          <div className="cur-grid">
            {POPULAR.slice(0, 15).map((code) => {
              const c = snap?.currencies.find((x) => x.code === code);
              const s = CURRENCY_BY_CODE[code];
              const n = coinsPer.get(code) ?? 0;
              return (
                <Link key={code} to={`/board?currency=${code}`} className="card cur-card">
                  <CurrencyDot c={{ code, color: c?.color ?? '#7cc4ff' }} size={34} />
                  <div>
                    <b>{code}</b>
                    <div className="muted small">{s.name}</div>
                    <div className="muted small num">
                      {n ? `${n} coin${n > 1 ? 's' : ''}` : 'no coins yet'}
                      {c && code !== 'USD' ? ` · 1 USD = ${compact(unitsPerUsd(c), 4)}` : ''}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="kicker">The fine print, in plain words</div>
          <h2 className="h-section">Four rules, all on chain</h2>
          <div className="grid grid-2 rules">
            <div className="rule">
              <span className="step-n">01</span>
              <div>
                <b>One currency, forever.</b>
                <p className="muted small">The pairing is written at launch and nothing can edit it. What you see on the badge is what the contract holds.</p>
              </div>
            </div>
            <div className="rule">
              <span className="step-n">02</span>
              <div>
                <b>The backing always covers a sell.</b>
                <p className="muted small">
                  Every coin's market holds the currency its buyers paid in. If everyone sold at once it could pay them all; the Proof page checks this live.
                </p>
              </div>
            </div>
            <div className="rule">
              <span className="step-n">03</span>
              <div>
                <b>Fees stay in the currency.</b>
                <p className="muted small">
                  {snap ? (snap.params.protocolFeeBps + snap.params.creatorFeeBps) / 100 : 1}% per trade, half to the coin's creator and half to the
                  protocol, paid in the coin's own currency. Nothing is swapped behind your back.
                </p>
              </div>
            </div>
            <div className="rule">
              <span className="step-n">04</span>
              <div>
                <b>A pool nobody can drain.</b>
                <p className="muted small">When the curve sells out, its backing and 200 million coins become a pool at the same price. No one holds the key to pull it.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
          <div className="kicker">Before you ask</div>
          <h2 className="h-section">Questions</h2>
          <Faq items={CORE_FAQ.slice(0, 3)} />
          <Link to="/faq" className="link" style={{ marginTop: 18 }}>
            Every question, answered <Arrow dir="right" />
          </Link>
        </div>
      </section>

      <section className="section final" data-sky>
        <div className="wrap center">
          <div className="kicker">The sky has room for one more</div>
          <h2 className="final-title">Your coin. Your currency. Your star.</h2>
          <Link to="/launch" className="btn btn-primary btn-lg" data-solid>
            Launch a coin <Sparkle />
          </Link>
        </div>
      </section>
    </>
  );
}
