# Spillway

Launch an ERC-20 paired to a single water source: a reservoir, an aquifer, a
glacier, a desalination plant, and trade it on a bonding curve that lives in an
open launcher contract. The source ticker is written into the token itself and
readable on chain as `source()`.

No backend, no custody, no admin key. The front end is static files that talk to
the chain from the browser.

```
npm install
npm test          # compile the contracts and run the suite on an in-process EVM
npm run node      # a local chain on :8545
npm run serve     # the site on :8080
npm run e2e       # browser run: deploy → launch → buy → sell → claim
```

## What is on chain

`contracts/Spillway.sol` holds two contracts:

- **`SpillwayToken`**: a plain ERC-20 that also stores its water source ticker.
  The whole supply is minted to the launcher at birth; there is no mint function.
- **`Spillway`**: the launcher. It creates pairings, runs each curve, and keeps
  each token's fee vault. It has no owner, no pause and no upgrade path. The only
  privileged call is `claimVault`, which pays a creator their own fees and
  nothing else.

### The curve

Each pairing is a constant product `k = ethReserve · tokenReserve`. The ETH side
opens at a virtual 1.2 ETH that nobody deposits and nobody can withdraw. It sets
the opening price and no more.

- buy: `tokensOut = tokenReserve − k / (ethReserve + valueAfterFee)`
- sell: `ethOut = ethReserve − k / (tokenReserve + amountIn)`
- price: `ethReserve / tokenReserve`

Sells are paid out of real ETH the curve has taken in, never out of the virtual
reserve, so a sell reverts rather than dipping into another position. Both sides
take a minimum-out, and the site quotes on chain and submits with 3% of room.

3% of every trade accrues to that pairing's vault. Passing 4.2 ETH raised marks
the pairing graduated and emits an event; the curve keeps working exactly the
same afterwards. Nothing is locked or migrated: the contract does not promise
what it cannot do.

## Running a launcher

Spillway is not a service. If the network your wallet is on has no launcher, the
site deploys one from your wallet in a single transaction: that instance is
yours, its address is remembered in your browser, and `?launcher=0x…` on any link
points others at it. Known addresses can be baked into `DEPLOYMENTS` in
`chain.js`.

Chains configured out of the box: Ethereum, Base, Base Sepolia, Sepolia, Optimism,
Arbitrum, Polygon and a localhost node. Reads fall back to a public RPC when no
wallet is present, so the pages work logged out.

## Files

| File | What it is |
| --- | --- |
| `contracts/Spillway.sol` | The launcher and the token |
| `contracts/compile.js` | solc build → `contract.js` (ABI + bytecode for the browser) |
| `contracts/test.js` | Contract suite on an in-process EVM |
| `contracts/e2e.js` | Browser run against a local chain with an injected wallet |
| `chain.js` | Wallet, launcher discovery and every contract call |
| `app.js` | Page rendering |
| `data.js` | The water register: 32 sources |
| `server.js` | Static file server for deployment |

## The water register

The 32 sources, their venues, assays, units, spot figures and fill levels ship
with the build as reference data. They label a pairing, and the ticker goes on chain
with the token, but they do not price it: a token's price is its curve and
nothing else. Pricing off real hydrology would need an oracle, and the contract
deliberately has none.
