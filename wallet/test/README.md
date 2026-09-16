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

## quick.js — starting without a password

`node test/quick.js` needs the wallet served and no chain. The check that
matters is step 5: it asks the browser to export the wallet's encryption key
and **fails if it can**. The shortcut this replaces was to keep a passphrase
beside the keystore, which is not encryption at all — anything that reads
localStorage reads both halves. If that step ever starts passing, the wallet is
storing a key an injected script could copy and send away.

## phantom.js — launching with Phantom

`node test/phantom.js` needs the wallet served and no chain. Phantom is a
browser extension and there is none here, so a stand-in is injected the way
`deposit.js` injects an EIP-6963 wallet — but a real one: it holds an ed25519
key and signs what it is given, so the assembled transaction is verified
rather than inspected.

What it is really testing is ordering. A launch carries two signatures, the
creator's and the brand-new mint's, and the message declares the exact order
they must appear in. Phantom returns only its own, so Ward assembles the rest
around it, and every signature is checked against the signer the message says
belongs at that position.

It does not prove Phantom itself accepts the transaction. That needs the real
extension and a real network.

## pons-live.js — a coin actually launched

Pons is on Robinhood Chain mainnet only, so a real launch costs real money and
cannot be undone. This puts a stand-in factory at Pons's actual address on a
local chain running Robinhood's chain id (4663), then does the whole thing for
real: a wallet in one tap, funded, the form filled in, the button pressed, a
transaction mined. Afterwards it reads back out of the contract what it was
handed, and checks every field, the exact fee and the pinned economics.

The stand-in is not a yes-machine: its launch config **id 0 is retired and id 1
is live**, so a wallet that assumed 0 would launch against a dead curve and
this test would say so.

```sh
npx hardhat node --port 8545          # hardhat.config.js: chainId 4663
PORT=8099 npm start
node test/pons-mock.js                # compiles the stand-in (needs solc)
node test/pons-live.js
```

What it proves: the wiring, the discovery, the encoding, the fee, the fields.
What it cannot prove: that the deployed Pons behaves like its published source.

## feed.js and feed-live.js — the launched-coins list

The landing page does not load ethers and should not start, so `feed.js`
decodes what it needs by hand. The two things a browser cannot compute — the
event topic and the function selectors, which need keccak-256 — are written
down, so `test/feed.js` recomputes every one from its signature and checks the
hand-rolled string decoder against ethers across the cases that break naive
ones: empty, multi-byte, emoji, and lengths either side of the 32-byte word
boundary. It also reads the event out of Pons's source when `PONS_SRC` is set.

`test/feed-live.js` runs the whole path against a local chain seeded with three
launches. Two of its checks are not about whether it works: that a multi-byte
name survives, and that **no coin's picture is ever fetched**. The logo is a URL
chosen by whoever launched the coin, and this page tells visitors it has no
trackers; loading it would send every visitor's address to a host a stranger
picked. The avatar is a letter, and the test fails if an `<img>` appears.

## stale-balance.js — a balance that belonged to another network

A balance is an integer of its chain's smallest unit, so carrying one across a
network switch does not merely show the wrong number, it invents one: 0.0001
ETH is 10^14 wei, and painted against a nine-decimal chain that reads as
"100,000 SOL". This fails if any balance survives a switch.

## feed-mine.js and feed-arrival.js — whose launch, and live

Pons's event says nothing about who launched through what. But the launch is
CREATE2 and its salt is a free 32 bytes, so Ward begins its salts with `WARD`
in ASCII and the answer lives in the calldata of the transaction that emitted
the event. `feed-mine.js` puts two launches on a local chain, one tagged and
one not, and fails if the tabs mix them. It is a claim, not a proof: anyone can
write the same four bytes, and the page says so.

`feed-arrival.js` is the one that makes the LIVE label honest. It opens the
page, launches a coin on the chain behind it, touches nothing, and fails if the
row does not arrive at the top by itself.

`feed-mine-seed.js` places them: one tagged launch, one untagged, and then a
hundred and ten more untagged on top. The pile is deliberate. The Ward tab used
to fetch a fixed number of recent launches and sieve that pile afterwards, so a
Ward coin with enough strangers stacked on it fell off the bottom and the tab
read empty while the coin sat on chain the whole time. That is what someone saw
on the live site, and the fill is what makes it a failure here instead.

```sh
npx hardhat node --port 8545          # chainId 4663
node test/feed-mine-mock.js           # compiles the stand-in factory
node test/feed-mine-seed.js           # places the launches (FILL=n to change)
PORT=8099 npm start
node test/feed-mine.js && node test/feed-arrival.js
```
