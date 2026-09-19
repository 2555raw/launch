# We published the tests instead of the TVL

Every pre-launch DeFi site looks the same. A number at the top — total value
locked, eight figures, two decimal places — a row of logos, a countdown, and a
contract address with a green tick beside it.

Ours looked like that too, until we read our own page.

The tick said "Verified". The address under it was generated from a string. Not
fetched from a chain, not a deployment that had been paused — generated, in
JavaScript, from the word "vesica" and a ticker. Three of them were not even the
right length. An Ethereum address is twenty bytes; ours were twelve. Paste one
into a block explorer and it tells you the address is invalid.

Nobody had lied on purpose. The page was a design mock, the addresses were
filler, and the tick was a component. But a visitor cannot see intent. They see
a checkmark next to a hex string, and they conclude the thing has been deployed
and reviewed. That is the whole function of a checkmark.

So we took a different approach to the launch page.

## What the page says now

The contract table says **not deployed**, on every row, because nothing is
deployed. There is one file in the repository that holds the chain ID and the
addresses. While it is empty, every page says so. When it is filled in, the same
cells become links into Blockscout — and not before.

The address validator rejects anything that is not twenty hex bytes, and rejects
the zero address, so a half-finished config cannot put a broken link in front of
anyone.

Instead of a TVL figure, the site has a page showing the test output.

## Six claims, and the test that holds each

The contracts exist. They are an ERC-4626 vault, a Chainlink gate in front of
it, and a concentrated Uniswap V3 position behind it. 131 assertions run against
them on a real EVM — not a simulation of the pool, but Uniswap's own shipped
bytecode, deployed by Uniswap's own factory, because a mock of a pool only ever
proves that your strategy agrees with your idea of Uniswap.

The tests are named after the promises rather than the functions, so when one
fails it says which promise broke. Three of those promises are worth stating:

**Withdrawals are never pausable.** The guardian can stop deposits and stop
harvests. It cannot stop anyone leaving. A pause that traps depositors is
indistinguishable from a rug, so the ability to do it is not in the contract.

**A dead oracle stops money coming in, never money going out.** Exiting is
priced off the vault's own balance, not off a feed, so a stale feed cannot
become a lock.

**The oracle prices the position. The pool only executes.** This is the one that
matters. A pool's spot price is whatever the previous line of the same
transaction left behind, and a flash loan can leave behind anything. Vaults that
priced themselves off spot have been emptied more times than every other bug in
this category combined. In our test an attacker moves a real Uniswap pool by
8.6% and the vault's valuation does not shift by one wei — then the oracle
moves, and it does.

## What is not built

Nothing is deployed, on any network. Nothing has been audited. The vault and the
strategy are each tested on their own but are not yet wired to each other, and
that wiring is the path every withdrawal takes.

And the largest obstacle is not a contract problem at all. The tokenized
equities these vaults would hold are issued by regulated entities with transfer
restrictions. No amount of Solidity answers that question.

We also ran an adversarial pass over our own contracts and published what it
found — including three places where a comment claimed a property the code did
not hold. That pass is not an audit, and we say so on the page: the same hand
wrote the contracts and the tests. If we reasoned something wrong while writing
them, we will probably reason it the same way while reviewing them. An audit is
what catches what the author cannot see.

## Why any of this is worth saying

None of the above is a flex. A test suite is table stakes for a thing that
intends to hold other people's money, and most of this post is a list of what we
have not done.

But there is an asymmetry worth naming. Producing a screenshot of $78 million in
TVL takes about ten minutes and a design tool. Producing a test that proves your
valuation survives a flash loan takes a week and tells you something you did not
already believe. One of those is evidence and the other is a picture.

So: no TVL number, no countdown, no green ticks. The contracts, the tests that
hold them, and an honest list of what is missing.

The page is at **vesica.site/proof**. The list of what is missing is on it, at
the same size as the rest.
