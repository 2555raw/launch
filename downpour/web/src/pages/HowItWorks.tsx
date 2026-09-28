import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { PageHead, PairBadge } from '../components/bits';
import { CurveChart } from '../components/sections';
import { Arrow } from '../components/icons';
import { money, usd } from '../lib/format';
import { amount, unitsPerUsd } from '../lib/views';
import { applyBuy, fromUsd, marketCap, newMarket, priceOf, quoteBuy, startQuoteFor, WAD } from '../lib/math';

export default function HowItWorks() {
  const pad = usePad();
  const snap = pad.snap;
  const p = snap?.params;
  const eur = snap?.currencies.find((c) => c.code === 'EUR') ?? snap?.currencies.find((c) => c.code === 'USD');
  const ex =
    eur && p
      ? (() => {
          const m = newMarket(startQuoteFor(eur, p.startMcapUsd), 0);
          const after = applyBuy(m, quoteBuy(m, fromUsd(eur, 1_000n * WAD), p));
          return {
            code: eur.code,
            sym: eur.symbol,
            start: priceOf(m, eur.decimals),
            startMcap: amount(m.startQuote, eur.decimals),
            after: marketCap(after, eur.decimals),
            perUsd: unitsPerUsd(eur),
          };
        })()
      : null;
  const fee = p ? p.poolFeePips / 10_000 : 1;

  return (
    <div className="wrap">
      <PageHead
        kicker="Inside the engine"
        title="How it works"
        lead="Seven parts, every one of them enforced by the contracts. Nothing on this page is a promise that lives only on a website."
      />

      <div className="part">
        <div>
          <div className="kicker">Part 01</div>
          <h2>One coin, one currency</h2>
          <p>
            At launch the creator picks a currency from the desk. That token becomes the other side of the coin's pool: buyers pay in it, sellers
            are paid in it, the price is quoted in it and fees are collected in it.
          </p>
          <p>The pad stores the currency inside the market when the coin is created. There is no function anywhere that changes it later.</p>
        </div>
        <div className="panel">
          <div style={{ marginBottom: 14 }}>
            <PairBadge coin={{ symbol: 'PULSAR' }} currency={eur ?? { code: 'EUR', color: '#5b8cff', name: 'Euro' }} size="lg" />
          </div>
          <div className="kv">
            <span>Chosen</span>
            <span>once, at launch</span>
          </div>
          <div className="kv">
            <span>Can it change?</span>
            <span>no, there is no setter</span>
          </div>
          <div className="kv">
            <span>Price quoted in</span>
            <span>the paired currency</span>
          </div>
          <div className="kv">
            <span>Fees collected in</span>
            <span>the paired currency</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 02</div>
          <h2>Opening a market: a Uniswap pool from the first second</h2>
          <p>
            Every coin has exactly one billion units, minted to the pad and put, in the same transaction, into the coin's Uniswap V3 pool with its
            currency: one position from the launch price up to the top of the price scale, so every coin not in a wallet is always for sale there.
          </p>
          <p>
            That is why a coin shows up on DEX screens and trading terminals the moment it launches, with its liquidity and its picture: to them it
            is an ordinary Uniswap pool, and the coin serves its name, description and picture itself (ERC-7572 <span className="mono">contractURI</span>).
            The creator can buy in the same transaction as the launch, before anyone else.
          </p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Supply</span>
            <span>1,000,000,000, all in the pool</span>
          </div>
          <div className="kv">
            <span>Pool</span>
            <span>Uniswap V3, {fee}% fee tier</span>
          </div>
          <div className="kv">
            <span>Position</span>
            <span>launch price → top of the scale</span>
          </div>
          <div className="kv">
            <span>Starts at</span>
            <span>{p ? usd(Number(p.startMcapUsd) / 1e18) : '…'} market cap, in any currency</span>
          </div>
          <div className="kv">
            <span>Metadata</span>
            <span>in the coin itself</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 03</div>
          <h2>The curve</h2>
          <p>
            Inside that position the pool prices along <span className="mono">x · y = k</span>: coins on one side, currency on the other. The first
            coin is cheap but never free, every buy moves the price up and every sell moves it down, so a launch is a bonding curve that happens to
            be a Uniswap pool.
          </p>
          <p>
            The launch price is set from the desk's rate so the whole supply is worth the same in dollars in every currency
            {p ? ` (${usd(Number(p.startMcapUsd) / 1e18)})` : ''}. A coin in yen and a coin in euros start on equal footing.
          </p>
          {ex && (
            <p className="small muted">
              Example in {ex.code}: first coin at {money(ex.start, ex.sym)}, the supply worth {money(ex.startMcap, ex.sym)}; a {usd(1000)} buy takes the
              market cap to {money(ex.after, ex.sym)} ({usd(ex.after / ex.perUsd)}).
            </p>
          )}
        </div>
        <div className="panel">
          <CurveChart sold={0.42} />
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 04</div>
          <h2>Liquidity that cannot leave</h2>
          <p>
            The pool's position belongs to the pad, and the pad has no function that moves, decreases or burns it. The only thing it can do with the
            position is collect its fees. There is no team wallet holding LP tokens, no unlock date and no admin key over the pool.
          </p>
          <p>
            Because the pool only ever moves along <span className="mono">x · y = k</span>, selling every coin in wallets back returns it to where it
            started: what came in can go out, and a run on one currency cannot reach another.{' '}
            <Link to="/proof" className="accent-text">
              The Proof page
            </Link>{' '}
            recomputes this for every pool while you watch, and asks the chain who owns each position.
          </p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Position owner</span>
            <span>the pad, forever</span>
          </div>
          <div className="kv">
            <span>Withdraw, burn, move</span>
            <span>no such function</span>
          </div>
          <div className="kv">
            <span>If every holder sold at once</span>
            <span>the pool pays it all</span>
          </div>
          <div className="kv">
            <span>Held per coin</span>
            <span>its own pool, in its own currency</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 05</div>
          <h2>Fees</h2>
          <p>
            Each trade pays the pool's {fee}% fee, wherever it is made: on the pad, on Uniswap, through a terminal. The fee accrues to the pad's
            position, and anyone can have it paid out at any time: half goes to the coin's creator and half to the protocol, in the coin and in its
            currency, exactly as the pool earned it.
          </p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Trade fee</span>
            <span>{fee}%, the pool's</span>
          </div>
          <div className="kv">
            <span>To the creator</span>
            <span>{fee / 2}%</span>
          </div>
          <div className="kv">
            <span>To the protocol</span>
            <span>{fee / 2}%</span>
          </div>
          <div className="kv">
            <span>Paid out by</span>
            <span>anyone, from the Portfolio</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 06</div>
          <h2>Trading, here or anywhere</h2>
          <p>
            The pad buys and sells in the pool for you and quotes it as a curve: what you see on a coin page is the pool's own price. Anyone can trade
            the same pool from Uniswap, an aggregator or a terminal, and the site reads those fills into the coin's chart and list, wherever they
            came from.
          </p>
          <p>
            Swap takes anything for anything: a currency into a coin priced in another one, or a coin into a coin, converting in between through the
            desk or, between the real tokens on the chain, through Uniswap's own pools.
          </p>
          <Link to="/swap" className="link">
            Open Swap <Arrow />
          </Link>
        </div>
        <div className="panel">
          <div className="kv">
            <span>On the pad</span>
            <span>buy, sell, swap across currencies</span>
          </div>
          <div className="kv">
            <span>Elsewhere</span>
            <span>the same Uniswap pool</span>
          </div>
          <div className="kv">
            <span>Fills shown</span>
            <span>from everywhere</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 07</div>
          <h2>The desk and its keeper</h2>
          <p>
            The desk lists every currency with a rate against the dollar. It sets the launch price of a coin in its currency, and converts between
            currencies at those rates for a {((p?.deskFeeBps ?? 10) / 100).toFixed(2)}% fee wherever it holds them, which is how Swap can take yen in and
            deliver a coin priced in euros.
          </p>
          <p>
            A keeper reads two independent FX feeds and posts a new rate only when they agree. On chain, a single post cannot move a rate more than
            20%, so even a broken keeper cannot drag it far.
          </p>
          <Link to="/desk" className="link">
            Open the desk <Arrow />
          </Link>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Rate format</span>
            <span>units per 1 USD</span>
          </div>
          <div className="kv">
            <span>Feeds</span>
            <span>two, and they must agree</span>
          </div>
          <div className="kv">
            <span>Biggest move per post</span>
            <span>20%</span>
          </div>
          <div className="kv">
            <span>Conversion fee</span>
            <span>{((p?.deskFeeBps ?? 10) / 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
