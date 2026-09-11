# Monelle

A static site for a fictional product: passkey wallets, a token launch desk
and a universal name (`mon.id`), aimed at Robinhood Chain and every other EVM
network.

The mark is an arcade: two arches on three stems, which is both the m of the
name and the shape of a doorway you are let through. The page keeps one
electric green and spends it only where something is live: a real connection,
a real payment, a real credential. Everything else is ink and bone.

Everything here is original and not affiliated with any existing company.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The page: hero, products, demo, developers, pricing, FAQ, footer |
| `styles.css` | Tokens, layout, the CSS tile render, the account modal, responsive rules |
| `app.js` | Nav, code tabs, the wallet preview, the billing toggle |
| `account.js` | The four step account flow: wallet, payment, passkey, deposit |
| `config.js` | **The file an operator edits.** Treasury address, chain, prices |
| `assets/mark.svg` | The logo mark |
| `assets/pfp.png` | The mark as a 1024px avatar, for profiles and social |

No build step. Open `index.html`, or serve the folder:

```sh
python3 -m http.server --directory monelle-site 8000
```

## Live mode and demo mode

The account flow runs in one of two modes, and every screen says which.

**Demo** is the default and needs nothing. It walks the same four screens with
no wallet, no transfer and no credential. It never claims otherwise, and it
writes nothing to storage. Anything marked `data-demo` opens it directly,
skipping the screen that asks demo or live: the hero button, the nav entry and
the button beside the wallet preview all do.

**Live** uses a real wallet connection, a real ETH transfer and a real WebAuthn
credential. It turns on only when all of these hold:

1. `config.treasury` is an Ethereum address **you hold the key for**.
2. An Ethereum wallet is installed in the visitor's browser. Phantom exposes an
   EIP-1193 provider at `window.phantom.ethereum`, so no library is bundled and
   there is no RPC endpoint to configure: the wallet carries its own.
3. The page is served over https from a real domain. WebAuthn needs a secure
   context and a registrable domain, so `file://`, plain http and an embedded
   frame all fail, and the page falls back to demo.

Before sending, the flow checks the wallet's chain against `config.chainId` and
asks it to switch if they differ. A payment on the wrong network reaches the
right address on the wrong chain, which is its own kind of lost.

Start on Sepolia, where test ETH is free from a faucet, and move to mainnet only
once you have watched a payment land.

### Settling on Robinhood Chain

`config.chainId` ships set to Sepolia, not to Robinhood Chain, and you have to
put the real id there yourself from its own documentation or from chainlist.
It is left out on purpose: a chain id guessed rather than looked up sends the
payment to a network your treasury is not on. The flow compares `eth_chainId`
against this value and asks the wallet to switch, so a wrong entry here is a
wrong send rather than an error on screen.

### Why there is no default treasury address

ETH sent to an address nobody holds the key for is gone. So `config.js` ships
with the field empty and the page refuses live mode until it is filled in.
Do not paste an address you found somewhere; use one from a wallet you control.

## Pricing

Plans are priced in dollars in `config.js`, because that is the number a buyer
reasons about. The ETH figure on the cards and the amount checkout asks the
wallet to send are both worked out from that one number and `ethReferenceUsd`,
so they cannot drift apart.

`ethReferenceUsd` is a fixed number, not a price feed. The ETH charged
therefore wanders from the dollar price as the market moves, which is fine for
a demo and wrong for a real storefront. Before taking live payments, either
quote in a stablecoin like USDC or read a real feed there.

## The wallet panel

Finishing the flow lands on a wallet rather than a receipt: a balance, the
address, the network, the passkey, and a list of what has moved. The nav keeps
a badge afterwards that reopens it.

What "add funds" means depends on the mode, because nothing on a web page can
conjure ETH.

- **Live** reads the real balance with `eth_getBalance` and gives you somewhere
  to send to: the address, a Refresh button, and on a test network a link to
  the faucet that hands out free ETH. Send, refresh, watch it move.
- **Demo** credits a number on the page. Add 0.25, spend 0.1, and the balance
  and the activity list behave the way the real one does. The panel says
  plainly that the address is invented and holds nothing.

## What is real and what is staged

- **Real:** the wallet connection, the chain check, the balance reads, the
  transfer and the WebAuthn credential. That code path is not a mock.
- **Staged:** the account itself. A paid plan is recorded in `localStorage` on
  the visitor's device, because there is no backend here. Wire `account.js` to
  a real API before treating an account as a fact.
- **A passkey is not a spending key.** A WebAuthn credential cannot hold ETH on
  its own; making one into a wallet needs an on-chain signer contract. So the
  deposit screen points at the wallet the visitor connected rather than
  inventing an address, and the demo says plainly not to send anything to it.
- The stats, the customer names in the marquee and the USD reference price are
  placeholders for the layout.
