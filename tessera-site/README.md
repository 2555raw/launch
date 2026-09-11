# Tessera

A static site for a fictional product: passkey wallets and creator tooling
across Solana, Bitcoin and EVM, with a universal name (`tess.id`).

A *tessera* was the small tile a Roman carried as a token of identity and
admission, and the same word names the tiles of a mosaic. Hence the palette:
an ink ground, bone type, and the verdigris of aged bronze as the one accent.

Everything here is original and not affiliated with any existing company.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The page: hero, products, demo, developers, pricing, FAQ, footer |
| `styles.css` | Tokens, layout, the CSS tile render, the account modal, responsive rules |
| `app.js` | Nav, code tabs, the wallet preview, the billing toggle |
| `account.js` | The four step account flow: wallet, payment, passkey, deposit |
| `config.js` | **The file an operator edits.** Treasury address, RPC, prices |
| `assets/mark.svg` | The logo mark |

No build step. Open `index.html`, or serve the folder:

```sh
python3 -m http.server --directory tessera-site 8000
```

## Live mode and demo mode

The account flow runs in one of two modes, and every screen says which.

**Demo** is the default and needs nothing. It walks the same four screens with
no wallet, no transfer and no credential. It never claims otherwise, and it
writes nothing to storage.

**Live** uses a real Phantom connection, a real SOL transfer and a real
WebAuthn credential. It turns on only when all of these hold:

1. `config.treasury` is a Solana address **you hold the key for**.
2. `config.rpcUrl` is an RPC endpoint that accepts browser origins. The public
   endpoints rate limit hard; use Helius, Triton, QuickNode or your own node.
3. Phantom is installed in the visitor's browser.
4. The page is served over https from a real domain. WebAuthn needs a secure
   context and a registrable domain, so `file://`, plain http and an embedded
   frame all fail, and the page falls back to demo.

Start on `cluster: 'devnet'`, where SOL is free from a faucet, and move to
`mainnet-beta` only once you have watched a payment land.

### Why there is no default treasury address

SOL sent to an address nobody holds the key for is gone. So `config.js` ships
with the field empty and the page refuses live mode until it is filled in.
Do not paste an address you found somewhere; use one from a wallet you control.

## What is real and what is staged

- **Real:** the Phantom connection, the balance check, the transfer and its
  confirmation, and the WebAuthn credential. That code path is not a mock.
- **Staged:** the account itself. A paid plan is recorded in `localStorage` on
  the visitor's device, because there is no backend here. Wire `account.js` to
  a real API before treating an account as a fact.
- **A passkey is not a spending key.** A WebAuthn credential cannot hold SOL on
  its own; making one into a wallet needs an on-chain signer program. So the
  deposit screen points at the wallet the visitor connected rather than
  inventing an address, and the demo says plainly not to send anything to it.
- The stats, the customer names in the marquee and the USD reference price are
  placeholders for the layout.
