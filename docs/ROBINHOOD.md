# Robinhood integration

Researched on 2026-10-08 against Robinhood's own documentation. Three different things are often conflated:

| Capability | Status | Where |
| --- | --- | --- |
| **Robinhood Chain** — EVM L2 built with Arbitrum technology; mainnet live (chain id 4663), public testnet (46630). Permissionless contract deployment. | **Implemented** (token launches, balances, explorer links, wallet sign-in) | `packages/evm`, `/launchpad`, `/wallet`, `/portfolio` |
| **Robinhood Crypto Trading API** — official, documented at docs.robinhood.com/crypto/trading. Auth = API key + Ed25519 signature over `apiKey + timestamp + path + method + body`, headers `x-api-key`, `x-signature`, `x-timestamp`; base `https://trading.robinhood.com`. Endpoints: accounts, holdings, trading pairs, best bid/ask, estimated price, orders (market/limit/stop). | **Implemented** (`RobinhoodCryptoClient`), user-linked credentials encrypted at rest; portfolio shows holdings; settings page can place real crypto orders | `packages/robinhood`, `/robinhood/*` routes, `/settings` |
| **Stock / ETF / options trading, brokerage portfolio, OAuth login** | **Not available publicly.** Robinhood publishes no developer API for these; the May 2026 "open to agents" program is account-side with no public API, and reverse-engineered endpoints violate Robinhood's terms. | `UnavailableRobinhoodBrokerageProvider` throws `RobinhoodFeatureUnavailableError`; `/robinhood/capabilities` returns the matrix for the UI |

## Linking a Robinhood crypto account
1. Settings → *Generate key pair* (Ed25519; the private key is shown once and not stored).
2. Register the **public key** at robinhood.com/account/crypto → API trading, choose permissions, copy the API key.
3. Settings → *Connect*: the server proves the credentials by calling `GET /api/v1/crypto/trading/accounts/` before storing them encrypted with `CREDENTIALS_ENCRYPTION_KEY`.

## What activating brokerage features would require
* an official Robinhood partner/brokerage API agreement providing documented endpoints and credentials;
* implementing `RobinhoodBrokerageProvider` against those endpoints (same shape as the crypto client: signed requests, typed responses) and flipping the capability flags;
* compliance review: order placement for securities is regulated activity.
