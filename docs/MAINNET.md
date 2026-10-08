# Devnet ↔ Mainnet

The code is identical on every network; only configuration changes.

| Setting | Test networks | Production (default in `.env.example`) |
| --- | --- | --- |
| `SOLANA_NETWORK` / `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` | `mainnet-beta` |
| `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | dedicated provider URL |
| `ROBINHOOD_CHAIN_NETWORK` / `NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK` | `testnet` (46630) | `mainnet` (4663) |
| `ROBINHOOD_CHAIN_RPC_URL` / `NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL` | `https://rpc.testnet.chain.robinhood.com` | `https://rpc.mainnet.chain.robinhood.com` or Alchemy |
| Swaps | quotes are always mainnet data; execution disabled | enabled |

Tokens are recorded with their `network`, so a database can hold devnet and mainnet launches side by side; discovery only shows the network the server currently runs on. Nothing irreversible is deployed by this repository: the optional Anchor program is source only, and every token creation is initiated and paid for by the user's wallet.
