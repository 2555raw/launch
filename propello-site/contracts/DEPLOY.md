# Putting the vault on a testnet

Twenty minutes, no money, and afterwards the site actually buys and sells
shares instead of describing it. Everything below runs on your machine —
the site's own environment cannot reach a chain node.

## 1. A throwaway key

Make a fresh account in MetaMask and export its private key. Use one that
has never held anything. The deploy script reads it from the environment,
never writes it down, and never sends it anywhere — but a key that has
touched real money does not belong in a shell variable.

## 2. Testnet ether, free

Base Sepolia is the cheapest place to do this. Ask a faucet for some:

- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

A few thousandths of an ether is plenty; the two deployments cost far less.

## 3. Deploy

```sh
npm install --no-save solc          # the only thing the script needs

RPC=https://sepolia.base.org \
KEY=0xyour_throwaway_private_key \
node scripts/deploy.js --buildings 10900000
```

`--buildings` is the vault's opening carrying value in euros — pass the
figure the Rolls end on so the share price starts where the site says it
does. Run it with `--dry` first if you only want to see it compile.

It prints three lines. It also writes `contracts/deployed.<chainid>.json`,
so you never have to find the addresses again.

## 4. Point the site at it

Paste those three lines into `config.js`, and change the chain to the one
you deployed to:

```js
chain: {
  id: 84532,
  hex: '0x14a34',
  name: 'Base Sepolia',
  rpc: 'https://sepolia.base.org',
  explorer: 'https://sepolia.basescan.org',
  currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
},
vault:    '0x…',
asset:    '0x…',
registry: '0x…',
testnet: true,        /* shows the faucet button and says the tokens are worthless */
```

`testnet: true` matters. It puts the "get test EURG" button in the wallet
panel and prints the line that tells a visitor these tokens are worth
nothing. Leave it out and the page will happily look like the real thing.

## 5. Try it

Open the site, connect a wallet, and in the panel:

1. **Get 10,000 test EURG** — mints you a balance.
2. Type an amount and press **Deposit** — approves the vault, then buys
   vPROP at the share price. Two confirmations the first time, one after.
3. Press **Redeem** — sells them back. Inside ninety days of a deposit the
   curve takes a little off, and that little stays in the vault, exactly
   as the sandbox and the docs describe.

The price only moves when the operator closes a month, and the operator is
the account that deployed. `close(month, buildingsAtCost, rollHash)` is the
call; the registry refuses a price without a hash and a hash without a price.

## What this is not

A testnet deployment proves the software works. It proves nothing about
apartments, and the tokens have no value. Before any of this touches real
money it needs an independent audit of `Vault.sol`, and before it takes
money from the public it needs the company, the custody and the securities
paperwork that owning and selling shares of real buildings requires. None
of that is a coding problem.
