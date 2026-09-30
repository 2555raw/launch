# Yuelong protocol

One coin, one curve, one pool. A factory deploys a fixed-supply coin and a constant-product
bonding curve quoted in native TAO (or any approved ERC-20). Buys pay in, sells pay out, and when
the curve has raised its target it graduates into a pool with no LP tokens, in the same transaction.
No OpenZeppelin and no proxies.

```
YuelongFactory.sol            approved pairs and their economics, fees, launch (+ first buy, native or ERC-20)
YuelongCurve.sol              the curve: buy / sell / graduate / claim fees
YuelongToken.sol              the coin: plain ERC-20, 18 decimals, supply minted once to its curve, no owner
YuelongRouter.sol             one entry point for trading: native TAO in/out, curve before graduation, pool after
WrappedNative.sol             WTAO: the native coin as an ERC-20, one for one
pool/YuelongPool.sol          post-graduation constant-product pool, 0.3% fee kept in the pool, no LP tokens
graduators/PoolGraduator.sol  seeds a YuelongPool; only the factory's own curves may call it
graduators/UniswapV2Graduator.sol  alternative: seed a Uniswap-V2-style pool and burn the LP tokens
interfaces/, lib/SafeTransfer.sol
test/                         mocks + an in-process EVM test suite (82 checks)
scripts/compile.mjs           solc 0.8.26, optimizer + viaIR, evm "paris"; also exports ABIs/bytecode to ../assets/chain
scripts/deploy.mjs            deploy WTAO, factory, graduator, router and open the native pair
```

```bash
npm install
npm test                         # compile + 82 checks
cp .env.example .env             # RPC_URL, PRIVATE_KEY … (never commit it)
npm run deploy                   # writes out/deployment.<chainId>.json
```

## The curve

```
Qv = phantomQuote + quoteReserve         virtual quote reserve
T  = tokenReserve                        coins still on the curve

buy:   net = quoteIn − fee − creatorTax − snipeTax
       tokensOut = net · T / (Qv + net)
sell:  gross = tokensIn · Qv / (T + tokensIn)
       quoteOut = gross − fee − creatorTax
```

The phantom reserve gives the first buy a price and is never paid out, so the real reserve always
covers every sell. At graduation `quoteToPool = raised − graduationFee`,
`tokensToPool = quoteToPool · T / Qv` (the pool opens at the curve's last price) and the remaining
coins are burned.

## Fees (defaults; the owner can change them within caps)

| Fee | Default | Goes to |
| --- | --- | --- |
| Launch fee | set at deploy | treasury (`withdrawLaunchFees`, anyone may call) |
| Curve fee | 1% of every trade (cap 5%) | treasury (`claimProtocolFees`) |
| Creator fee | 0–2% chosen at launch (cap 10%) | the creator (`claimCreatorFees`) |
| Snipe tax | 20% at the launch block, linear to 0 over 60 blocks | stays in the curve |
| Graduation fee | 2% of the raised TAO (cap 10%) | treasury |
| Pool fee | 0.3% | stays in the pool |

The creator (for the first buy, made inside `launch`) and up to 32 addresses named at launch are
exempt from the snipe tax.

## What the owner can and cannot do

The factory owner can approve pairs, change fees within the caps above, change the treasury and the
graduator, and pause **new launches**. The owner cannot withdraw a curve's reserves, a pool's
liquidity or anyone's coins, and cannot stop trading on existing curves.

One trust point remains: a curve hands its TAO and coins to the factory's *current* graduator when
it graduates, so whoever owns the factory could point it at a malicious graduator. Transfer
ownership to a multisig (`transferOwnership` + `acceptOwnership`) before real money is involved,
and consider locking the graduator in a future version.

Not audited yet. Get an independent audit before mainnet.
