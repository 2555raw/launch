# Launchpad

Flow (web `/launchpad/new`):
1. **Chain & wallet** — Solana or Robinhood Chain; the connected wallet must be linked to the account (signature).
2. **Token information** — name, symbol, description, logo, website, X, Discord, Telegram, total supply, decimals, fixed-supply option.
3. **Logo** — uploaded to the API (`/uploads/logos/...`).
4. **Review & prepare** — the API writes the off-chain metadata JSON (`/uploads/metadata/<project>.json`) that the on-chain metadata `uri` points to. For production permanence host the metadata/logo on IPFS or Arweave by changing `UPLOADS_DRIVER` or fronting `/uploads` with object storage; the on-chain URI is whatever `API_PUBLIC_URL` serves.
5. **Sign** — the browser builds the transaction and the wallet signs/broadcasts. The server never holds a key.
6. **Verify** — `POST /launchpad/projects/:id/submit` polls RPC until the transaction is confirmed, validates the on-chain state against the project, stores `Token` + `Transaction` and publishes.
7. **Project page** — `/projects/<slug>`: token address, creator, supply, decimals, creation tx, explorer links, metrics (price, market cap, FDV, liquidity, 24 h volume, 24 h txns, holders) from DexScreener + explorer. Anything not available is shown as **Data unavailable**.

Discovery `/projects`: New, Trending (24 h txns), Volume, Liquidity, Market Cap, Holders; chain filter; search by name/symbol/address.

Costs are paid by the user's wallet: on Solana mainnet roughly the rent for a mint with metadata (~0.004 SOL) plus fees; on Robinhood Chain the gas for a ~3.8 kB contract deployment.
