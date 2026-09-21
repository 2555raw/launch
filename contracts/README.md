# Contracts

Two ways to pair a coin with a stock. Both are unaudited; read them before deploying.

- **`lilypad/`** — LilyPad's own protocol: a factory that approves stocks, a bonding curve
  quoted in the stock, a fixed-supply coin, and a pluggable graduator that seeds a permanent
  pool. Compile, test (52 checks on an in-process EVM) and deploy scripts included.
  Start with `lilypad/README.md`.
- **`pons/`** — `LilyPadLauncher.sol`, a thin wrapper for launching on the public Pons V2
  factory on Robinhood Chain with the creator's first buy in the same transaction. The site's
  `adapter.pons.js` uses it when `BONDED_PONS.launcher` is set. See `pons/README.md`.
