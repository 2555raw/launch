# Clematis

A swap page for tokenized stocks on **Robinhood Chain** (chain ID 4663). Pick a
stock, see a live quote, sign in your own wallet, and the trade settles through
Uniswap v3 and v4 in one transaction.

The look is a night-blue trading interface: a fine market grid on deep navy,
a live price tape under the hero, a sidebar with wallet and network status on
wide screens, and the stock list split into four sectors.

## What is real

- **Tokens.** Every stock in the list is one of Robinhood's own stock tokens on
  Robinhood Chain, found on-chain (see *Token list* below). Nothing is mocked.
- **Prices.** Read from each token's deepest pool (`slot0` for v3,
  `StateView.getSlot0` for v4) on page load and every 30 s, batched through
  Multicall3. ETH/USD is the USDG price.
- **Quotes.** Uniswap's QuoterV2 (v3) and V4Quoter simulate the exact trade
  against the deepest pools, direct and through ETH or USDG, and the best output
  wins. Quotes refresh every 20 s and again right before signing.
- **Swaps.** One `execute(commands, inputs, deadline)` call to Uniswap's
  Universal Router (v2.1.2), built from the quote:
  - ETH in is sent as `msg.value`; v3 hops get it wrapped (`WRAP_ETH`), v4
    hops settle it natively.
  - Between hops the funds stay in the router (`ADDRESS_THIS` /
    `CONTRACT_BALANCE` / `OPEN_DELTA`), wrapped or unwrapped as the next pool
    needs.
  - The last hop enforces the minimum output (`amountOutMin` on v3, `TAKE_ALL`
    on v4); ETH out is unwrapped straight to the user.
  - Selling a token goes through Permit2: an approval for exactly the amount,
    then a signed `PERMIT2_PERMIT` for exactly that amount, valid 30 minutes.
  - Every swap is dry-run with `eth_call` before it reaches the wallet, so a
    swap that would revert is caught with a message instead of costing gas.
  - Slippage defaults to 0.5 %; deadline is 20 minutes.
- **Wallets.** Any EIP-6963 browser wallet (MetaMask, Rabby, Coinbase Wallet,
  Brave, …), falling back to `window.ethereum`. The page asks the wallet to add
  and switch to Robinhood Chain if it isn't there yet.

There is no backend in the money path: the server only serves files. There is
no platform fee either; the user pays the pool fee and gas.

Which pools are trusted:

- v4 pools **without hooks** only. A hook can change what a swap does at
  execution time, so a pool with one isn't trusted to match its quote.
- Fees of **1% or less**. Some pools are created with 50-95% fees as a trap.
- Pools that survive a **round-trip test trade**: buy about $25 of the token
  and sell it straight back through the quoter; more than 10% lost means the
  pool is too thin to price anything, and it's dropped.
- Stocks **deployed by Robinhood**: the proxy must have been created by
  Robinhood's deployer through its stock factory. Anyone can put a proxy on a
  public beacon and call it "Apple".

### Contracts (Uniswap's deployments for chain 4663)

| | |
|---|---|
| Universal Router 2.1.2 | `0x204FAca1764B154221e35c0d20aBb3c525710498` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| QuoterV2 (v3) | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| V4Quoter | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` |
| v4 StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| v4 PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| v3 factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Addresses come from `@uniswap/sdk-core` and `@uniswap/universal-router-sdk`.
The 2.1.x router expects `minHopPriceX36` in both the v3 swap input and the v4
swap struct; Clematis passes an empty/zero value and relies on the final minimum.

## Market data and pages

- **24h stats** come from `market-stats.js`, which runs inside `server.js`. Every
  10 minutes it reads the last day of Swap events from each listed pool and
  serves `/api/stats`: an hourly USD price line per stock (from its most-traded
  pool), the 24h change, high, low, trade count, and volume in USD across all
  its pools. ETH/USD comes from the USDG/WETH pools. The first build takes a few
  minutes after boot; until then the page shows "—" in those columns. On a host
  without the Node server the page simply goes without them.
- **Markets**: top gainers, losers and most traded; four sector tabs plus a
  watchlist (starred stocks, kept in the browser); each row has price, 24h
  change, volume and a sparkline. Tapping a stock opens its detail: 24h chart,
  high/low/volume/trades, deepest pool, your balance, contract address, Buy and
  Sell.
- **Portfolio**: what the connected wallet holds, valued at pool prices, with
  each position's share and 24h change, plus the swaps made from this browser.
- **You receive**: typing an amount there asks the quoters for the input that
  buys it (exact-output quotes), fills in "You pay", and the swap still runs as
  exact input.
- **WalletConnect**: set `WALLETCONNECT_PROJECT_ID` at the top of `app.js` (a
  free project at cloud.reown.com) and phone wallets can connect by QR code.
  The bundle (`vendor/walletconnect.min.js`, see its NOTICE) only loads when
  someone picks it. Without an ID, a phone with no wallet gets links to open the
  page inside MetaMask, Coinbase Wallet or Trust Wallet instead.
- **Sharing**: `og.png` is the link preview, `favicon.svg` the tab icon.

## Token list

`tokens.js` is generated:

```sh
npm run tokens      # node scripts/build-tokens.js
```

Robinhood's stock tokens are beacon proxies behind a single beacon, and every
one emitted `BeaconUpgraded(beacon)` when it was created. The script reads the
beacon from AAPL's proxy and collects every emitter of that event. Then, for
each stock (and USDG):

- v3: asks the factory for its pool against WETH and USDG at 0.01 / 0.05 /
  0.3 / 1 %;
- v4: reads the PoolManager's `Initialize` events for pools against native ETH
  and USDG, and drops any with a hook;

and keeps the pools with liquidity in range that pass the filters above. The
public RPC caps log queries,
so the scans are chunked and cached in `scripts/chain-cache.json`; a rerun only
reads new blocks. Run it when new stocks or pools appear.

Logos live in `logos/<TICKER>.png` (128×128). A stock without one gets a
lettered placeholder.

## Run it

```sh
npm start           # http://localhost:8080
```

Node 18+, no dependencies. `ethers` v6 is vendored in `vendor/`.

It runs on Railway: a service with root directory `clematis-site`, started
with `npm start`, listening on `PORT`. Any static host works the same way.

## Change the name

The brand name appears in `index.html` (title, header, footer, copy),
and `BRAND` at the top of `app.js`.

## Credits

Company logos are trademarks of their owners. ethers.js is MIT
(`vendor/ethers-LICENSE.md`).

Tokenized stocks track the price of the underlying security and are issued by
third parties. Holding one is not holding the share. Not investment advice.
