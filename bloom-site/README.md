# Bloom

A swap page for tokenized stocks on **Robinhood Chain** (chain ID 4663). Pick a
stock, see a live quote, sign in your own wallet, and the trade settles through
Uniswap v3 in one transaction.

The look follows a night-blue interface over a real cosmos field in bloom.

## What is real

- **Tokens.** Every stock in the list is one of Robinhood's own stock tokens on
  Robinhood Chain, found on-chain (see *Token list* below). Nothing is mocked.
- **Prices.** Read from the pools' `slot0` on every page load and every 30 s,
  batched through Multicall3. ETH/USD comes from the USDG/WETH pool.
- **Quotes.** Uniswap's QuoterV2 simulates the exact trade against each fee
  tier (and, between two stocks, each route through WETH), and the best output
  wins.
- **Swaps.** Built for Uniswap's SwapRouter02 as a `multicall(deadline, …)`:
  - ETH → stock: `exactInput` with `msg.value`; the router wraps the ETH.
  - stock → ETH: `exactInput` into the router, then `unwrapWETH9` to the user.
  - stock → stock: two-hop `exactInput` through WETH.
  - A minimum output from the slippage setting (0.5 % by default) and a 20 min
    deadline guard every swap. Selling a stock first approves the router for
    exactly that amount, never an unlimited allowance.
- **Wallets.** Any EIP-6963 browser wallet (MetaMask, Rabby, Coinbase Wallet,
  Brave, …), falling back to `window.ethereum`. The page asks the wallet to add
  and switch to Robinhood Chain if it isn't there yet.

There is no backend in the money path: the server only serves files. There is
no platform fee either; the user pays the pool fee and gas.

### Contracts (Uniswap's deployments for chain 4663, from `@uniswap/sdk-core`)

| | |
|---|---|
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| v3 factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

## Token list

`tokens.js` is generated:

```sh
npm run tokens      # node scripts/build-tokens.js
```

Robinhood's stock tokens are beacon proxies behind a single beacon, and every
one emitted `BeaconUpgraded(beacon)` when it was created. The script reads the
beacon from AAPL's proxy, collects every emitter of that event, then asks the
v3 factory for each stock's WETH pool at 0.01 / 0.05 / 0.3 / 1 % and keeps the
tiers with liquidity. Only those pools are ever routed through. The scan is
cached in `scripts/stock-tokens.json`, so a rerun only reads new blocks. Run it
when new stocks list.

Logos live in `logos/<TICKER>.png` (128×128). A stock without one gets a
lettered placeholder.

## Run it

```sh
npm start           # http://localhost:8080
```

Node 18+, no dependencies. `ethers` v6 is vendored in `vendor/`.

On Railway, point a service at this folder (root directory `bloom-site`); it
starts with `npm start` and listens on `PORT`.

## Change the name

The brand name appears in `index.html` (title, header, footer, copy),
`assets/mark.svg` (the logo), and `BRAND` at the top of `app.js`.

## Credits

Background photo: “Cosmos flower field #2” by Takashi Hososhima,
[CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/), via
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Cosmos_flower_field_-2_(8090495110).jpg),
resized. Company logos are trademarks of their owners. ethers.js is MIT
(`vendor/ethers-LICENSE.md`).

Tokenized stocks track the price of the underlying security and are issued by
third parties. Holding one is not holding the share. Not investment advice.
