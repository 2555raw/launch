import { Link } from 'react-router-dom';
import { usePad } from '../backend/PadProvider';
import { PageHead, PairBadge } from '../components/bits';
import { CurveChart } from '../components/sections';
import { Arrow } from '../components/icons';
import { money, usd } from '../lib/format';
import { amount, unitsPerUsd } from '../lib/views';
import { curveRaise, graduationPrice, newMarket, priceOf, virtualQuoteFor } from '../lib/math';

export default function HowItWorks() {
  const pad = usePad();
  const snap = pad.snap;
  const p = snap?.params;
  const eur = snap?.currencies.find((c) => c.code === 'EUR');
  const ex = eur && p ? (() => {
    const vq = virtualQuoteFor(eur, p.targetRaiseUsd);
    return {
      start: priceOf(newMarket(vq, 0), eur.decimals),
      end: graduationPrice(vq),
      raise: amount(curveRaise(vq), eur.decimals),
      perUsd: unitsPerUsd(eur),
    };
  })() : null;
  const fee = p ? (p.protocolFeeBps + p.creatorFeeBps) / 100 : 1;
  const window = p?.snipeWindow ?? 15;
  const steps = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(f * window));

  return (
    <div className="wrap">
      <PageHead
        kicker="Inside the engine"
        title="How it works"
        lead="Six parts, every one of them enforced by the contracts. Nothing on this page is a promise that lives only on a website."
      />

      <div className="part">
        <div>
          <div className="kicker">Part 01</div>
          <h2>One coin, one currency</h2>
          <p>
            At launch the creator picks a currency from the desk. That token becomes the other side of the coin's market: buyers pay in it, sellers
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
          <h2>Opening a market</h2>
          <p>
            Every coin has exactly one billion units, all minted to the pad. 800 million are for sale on the curve; 200 million stay inside the pad
            until graduation, when they seed the pool.
          </p>
          <p>
            The creator can buy in the same transaction as the launch, before anyone else, with no snipe tax. For everyone else the first {window}{' '}
            seconds carry an extra tax on buys that shrinks to zero, so bots that pounce in the first block pay for it. That tax goes to the
            protocol.
          </p>
        </div>
        <div className="panel">
          <div className="kicker" style={{ marginBottom: 8 }}>
            Snipe tax after launch
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Since launch</th>
                <th className="r">Snipe tax</th>
                <th className="r">Total on a buy</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => {
                const tax = p ? Math.floor((p.snipeTaxBps * Math.max(0, window - s)) / window) / 100 : 0;
                return (
                  <tr key={s}>
                    <td className="num">{s}s</td>
                    <td className="r num">{tax.toFixed(1)}%</td>
                    <td className="r num">{(tax + fee).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 03</div>
          <h2>The curve</h2>
          <p>
            Price follows <span className="mono">x · y = k</span> over two reserves: coins on one side, currency on the other. The currency side
            starts with a virtual amount, so the first coin is cheap but never free, and every buy moves the price up the curve.
          </p>
          <p>
            The virtual amount is set at launch from the desk's rate so that a full curve raises the same dollar amount in every currency
            {p ? ` (${usd(Number(p.targetRaiseUsd) / 1e18)})` : ''}. A coin in yen and a coin in euros are equally hard to graduate.
          </p>
          {ex && (
            <p className="small muted">
              Example in euros: first coin at {money(ex.start, '€')}, last coin at {money(ex.end, '€')}, a full curve takes in{' '}
              {money(ex.raise, '€')} ({usd(ex.raise / ex.perUsd)}).
            </p>
          )}
        </div>
        <div className="panel">
          <CurveChart sold={0.62} />
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 04</div>
          <h2>Backing, and why a sell always clears</h2>
          <p>
            Everything buyers pay (minus fees) stays in the coin's market as its backing, kept per coin and per currency. Because the curve only
            ever moves along <span className="mono">x · y = k</span>, selling back every coin in circulation returns the market to where it started:
            the backing always covers it, with rounding dust to spare.
          </p>
          <p>
            A run on one currency cannot reach another: a sale is paid from that coin's own backing, in that coin's own currency.{' '}
            <Link to="/proof" className="accent-text">
              The Proof page
            </Link>{' '}
            recomputes this for every market while you watch.
          </p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Held per coin</span>
            <span>its own backing, in its own currency</span>
          </div>
          <div className="kv">
            <span>If every holder sold at once</span>
            <span>backing ≥ payout</span>
          </div>
          <div className="kv">
            <span>Fees</span>
            <span>held apart from the backing</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 05</div>
          <h2>Fees</h2>
          <p>
            Each trade pays {fee}%: half to the coin's creator, half to the protocol, both in the coin's own currency. Fees build up inside the pad
            and whoever earned them claims them from their Portfolio whenever they like.
          </p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Trade fee</span>
            <span>{fee}%</span>
          </div>
          <div className="kv">
            <span>To the creator</span>
            <span>{fee / 2}%</span>
          </div>
          <div className="kv">
            <span>To the protocol</span>
            <span>{fee / 2}% + any snipe tax</span>
          </div>
          <div className="kv">
            <span>Paid in</span>
            <span>the coin's currency</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 06</div>
          <h2>Graduation</h2>
          <p>
            When the last of the 800 million curve coins sells, the market graduates. Its backing and the 200 million coins held back become a
            constant-product pool. The curve's size was chosen so that the pool's first price is exactly the curve's last price: nobody gets a jump
            either way.
          </p>
          <p>There are no LP tokens and no owner of the pool. Its liquidity can never be withdrawn, so trading just continues, with real slippage.</p>
        </div>
        <div className="panel">
          <div className="kv">
            <span>Before</span>
            <span>curve, virtual + real reserves</span>
          </div>
          <div className="kv">
            <span>After</span>
            <span>pool, real reserves only</span>
          </div>
          <div className="kv">
            <span>Price at the switch</span>
            <span>unchanged</span>
          </div>
          <div className="kv">
            <span>Who can remove liquidity</span>
            <span>nobody</span>
          </div>
        </div>
      </div>

      <div className="part">
        <div>
          <div className="kicker">Part 07</div>
          <h2>The desk and its keeper</h2>
          <p>
            The desk lists every currency with a rate against the dollar. It converts between currencies at those rates for a {((p?.deskFeeBps ?? 10) / 100).toFixed(2)}%
            fee, which is how Swap can take yen in and deliver a coin priced in euros.
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
