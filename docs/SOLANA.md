# Solana

Library: `@solana/web3.js` 1.x + `@solana/spl-token` 0.4 (Token-2022) + `@solana/spl-token-metadata`, wallet-adapter (Phantom, Solflare, any Wallet Standard wallet).

* **Networks**: `SOLANA_NETWORK` = `mainnet-beta` (default) | `devnet` | `testnet`. Explorer links carry the cluster. Use a dedicated RPC in production (`SOLANA_RPC_URL`); the public endpoint is rate limited and rejects `getProgramAccounts` (holder counts then show "Data unavailable").
* **Wallet sign-in** (`wallet-auth.ts`): SIWS-style message with domain, address, nonce (Redis, 5 min, single-use) and issued-at; ed25519 verification with tweetnacl. Seed phrases / private keys are never requested or stored.
* **Token creation** (`token.ts`): one transaction — create mint account (Token-2022, metadata-pointer extension sized with the packed metadata), initialize metadata pointer → mint → metadata (name, symbol, uri), create the creator's associated token account, mint the full supply, optionally revoke mint authority (fixed supply) and freeze authority. The mint keypair partially signs; the wallet signs as fee payer.
* **Verification** (`verify.ts`): fetches the parsed transaction (must be confirmed and successful and reference the mint), checks the mint is owned by Token-2022, reads decimals/supply/authorities and the on-chain metadata. The API additionally requires the fee payer to be a wallet linked to the account and the numbers to match the project.
* **Balances** (`balances.ts`): SOL + all token accounts for both token programs.
* **Market data** (`metrics.ts`): DexScreener `token-pairs/v1/solana/{mint}`, best pair by liquidity; null when unindexed.
* **Swaps** (`jupiter.ts`): Swap API v2 `GET /order` + `POST /execute`; mainnet liquidity only. The API proxies it (`/swap/*`), the wallet signs the returned versioned transaction, the swap is recorded as a `Transaction`.

Tests: unit (validation, signatures, metrics, Jupiter client), read-only mainnet (parses PYUSD's Token-2022 metadata), and a live devnet mint test gated by `SOLANA_DEVNET_TESTS=1` (airdrop or `SOLANA_SERVER_KEYPAIR`).
