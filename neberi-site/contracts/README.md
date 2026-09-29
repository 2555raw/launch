# Nebari contracts

Three contracts, no owner, no upgrade path.

| Contract | Job |
| --- | --- |
| `NebariFactory` | `launch()` creates a `NebariToken`, initialises its Uniswap v4 pool and deposits the whole supply as single-sided liquidity from the start price up. The factory owns the position and has no function to remove it. `collectFees()` pulls the swap fees and splits them: 50% to holders, a fixed protocol share to the treasury, the rest to the creator. Fees earned in the token itself are burned. |
| `NebariToken` | Fixed one billion supply, burnable, no mint. Dividend accounting in the pair asset: `claimable(holder)`, `claim()`. The PoolManager and the factory never earn. |
| `NebariRouter` | `swapExactIn()` straight against the PoolManager, and `quoteExactIn()` which simulates a swap and reverts with the answer (call it with `eth_call`). |

## Build and test

```bash
npm install
npm run compile     # solc-js -> build/*.json (ABI + bytecode)
npm test            # contracts, end to end on Hardhat's in-process EVM (53 checks)
npm run test:e2e    # the whole site in Chromium against a local chain (30 checks)
```

`npm test` runs the real Uniswap v4 PoolManager: it launches tokens against an ERC20 and
against native ETH, in both currency orderings, buys and sells through the router, checks
the price floor, collects fees, checks the split, claims and burns.

`npm run test:e2e` starts a local chain with Robinhood Chain's id (4663), deploys the
PoolManager, a 6-decimal USDG test token, the factory and the router, serves a copy of the
site pointed at them, and drives it in Chromium with a test wallet: launch against ETH and
against USDG, buy, sell (with the ERC20 approval), collect fees, claim, then the Explore,
Claim and home pages and the cookie gate. Ports 8545 and 8767 must be free. Set `CHROME`
if Chromium is not at the Playwright path.

## Deploy to Robinhood Chain

```bash
PRIVATE_KEY=0x… TREASURY=0x… PROTOCOL_BPS=1000 npm run deploy -- --write
```

`--write` pastes the factory and router addresses into `../config.js`. The script refuses
to run if the RPC is not chain 4663 or if there is no contract at the PoolManager address
in `config.js`. Verify that address against the Uniswap v4 deployments page first.

## Design notes

- Start price: `startPrice` is raw pair units per one whole token (1e18 base units). The
  factory turns it into a sqrt price, rounds to the pool's tick spacing (200, so at most
  2% off) and initialises the pool exactly on that tick, which becomes the floor.
- Single-sided liquidity: if the token is `currency0` the position is `[floorTick, maxTick]`;
  if it is `currency1` it is `[minTick, floorTick]`. Either way the pair side of the
  deposit is zero, and the contract reverts if the PoolManager asks for any.
- Fee collection: a zero-liquidity `modifyLiquidity` returns the fees accrued to the
  position; the factory `take`s them and distributes. Anyone can call it.
- Dividends: "magnified dividends per share" with transfer corrections, so tokens only
  earn the fees paid out while they were held. Balances in the PoolManager and the
  factory are excluded from the denominator and can never claim.
