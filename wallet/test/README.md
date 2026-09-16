# End-to-end tests

These open the wallet in a real browser, do real things, and then check the
result **against the chain**. They do not check layout; they check the parts
that cost money when they break.

## `e2e.js` — the full journey

- the generated phrase is valid BIP-39 and the address derives from it;
- the keystore is encrypted with scrypt, and **neither the phrase nor the
  private key** appears in the clear anywhere in `localStorage`;
- a wrong verification word is rejected;
- a wrong password is rejected;
- the on-chain receipt exists, is type 2 (EIP-1559), is signed by the wallet's
  address, and the recipient receives the exact amount;
- a payment link, opened cold in another tab, lands on the prefilled payment.

## `deposit.js` — topping up from an external wallet

A browser extension cannot be installed here, so the test announces its own
EIP-6963 provider — the same interface MetaMask, Coinbase Wallet, Phantom and
Rainbow announce — and forwards every request to the local node. What is under
test is Ward's side of that conversation: discovery, connection, the chain
switch, and real funds arriving at the address it generated, with the balance on
screen agreeing with the chain afterwards.

## What they need

- `playwright` and `ethers` resolvable from here (`npm i -D playwright ethers`,
  or installed globally).
- A local EVM node **on chain id 8453**, because the app signs for the network
  it has selected and a different id would make the node reject the signature:

  ```sh
  npx hardhat node --port 8545      # with networks.hardhat.chainId = 8453
  ```

- The wallet being served: `PORT=8099 npm start` from `wallet/`.

## Running them

```sh
npm test            # both, in order
```

Optional variables: `APP_URL`, `RPC_URL`, `CHROME_PATH`, `SHOT_DIR`.

The private key in the files is Hardhat's first account, which is public and
known to everyone. It funds the test wallet on the local chain and **must never
be used on a real network**.

## dbc.js — the launchpad instructions

`node test/dbc.js` needs no node, no network and no keys: it compares the
instructions `public/dbc.js` builds by hand against the ones Meteora's own SDK
and Anchor build from the published IDL, and stops at the first byte that
differs. It also re-proves `findAta` against `@solana/spl-token`, because the
launchpad made it share a code path with the rest of the program-derived
addresses.

Install its reference libraries once:

```sh
npm i --no-save --prefix test \
  @coral-xyz/anchor @solana/web3.js @solana/spl-token \
  @meteora-ag/dynamic-bonding-curve-sdk
```

They are reference implementations for the tests only — nothing in `public/`
imports them, and the wallet still ships no third-party script it did not
vendor itself. Point `DBC_MODULES` elsewhere if they live somewhere else.

What it proves: the bytes are right. What it cannot prove: that a launch
succeeds against the live program. That needs an RPC node, a funded key, and a
config account that exists — see the note at the top of `public/dbc.js`.

## launch.js — the launch screen

`node test/launch.js` needs the wallet served (`PORT=8111 npm start`) but no
chain: it creates a wallet through the interface, walks the launch screen's
three states, and checks the button stays shut with the form filled in and the
box ticked, because the configuration it would launch against does not exist
yet. It also covers the network pill, which is reachable from every screen —
moving off Solana while looking at the launch form has to turn the form back
into an offer to switch.

## pons.js — the Robinhood Chain launchpad

`node test/pons.js` needs no chain. Pons publishes no SDK, and ethers is the
encoder here rather than an independent witness, so "ethers agreed with itself"
would prove nothing. It checks the three things ethers cannot fake: the
selector, recomputed from the canonical signature with keccak-256; the
`TokenParams` struct, read field by field out of Pons's own Solidity source;
and a round trip proving every value lands in the field it was given to.

Point it at a clone of the contracts to get the source check:

```sh
git clone --depth 1 https://github.com/ponsdotdev/ponsfamily /tmp/ponsfamily
PONS_SRC=/tmp/ponsfamily npm run test:pons
```

Without `PONS_SRC` it says the struct was not checked rather than passing
quietly. It needs `ethers` available; `PONS_MODULES` points at it.
