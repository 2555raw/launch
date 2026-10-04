# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and vanilla ES modules, no build step (matches the rest of this repository).

## Users

Onchain crypto traders who do not want their entries copied or their PnL read off a block
explorer. They use browser wallets daily (MetaMask, Phantom, Coinbase Wallet, Rabby) and need to
prove a single holding to a counterparty without exposing the whole wallet.

## Product Purpose

Obscura seals an asset into a single SHA-256 commitment that only the holder's receipt can open.
The holder keeps the receipt, can hand the bond on through a passphrase-sealed package, and can
prove one bond to one counterparty, who gets back a single bit: true or false.

## Positioning

Selective disclosure done entirely in the browser: no server, no custody, no account. A receipt
shows one bond; connecting a wallet shows everything.

## Operating Context

- Landing page (persuade), Console (cloak, vault, transfer, receive), Verify (one-bit check).
- Visitors accept the terms on first entry; declining leads to an access-denied page.
- Wallet connection through injected EVM wallets (EIP-6963 discovery), used for the optional
  anchor transaction.

## Capabilities and Constraints

- Working today: SHA-256 cloaking, local vault with backup, AES-256-GCM transfer packages
  (PBKDF2-SHA-256, 310k rounds), re-cloak on receive, verification, optional self-transaction
  anchor with the commitment as calldata.
- Not deployed: the $OBX token and the bond NFT contract. No contract address may be shown.
- Product name and ticker ("Obscura", "$OBX") are placeholders; the user will supply final ones.
- No X/Twitter account yet: the X link points to x.com until one exists.

## Evidence on Hand

No users, testimonials, partners, volumes or audits exist. None may be invented. Wallet logos are
shown only as connection options, not as endorsements.

## Product Principles

1. Show only what is true today; mark what is not deployed.
2. Everything sensitive stays on the visitor's device.
3. One bond, one proof: never ask for more disclosure than the job needs.
4. Explain the mechanism plainly; traders should understand it in a minute.
