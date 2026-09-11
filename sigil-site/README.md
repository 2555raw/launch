# Sigil

A static site for a fictional product: passkey wallets and creator tooling
across Solana, Bitcoin and EVM, with a universal name (`sig.id`).

A *sigil* is the mark that seals a thing as yours. That is what a signature
from a passkey is, so the page keeps one electric green and spends it only
where something is live: a real connection, a real payment, a real credential.
Everything else is ink and bone.

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

No build step. Open `index.html`, or serve the folder:

```sh
python3 -m http.server --directory sigil-site 8000
```

## Live mode and demo mode

The account flow runs in one of two modes, and every screen says which.

**Demo** is the default and needs nothing. It walks the same four screens with
no wallet, no transfer and no credential. It never claims otherwise, and it
writes nothing to storage.

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

### Why there is no default treasury address

ETH sent to an address nobody holds the key for is gone. So `config.js` ships
with the field empty and the page refuses live mode until it is filled in.
Do not paste an address you found somewhere; use one from a wallet you control.

## What is real and what is staged

- **Real:** the wallet connection, the chain check, the balance check, the
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
