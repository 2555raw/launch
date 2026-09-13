# Beyga — launch copy

Everything here is written to the same rule the site is: nothing claims more
than exists. There is no mainnet contract, no token and no audit, and every
figure below is constant-product arithmetic on the stated reserves rather than
a projection. Say it that way or the first reply will say it for you.

---

## Tweets

All three are inside 280 characters as written — the counts are in the headings,
so a rewrite that goes long is obvious before it is posted.

### 1 — the opener, to post with the film (280 characters)

> A 4:1 split divides the fair price of a tokenized share by four overnight.
>
> Nobody trades, so nothing tells the pool. The curve keeps quoting yesterday until someone takes the other side.
>
> On a $1m pool that is $250,000, to whoever gets there first.
>
> Beyga is the hook that looks.

### 2 — the mechanism, standalone or as a reply to the first (268 characters)

> Most MEV is a race. This one is a calendar entry.
>
> Splits are scheduled weeks out, so the loss is a lookup, not a prediction. Beyga moves the curve to the post-action price inside beforeSwap and auctions the rest. The winning bid lands in the pool.
>
> Testnet. No token.

### 3 — spare, if one of the first two underperforms (253 characters)

> $250,000 out of a $1,000,000 pool, in one block, on a day nobody was watching.
>
> Not an exploit. The constant product holds the whole way. The pool just paid twice what the asset was worth, because a stock split is not a trade and nothing told the curve.

---

## Article

**Who pays for a stock split**

*A tokenized share inherits every corporate action of the asset underneath it.
The pool holding that share does not. The gap between those two facts has a
price, and right now the liquidity providers are the ones paying it.*

Splits, dividends, rebases and redenominations all do the same thing: they
change the price of an asset at a known moment, by a known factor, without
anyone trading. Traditional markets handle this with a record date and an
adjustment. Automated market makers handle it by not noticing.

A constant product pool is not a holder. It is a curve with two reserves and
one invariant, and it has no idea that the token it quotes was worth four times
as much an hour ago. When a 4:1 split lands, the fair price of the asset divides
by four. The pool keeps quoting the old number until somebody trades against it,
and the person who trades against it first collects the entire difference.

That is not a bug in anyone's code. It is the mechanism working exactly as
designed, on a price that is now wrong.

### What it costs

Take a pool with 10,000 tokens and $1,000,000 of stablecoin against them. The
quote is $100. The asset splits 4:1 overnight, so the fair price opens at $25
while the curve still says $100.

A searcher sells 10,000 tokens into the pool and walks out with $500,000. Those
tokens cost $250,000 at the true price. The constant product holds the whole
way: reserves settle at 20,000 tokens against $500,000, exactly where the curve
prices the asset at $25. Nothing was exploited. The pool simply paid twice what
the asset was worth, to the first person in the block.

|                      | Before      | Unguarded    | With the hook |
| -------------------- | ----------- | ------------ | ------------- |
| Token reserves       | 10,000      | 20,000       | 40,000        |
| Stablecoin reserves  | $1,000,000  | $500,000     | $1,000,000    |
| Quoted price         | $100.00     | $25.00       | $25.00        |
| Repriced by          | —           | The first trade | The hook, at the event |
| To the pool          | —           | $0           | $237,500      |

Three things about that table are worth saying plainly. It is arithmetic, not a
projection — you can walk it yourself from the reserves. The $237,500 is 95% of
the recovered value, with 5% to the protocol. And none of it has happened on
mainnet, because there is no mainnet contract.

### Why nobody catches it

The information is public and free. A record date is published weeks out, lands
on a Tuesday morning, and the curve has no idea any of it happened. Catching it
requires something to read that calendar at the right second and act on it
before the pool settles the next swap.

People do that for about three weeks. Then the pool goes quiet for a month, and
the day it matters is the day nobody is watching.

The cost is also not gradual, which is what makes it easy to under-rate. A
dividend moves the quote by a few basis points and barely registers. A four for
one split divides the fair price by four in a single step. Same mechanism, four
orders of magnitude apart.

### What the hook does

Beyga runs inside the Uniswap v4 lifecycle, in the few thousand gas between a
swap arriving and the pool settling it. Three calls:

**Read the calendar.** The hook asks an attested feed whether this pool has an
action pending. Splits and dividends are scheduled, so this is a lookup rather
than a prediction — which is the whole reason the problem is tractable.

**Move the curve first.** At the event the pool goes to the post-action price in
one atomic step, so the first swap of the block meets a fair market instead of a
stale one. That removes the free option rather than racing anyone for it.

**Sell what is left.** Whatever gap survives goes to a sealed auction. Somebody
still takes the trade — the opportunity does not vanish — but the winning bid
lands in the pool instead of in their wallet. The value ends up with the capital
that created it.

It is worth being precise about what is broken here, because two different
holes get confused. The first is entitlement: when the split is distributed, the
pool has to actually receive its share, the same way any other holder does. The
second is the quote: even a pool that receives everything it is owed will still
price the asset wrong until the curve is moved. Beyga is built around the second
problem, and it rides on the same attested feed that has to solve the first.

### Auctioned, not raced

A race pays whoever bids most for block position. An auction pays whoever values
the trade most, and pays it to the pool. That is the entire difference, and it
is why the design is an auction: the gap a repricing event opens is going to be
taken by someone either way, so the only real question is where the money lands.

Alongside it the fee is a function rather than a constant. The controller reads
realised volatility from the pool itself and raises the fee while the market is
moving, which is exactly when uninformed liquidity gets picked off. When
variance drops, so does the fee, so routers keep choosing the pool.

### The state of it

No token sale. No TVL to quote. No audit yet, because there is no mainnet
contract to audit. The hook runs on Base Sepolia, chain 84532, and the only real
transaction the interface can send is an ETH to WETH wrap on that testnet. Every
other quote on the app screen is simulated and labelled as such.

When there is something to audit, external review happens before a single unit
of mainnet liquidity is accepted, and the report goes up next to the docs. It is
a gate, not a badge.

When a token exists, its address will appear in the registry on the site and
nowhere else first. Until that box shows one, any contract claiming to be Beyga
is not ours.

If you provide liquidity to a pool holding a tokenized equity, this is meant to
run underneath and be forgotten. On the handful of days a year when an action
lands, it charges the arbitrageur instead of you. On every other day it should
cost you nothing and say nothing.

---

*Nothing here is investment advice or an offer of any token. Figures are worked
from constant product math on the stated reserves and are illustrative, not
performance claims.*
