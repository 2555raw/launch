# LilyPad protocol

One coin, one stock, one curve. A factory deploys a fixed-supply coin and a bonding curve
whose **quote asset is a tokenized stock** (NVDA, TSLA, SPY…). Buys pay the stock in, sells
take the stock out, and when the curve holds the stock's graduation threshold it seeds a
permanent pool and closes. This is LilyPad's own protocol: no dependency on Pons, no
dependency on OpenZeppelin, four small contracts.

```
contracts/lilypad/
  LilyPadFactory.sol          approves stocks, holds the fee schedule, launches pairs (+ first buy in the same tx)
  LilyPadCurve.sol            the bonding curve: buy / sell / graduate / claim fees
  LilyPadToken.sol            the coin: plain ERC20, 18 decimals, supply minted once to its curve, no owner
  graduators/UniswapV2Graduator.sol   seeds a V2-style pool and burns the LP tokens
  interfaces/IGraduator.sol   plug in another venue (a Uniswap v4 graduator fits the same interface)
  lib/SafeTransfer.sol        ERC20 calls that tolerate USDT-style tokens
  test/                       mocks + an in-process EVM test suite (52 checks)
  scripts/compile.mjs         solc-js 0.8.26, optimizer + viaIR, writes out/artifacts.json
  scripts/deploy.mjs          deploy + approve stocks from a JSON file
```

## How a launch works

1. `LilyPadFactory.launch(LaunchParams)` with `msg.value == launchFee()`.
2. The factory deploys a `LilyPadCurve` for `params.stock`, then a `LilyPadToken` whose
   1,000,000,000 supply is minted straight to that curve, then `curve.initialize()`.
3. If `devBuyQuote > 0`, the factory pulls that much of the stock from the creator (approve it
   to the factory first) and buys on the new curve **in the same transaction**, for the
   creator, with no snipe tax. Nobody can trade before the creator.
4. `PairCreated(token, curve, creator, stock, name, symbol, metadata)` is emitted. `metadata`
   is a free string (JSON with logo, description, socials) that lives only in the event.

## The curve

```
Qv = phantomQuote + quoteReserve         virtual quote reserve (stock units)
T  = tokenReserve                        coins still on the curve

buy:   net = quoteIn − fee − creatorTax − snipeTax
       tokensOut = net · T / (Qv + net)
sell:  gross = tokensIn · Qv / (T + tokensIn)
       quoteOut = gross − fee − creatorTax
```

- `phantomQuote` is set per stock by the factory owner. It gives the first buy a price instead
  of zero and is never paid out, so the real stock in the curve always covers every sell.
- `graduationThreshold` is set per stock. When `quoteReserve` reaches it, the buy that crossed
  the line calls `_graduate()` in the same transaction (there is also a permissionless
  `graduate()`).
- **Graduation** keeps the price continuous: `quoteToPool = raised − graduationFee`,
  `tokensToPool = quoteToPool · T / Qv`, the rest of the coins on the curve are burned to
  `0x…dEaD`, and the graduator receives both amounts. `UniswapV2Graduator` calls
  `addLiquidity` and sends the LP tokens to `0x…dEaD`.
- After graduation `buy` and `sell` revert; only `claimProtocolFees` / `claimCreatorFees` work.

## Fees (defaults, all changeable by the owner within caps)

| Fee | Default | Goes to |
| --- | --- | --- |
| Launch fee | set at deploy, in ETH | treasury (`withdrawLaunchFees`, anyone may call) |
| Curve fee | 1% of every trade (cap 5%) | treasury (`claimProtocolFees`) |
| Creator tax | 0–2% per launch (cap 10%) | the creator (`claimCreatorFees`) |
| Snipe tax | 20% at the launch block, linear to 0 over 60 blocks | stays in the curve: it raises the floor for everyone already in |
| Graduation fee | 2% of the raised stock (cap 10%) | treasury |

The creator, the factory (for the first buy) and up to 32 addresses named at launch are exempt
from the snipe tax. Fees are booked inside the curve and pulled by anyone to fixed recipients,
so no transfer to an arbitrary address ever happens in the middle of a trade.

## Governance

`LilyPadFactory` has a two-step owner who can approve or disable stocks and their economics,
change the fee schedule (within the caps above), swap the graduator, change the treasury and
pause launches. The owner **cannot** touch a live curve, its reserves, its coin or its fees;
curves read only `treasury()` and `graduator()` from the factory.

## Build, test, deploy

```bash
cd contracts/lilypad
npm install
npm test                       # compiles with solc 0.8.26 and runs test/run.mjs on an in-process EVM
```

Deploy (any EVM chain; Robinhood Chain is 4663):

```bash
RPC_URL=https://rpc.mainnet.chain.robinhood.com PRIVATE_KEY=0x… TREASURY=0x… \
V2_ROUTER=0x… V2_FACTORY=0x… LAUNCH_FEE=0.002 \
node scripts/deploy.mjs stocks.json
```

`stocks.json` lists the official stock tokens and their economics in whole shares:

```json
[{ "symbol": "TSLA", "address": "0x…", "phantom": "16.64", "threshold": "41.6" }]
```

The script reads each token's decimals, calls `setStock`, and writes
`out/deployment.<chainId>.json`. Without `V2_ROUTER`/`V2_FACTORY` it deploys with no graduator;
curves then trade but cannot graduate until `setGraduator()` is called. Pons graduates to
Uniswap v4 on Robinhood Chain; if there is no V2-style DEX there, a v4 graduator implementing
`IGraduator` is the next contract to write.

Verify on Blockscout with the same settings the compile script uses: solc 0.8.26, optimizer
2000 runs, viaIR, evmVersion cancun.

## What the site needs

The site's adapter contract (`bonded-site/README.md`) maps onto this protocol directly:

| Adapter | Protocol |
| --- | --- |
| `createPair` | `factory.launch(...)` with `devBuyQuote` for the first buy |
| `pairs` / `pair` | `PairCreated` events, `curve.getReserves()`, `curve.price()` |
| `quote` / `swap` | `curve.quoteBuy` / `quoteSell`, `curve.buy` / `sell` |
| `holdings` / `balances` | `token.balanceOf`, stock `balanceOf` |
| `subscribe` | `PairCreated`, `Buy`, `Sell`, `Graduated` logs |

`adapter.pons.js` already does this against Pons; an `adapter.lilypad.js` against this factory
is the same shape with these selectors.

## Before mainnet

- Unaudited. It is short on purpose; read every line before deploying it with a treasury.
- Choose `phantomQuote` and `graduationThreshold` per stock in that stock's units, thinking in
  USD: with TSLA at $400, phantom 16.64 ≈ $6.6k opening market cap and threshold 41.6 ≈ $16.6k
  raised at graduation (Pons uses these figures for NVDA).
- Stock tokens are issued by Robinhood for eligible EU customers and are geo-restricted; the
  protocol cannot see that, the front end must say it.
