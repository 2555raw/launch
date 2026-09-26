# fomo (fomo.family): company, tech stack, product, business model, and the token 5wW9… (research notes, as of 2026-09-26)

> **Method and reliability note.** Only WebSearch worked. WebFetch and curl were blocked by the egress policy, so **no page was opened**. Every fact below comes from search-result titles, snippets or the search tool's summaries of them, and **none of it could be checked live**. The session-wide web-search budget (200 calls) ran out partway through. That stopped further checks: more token-lookup variants, confirmation of the DFlow and EVM routing, the "Trader Rewards" mechanics, and competitor details. Dates for X posts were decoded from their snowflake IDs with `(id >> 22) + 1288834974657` ms. The method checks out: the TradedVC Series A post decodes to 2025-11-06 16:43 UTC, the same day as the TechCrunch article. **Source tags:** [P] = official fomo content or a vendor case study (vendor case studies are marketing). [N] = news outlet. [X] = X/Twitter post. [T] = third-party review, affiliate or SEO site. [T] sources are less reliable, and many exist to push referral codes. "(snippet)" = known only from a search snippet or summary. "no verificado" = not found or not confirmed.

## 1. What is fomo? Company, founders, launch, funding, metrics, platforms

### Takeaway
fomo is a consumer social-trading app from FOMO Labs, Inc. (New York). It is mobile-first and self-custodial. Paul Erlanger and Se Yong Park, both formerly of dYdX and Deutsche Bank, launched it in May 2025. Fortune also names Prashan Dharmasena as a co-founder. It has raised about $94M:
- $2M pre-seed
- $17M Series A led by Benchmark (Nov 2025)
- $75M Series B led by Index Ventures at a $550M valuation (Jun 2026)

On Aug 31, 2026 it bought Mobula's data technology for $17M. Users grew from about 120k (first 6 months) to 625k (Jun 2026) and then 1.9M+ (Aug 31, 2026). It runs on iOS, Android and the web (web since Apr 29, 2026).

### Cited Findings
**Identity**
- Legal entity: FOMO Labs, Inc. This comes from a third-party site's non-affiliation disclaimer (snippet) — [FomoAppGuide](https://fomoappguide.com/guides/getting-started/fomo-wallet-deposit-withdraw) [T]. QuickNode lists the app as "fomo by FOMO Labs" — [QuickNode builders guide](https://www.quicknode.com/builders-guide/tools/fomo-by-fomo-labs) [P].
- Official site: fomo.family. Page title: "fomo | Social Crypto Trading App & Web Platform" — [fomo.family](https://fomo.family/). The X handle moved from @tryfomo to @fomo — [X profile](https://x.com/tryfomo?lang=en).
- Apps: the iOS app is "fomo - never miss out" (App Store id6741115427) — [App Store](https://apps.apple.com/us/app/fomo-never-miss-out/id6741115427). The Android package is `family.fomo.app` — [Google Play](https://play.google.com/store/apps/details?id=family.fomo.app&hl=en).
- Google Play description (snippet): "cross-chain trading app… trade any asset across supported chains in one click without bridging, track and visualize your cross-chain portfolio and PnL in real time, view your transaction and trade history" — [Google Play](https://play.google.com/store/apps/details?id=family.fomo.app&hl=en).
- Launch: May 2025 — [Wikipedia "Fomo (platform)"](https://en.wikipedia.org/wiki/Fomo_(platform)); [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T]. Launch press-release headline: "fomo Debuts Groundbreaking Social Crypto Trading App, Aiming to Onboard 10M+ Users" — [Yahoo Finance](https://finance.yahoo.com/news/fomo-debuts-groundbreaking-social-crypto-160000884.html) (publication date no verificado; probably 2025).
- The Series B messaging describes fomo as a "social-first trading application that abstracts away the complexity of wallets, chains, gas fees, and routing" (snippet) — [GlobeNewswire, 2026-06-22](https://www.globenewswire.com/news-release/2026/06/22/3315279/0/en/fomo-raises-75-million-series-b-led-by-index-ventures-to-scale-global-consumer-trading-app.html).
- **Conflict on founding date:** Wikipedia says "founded in 2025" — [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)). One Series B summary says "since its formation in 2024" (snippet; the exact page wasn't confirmed, but it is one of [GlobeNewswire](https://www.globenewswire.com/news-release/2026/06/22/3315279/0/en/fomo-raises-75-million-series-b-led-by-index-ventures-to-scale-global-consumer-trading-app.html) or [insights4.vc](https://insights4.vc/blog/fomo-behind-the-75-series-b/)).
- HQ and culture: the team works in person in NYC, with a new office in SoHo — [web3.career job listing](https://web3.career/staff-frontend-engineer-fomo/150820).

**Founders and team**
- "Founded by Paul Erlanger and Se Yong Park" — [TradedVC X post, 2025-11-06](https://x.com/TradedVC/status/1986474556186411393) [X]; Wikipedia agrees — [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)).
- Fortune (2026-06-22) names three founders, Erlanger, Park and Prashan Dharmasena, "all veterans of the crypto trading platform dYdX" (snippet) — [Fortune](https://fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/); [The Block](https://www.theblock.co/post/405563/crypto-trading-app-fomo-raises-75-million-at-550-million-valuation-in-index-ventures-led-series-b-report). Protos quotes Dharmasena as co-founder — [Protos](https://protos.com/crypto-trading-platform-fomo-denies-hack-of-its-ios-app/).
- Erlanger studied physics at NYU and worked at Deutsche Bank. He joined dYdX in July 2021 and became Head of Business Development. Park worked with him at Deutsche Bank and later at dYdX (snippet) — [insights4.vc](https://insights4.vc/blog/fomo-behind-the-75-series-b/); [Shawn X post, 2026-08-11](https://x.com/shawncandles/status/2087081558956220589) [X]; [LinkedIn](https://www.linkedin.com/in/paul-erlanger/).
- Early marketing said the team had experience "from Uniswap, OpenSea, Square, Google, and more" — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T].
- Headcount: 17 employees at the Series B (Jun 2026). The company planned to "hire more engineers — and maybe even acquire smaller companies" (snippet) — [Fortune](https://fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/). The engineering team is 8 people (3 frontend, 5 backend) per the job ad — [web3.career](https://web3.career/staff-frontend-engineer-fomo/150820). Three Mobula staff joined on Aug 31, 2026 (see below).
- A [T] site says "three former dYdX engineers… 17-person team" — [AXL Research Hub](https://www.axltoken.com/trading-bots/fomo-vs-pump-fun-vs-axiom/). The word "engineers" conflicts with Erlanger's business-development role.

**Funding**
- Pre-seed: $2M — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T] (date and investors no verificado).
- **Series A:** $17M led by Benchmark, announced 2025-11-06, bringing the total to $19M — [TechCrunch](https://techcrunch.com/2025/11/06/why-benchmark-made-a-rare-crypto-bet-on-trading-app-fomo-with-17m-series-a/); [Lookonchain](https://lookonchain.com/feeds/36007); [Phemex](https://phemex.com/news/article/fomo-secures-17-million-in-series-a-funding-led-by-benchmark-33380).
- Benchmark's Chetan Puttagunta led the round and took a board seat, after three people offered to introduce him (snippet) — [Yahoo/TechCrunch](https://finance.yahoo.com/news/why-benchmark-made-rare-crypto-140000489.html). This was a rare consumer-crypto bet for Benchmark, which had made few since 2018 (snippet) — [Lookonchain](https://lookonchain.com/feeds/36007).
- Instead of a classic seed round, the founders wrote a "dream list" of 200 angels, and 140 of them invested (snippet) — [TechCrunch](https://techcrunch.com/2025/11/06/why-benchmark-made-a-rare-crypto-bet-on-trading-app-fomo-with-17m-series-a/). Named angels: Raj Gokal (Solana co-founder), Marc Boiron (Polygon Labs CEO) and Balaji Srinivasan (former Coinbase CTO) — [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)).
- **Series B:** $75M at a $550M valuation, 2026-06-22, led by Index Ventures with Union Square Ventures and Benchmark — [Fortune](https://fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/); [GlobeNewswire](https://www.globenewswire.com/news-release/2026/06/22/3315279/0/en/fomo-raises-75-million-series-b-led-by-index-ventures-to-scale-global-consumer-trading-app.html); [Index Ventures post](https://www.indexventures.com/perspectives/on-chain-trading-goes-mainstream-fomos-75-million-series-b/); [fomo blog](https://fomo.family/blog/fomo-series-b); [Wu Blockchain X, 2026-06-22](https://x.com/WuBlockchain/status/2069059079021232437). Angels included Mark Pincus (Zynga co-founder), Humam Sakhnini (Discord CEO) and Kevin Hartz (Eventbrite co-founder) (snippet) — [The Block](https://www.theblock.co/post/405563/crypto-trading-app-fomo-raises-75-million-at-550-million-valuation-in-index-ventures-led-series-b-report).
- Total disclosed funding is about $94M (2 + 17 + 75) — [Bitcoin Foundation News](https://bitcoinfoundation.org/news/crypto-companies-news/fomo-investments/) (snippet).
- **Acquisition (2026-08-31):** fomo bought Mobula's proprietary software and IP in a deal valued at $17M. Three Mobula people joined: founder Sacha Marcus, CTO Sacha Delhoux and Head of Infrastructure Cyril Conan — [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/31/3353368/0/en/fomo-acquires-mobula-technology-to-bring-critical-on-chain-infrastructure-in-house.html); [Axios Pro](https://www.axios.com/pro/fintech-deals/2026/08/31/fomo-mobula-data-indexing-acquisition); [Solana Compass](https://solanacompass.com/news/fomo-acquires-mobulas-on-chain-data-technology-for-17m-three-engineers-joining-the-team); [Crypto Briefing](https://cryptobriefing.com/fomo-acquires-mobula-technology-17m/); [AlleyWatch](https://www.alleywatch.com/2026/08/fomo-acquisition-mobula-on-chain-data-crypto-trading-infrastructure-web3-price/); [Phemex](https://phemex.com/news/article/fomo-acquires-mobula-data-indexing-software-and-team-for-17-million-95133).

**Metrics timeline** (company-reported or third-party; none checked live)

| Date | Metric | Source |
|---|---|---|
| 2025 (beta) | Usage grew 20x in a single week | [Privy case study](https://privy.io/blog/turning-trading-into-a-social-experience-with-fomo) [P] |
| First 6 months (~May–Nov 2025) | 120,000+ users | [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)) |
| Undated (before Jun 2026) | $2.5B volume, 470k+ users, "#1 cross-chain trading app in crypto" (marketing claim) | [Crossmint case study](https://www.crossmint.com/announcement/fomo-crossmint-token-checkout) [P] |
| 2026-06-22 | 600k+ users, $4B+ cumulative volume, 110M social interactions, 68k first-time crypto buyers funded through Apple Pay | [GlobeNewswire](https://www.globenewswire.com/news-release/2026/06/22/3315279/0/en/fomo-raises-75-million-series-b-led-by-index-ventures-to-scale-global-consumer-trading-app.html) / [Index](https://www.indexventures.com/perspectives/on-chain-trading-goes-mainstream-fomos-75-million-series-b/) (snippet) |
| 2026-06-22 | 625k users, $4B volume, about 3,500 new users/day, "lists more assets than Coinbase", available globally | [Fortune](https://fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/) (snippet) |
| 2026-06-13 | Perps about 2 days after launch: ~870 users, ~$6,330 revenue, ~$20M volume (third-party analyst) | [ryandcrypto X](https://x.com/ryandcrypto/status/2065871829168771140) [X] |
| ~Aug 2026 | "Sixth consecutive week of all-time-high trading volume"; on 2026-08-06 fomo briefly passed Axiom in daily fees | [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/) |
| Week ending 2026-08-08 | Weekly revenue ATH of $2.64M, above Jupiter and Phantom in weekly Solana protocol revenue. Q3 2026 gross protocol revenue was $13.31M through mid-August (DefiLlama income statement) | Snippet; the source is one of [Solana Compass](https://solanacompass.com/news/fomo-tops-hyperliquid-in-24-hour-protocol-revenue-as-solana-copy-trading-app-extends-its-run), [insights4.vc](https://insights4.vc/blog/fomo-behind-the-75-series-b/) or [Our Crypto Talk](https://ourcryptotalk.com/blog/fomo-app-social-crypto-trading) (not confirmed); underlying data from [DefiLlama](https://defillama.com/protocol/fomo) |
| 2026-08-21 | Top 5 in US Finance on Apple's App Store, above Cash App (and Kalshi, per the headline); briefly reached #3 | [Bitcoin.com News](https://news.bitcoin.com/finance/fomo-trading-app-top-5-us-finance-charts/) |
| 2026-08-31 | 1.9M+ users (more than doubled since the start of July); 30,000+ new users per day | [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/31/3353368/0/en/fomo-acquires-mobula-technology-to-bring-critical-on-chain-infrastructure-in-house.html); [Solana Compass](https://solanacompass.com/news/fomo-acquires-mobulas-on-chain-data-technology-for-17m-three-engineers-joining-the-team) |
| 2026-08-31 | Daily spot volume "nears $250M" (headline) | [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/crypto-trading-platform-fomo-acquires-104031910.html) |
| 2026-08-31 | "Trading volume surges toward $2.8B" (headline; the period is unclear) | [citybiz](https://www.citybiz.co/article/896190/fomo-acquires-mobula-technology-as-trading-volume-surges-toward-2-8b/) |
| Jul–Sep 2026 | "Now serving 2M+ users" (job ad) | [web3.career](https://web3.career/staff-frontend-engineer-fomo/150820) (snippet) |
| Sep 2026 (a Friday) | $1.76M daily revenue vs Pump.fun's $1.1M. Over 30 days: Pump.fun $57M+ vs fomo $17.6M (DefiLlama data) | [Cointelegraph](https://cointelegraph.com/news/fomo-pumpfun-revenue-app-solana) |
| Sep 2026 | $1.1M revenue on Sep 1 (the ATH at that time) and "$13.8M revenue for the month" (probably month-to-date; low confidence) | [Coinlive](https://www.coinlive.com/en/news/fomo-is-popular-but-i-advise-you-not-to-fomo) (snippet) |

**Platforms**
- The web app launched on 2026-04-29 at fomo.family. It uses the same account and product as mobile: cross-chain swaps, social feed, leaderboards, theses, portfolio and PnL. There is no downloadable desktop program. Sources: [fomo blog "Announcing fomo web"](https://fomo.family/blog/announcing-fomo-web); the date comes from [T] summaries on [fomofamilyapp.com](https://fomofamilyapp.com/web-app) and [fomobyte](https://fomobyte.com/fomo-web-app/).
- A TradingView charting partnership for fomo Web (April 2026) is claimed only by [T] sites ([fomofamilyapp.com](https://fomofamilyapp.com/web-app), [fomobyte](https://fomobyte.com/fomo-web-app/)). No verificado on an official source.

### Inferences
- Growth sped up sharply in Q3 2026: from 625k (Jun 22) to 1.9M+ (Aug 31), about 3x in roughly 10 weeks. That period overlaps with perps (Jun 11), Robinhood Chain (July), Clans (Aug 10) and the App Store top-5 run (Aug 21). The data doesn't show which of these caused the growth.
- Revenue run rate: $17.6M per 30 days is about $210M a year. That is my own arithmetic, not a company figure. The $550M Series B valuation was set before most of this ramp.
- The fee and volume figures are roughly consistent: $250M/day × 0.5% ≈ $1.25M/day, in line with reported daily revenue of $1.1–1.76M. This ignores minimum fees, perps and referral payouts.
- Cumulative volume is almost certainly well above the last official figure ($4B, June 2026), but no updated official number was found.

### Gaps
- Incorporation date (2024 vs 2025): no verificado.
- Pre-seed date and investors: no verificado.
- DAU/MAU, retention, share of funded accounts, CAC: no verificado. Nothing found publishes them.
- Official cumulative volume after June 2026: no verificado. The period behind citybiz's "$2.8B" is unclear.
- Whether the "2M+ users" in the job ad is an official milestone: no verificado.

## 2. Supported chains and the "one cash balance": bridging, routing, swap aggregators

### Takeaway
Six chains sit behind one USDC "cash" balance: Solana, Base, BNB Chain, Monad, Ethereum and Robinhood Chain. Cross-chain execution runs on **Relay**. Relay coordinates routing, gas and asset conversion, holds funds in on-chain escrow until execution is verified, and lets fomo sponsor destination-chain fees. fomo's own safety page says Solana trades route through **DFlow**. No evidence was found that fomo uses Jupiter (directly), 0x, 1inch, the OKX DEX API, LI.FI, deBridge or Across.

### Cited Findings
- Six chains with one cash balance and "no bridging or network switching" (snippet) — [Coinmonks/Medium guide, Aug 2026](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) [T]. "Users can buy any token on Solana, Robinhood Chain, BNB Chain, Base, Ethereum or Monad" (snippet) — [QuickNode builders guide](https://www.quicknode.com/builders-guide/tools/fomo-by-fomo-labs).
- Chain rollout: the early product was Solana and Base ("log in with Apple, Google, or email and start trading instantly on Solana and Base"). The same Privy post also mentions "Solana, Base, and BNB Chain" — [Privy](https://privy.io/blog/turning-trading-into-a-social-experience-with-fomo) [P] (post date no verificado).
- Monad: "When Monad went live, fomo added support through Relay – and users were immediately able to trade Monad assets like any others… No new onboarding flow, no chain-specific UX" — [Relay case study](https://radar.relay.link/how-fomo-built-instant-trading-on-relay/) [P].
- Robinhood Chain: support was announced around 2026-07-10 — [Binance Square](https://www.binance.com/en/square/post/07-10-2026-fomo-now-supports-robinhood-chain-343072027528961). "Robinhood Chain joined in July 2026 and brought tokenized stocks such as AAPL, TSLA and NVDA into the same feed as the memecoins" (snippet) — [Coinmonks](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) [T]. See also [Toobit: "Fomo expands on Robinhood Chain as trading rises"](https://www.toobit.com/en-US/news/fomo-expands-on-robinhood-chain-as-trading-rises).
- **How Relay is used** [P]:
  - "fomo offers users a single USDC spending balance while [Relay] coordinates routing, gas, and asset conversion behind the scenes. To users, trading feels like it's happening on one network, even though liquidity lives across many."
  - Cross-chain execution "couldn't be a fallback. It had to be the default."
  - "Funds are held in onchain escrow until execution is verified."
  - fomo uses Relay's fee sponsorship to cover "all destination chain fees – including gas and any top-up amounts."
  - "Users only pay the origin chain gas to initiate the trade, with fomo covering the gas on Solana."
  - Sources: [Relay radar](https://radar.relay.link/how-fomo-built-instant-trading-on-relay/); mirror on [LinkedIn](https://www.linkedin.com/pulse/how-fomo-built-instant-crosschain-trading-relay-relayprotocol-uc23e).
- fomo's cross-chain legs can be seen in Relay's public feed. An open benchmark measured "FOMO and BasedBot cross-chain legs through Relay's public feed (bridge cost per origin chain)" — [OpenChainBench PR #2459](https://github.com/ChainBench/OpenChainBench/pull/2459).
- Solana routing: "trades execute through DFlow for secure, fair order routing with MEV protection" (snippet) — [fomo.family/answers/is-fomo-app-safe](https://fomo.family/answers/is-fomo-app-safe) [P]. Context: DFlow's aggregator also quotes into Jupiter — [DFlow X post](https://x.com/DFlowProtocol/status/1912901489678299363).
- Gas: Series B coverage says fomo "waives gas fees" (snippet) — [Value The Markets](https://www.valuethemarkets.com/cryptocurrency/news/fomo-trading-app-secures-75-million-funding-at-550-million-valuation). "Gas, priority fees, and token rent are covered by FOMO on every chain except Ethereum" (snippet) — [Coinmonks](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) [T].
- Referral payouts arrive as USDC in the cash balance and can be withdrawn on any supported chain (snippet) — [AirdropAlert](https://airdropalert.com/airdrops/fomo-memecoin-trading-app/) [T].
- Wikipedia's framing: "a single balance across multiple blockchain networks without using bridges or paying gas fees" — [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)).

### Inferences
- "No bridges" describes the user experience, not the plumbing. Each cross-chain buy is a Relay cross-chain order (escrow on the origin chain, execution on the destination). The detail that solvers fill orders is general knowledge about Relay and was not checked here.
- Relay says users "only pay the origin chain gas… with fomo covering the gas on Solana". That suggests Solana is usually the origin chain, so the USDC cash balance probably sits mostly on Solana. This is a hypothesis (no verificado).
- Adding a chain is mostly "additive". The work is Relay coverage plus Privy wallet support plus data coverage, which explains how fomo could add Monad at launch and Robinhood Chain quickly. QuickNode also calls expansion "additive, not architectural".
- In Aug 2026 Pump.fun copied the idea of "one unified USDC account funding multichain swaps" (see §8), so the pattern is becoming table stakes.

### Gaps
- EVM same-chain swap aggregator (0x, 1inch, OKX DEX API, Relay's own swaps, Uniswap routing…): no verificado.
- Whether fomo uses Jupiter directly on Solana, beyond DFlow: no verificado.
- LI.FI, deBridge, Across: no evidence found (no verificado).
- Which chain or chains hold the USDC balance, and how sells settle back into USDC across chains: no verificado.
- Dates when BNB Chain and Ethereum were added, and Robinhood Chain's mainnet or testnet status: no verificado.

## 3. Wallet and custody model, onboarding, fiat on-ramps, gas abstraction

### Takeaway
- **Wallets:** Privy embedded wallets. They are self-custodial and created at sign-up with Apple, Google or email. Users never see a seed phrase, the key is split with Shamir's Secret Sharing, and users can export it.
- **Fiat:** Apple Pay and card purchases run through **Crossmint Token Checkout**, with no KYC for these buys. The Block examined this on Sep 1, 2026 because purchases were coded as "digital goods media". Visa moved to close that loophole on Sep 19, 2026.
- **Gas:** a fomo-operated fee payer on Solana, plus Relay fee sponsorship on destination chains.

### Cited Findings
- "With Privy, every fomo user gets a secure, self-custodial wallet the moment they sign up… log in with Apple, Google, or email and start trading instantly… all wallet creation, key management, and transaction signing happen seamlessly behind the scenes, while users remain in full control of their assets" — [Privy blog](https://privy.io/blog/turning-trading-into-a-social-experience-with-fomo) [P].
- Keys are managed through Privy, not held by FOMO Labs in a company account. Shamir's Secret Sharing splits the key into shares on separate systems, and "no single party holds the complete key". Users never see a seed phrase (snippet) — [Datawallet](https://www.datawallet.com/crypto/fomo-app-explained) [T]. Official explainer (only a snippet was seen) — [fomo.family "How fomo Keeps Your Crypto Secure"](https://fomo.family/blog/learn/fomo-security-wallet-architecture) [P].
- Users can export their private key. According to the Terms, exported keys "will be transmitted to you unencrypted by Privy, a third-party service provider", and fomo is "not responsible for the security or safety of your digital assets". This is the Terms as quoted in [T] summaries (snippet) — [fomo Terms](https://fomo.family/terms); [Vaulted](https://vaulted.finance/blog/fomo-app-withdrawal) [T]; [fomoappreview](https://fomoappreview.com/fomo-app-withdrawals/) [T].
- Apple Pay and card purchases: "fomo integrated Crossmint's token checkout to let anyone buy tokens with Apple Pay with one-click — no KYC, wallet setup, bridging, or gas fees. Crossmint handles everything: payment processing, fraud protection, and token delivery." Weekly active traders rose 7x within weeks of launch, and 68,000+ first-time crypto buyers were onboarded — [Crossmint](https://www.crossmint.com/announcement/fomo-crossmint-token-checkout) [P].
- **The Block, 2026-09-01:**
  - Users of Robinhood Wallet and fomo can buy memecoins such as WIF with credit cards through Apple Pay or Google Pay, with no KYC forms. Crossmint powers these purchases.
  - In The Block's tests, Visa and Mastercard purchases were coded as "digital goods media" and earned the usual card rewards.
  - Chase said the Visa transaction was not flagged as crypto, that the category was wrong, and that it had opened a case with Visa.
  - Crossmint stands by the classification, citing the SEC's view that some memecoins can be treated as collectibles.
  - Sources: [The Block](https://www.theblock.co/news/business/2026-09-01-buying-memecoins-with-credit-cards-on-robinhood-wallet-fomo-sidestep-card-network-crypto-rules-411911); [Bloomingbit ("JPMorgan seeks Visa probe")](https://en.bloomingbit.io/feed/news/119568); [CryptoRank](https://cryptorank.io/news/feed/4fe51-robinhood-wallet-fomo-credit-card-memecoin-purchases).
- **The Block, 2026-09-19:** Visa is moving to stop crypto payment processors from putting memecoin purchases in a "digital media" category — [The Block](https://www.theblock.co/news/regulation/2026-09-19-visa-to-close-crossmint-memecoin-rewards-loophole-following-the-block-investigation-report-415866).
- Fee payer: rebutting a hack claim, co-founder Dharmasena said the account "has no transaction signed by FOMO's fee payer" — [Protos](https://protos.com/crypto-trading-platform-fomo-denies-hack-of-its-ios-app/). This shows fomo runs its own fee payer on Solana to sponsor gas.
- Deposits and withdrawals: third-party guides describe "3 ways in" and cases where withdrawals fail — [FomoAppGuide](https://fomoappguide.com/guides/getting-started/fomo-wallet-deposit-withdraw) [T]; [Vaulted](https://vaulted.finance/blog/fomo-app-withdrawal) [T] (details no verificado).
- Early marketing: "buy any token using Apple Pay or debit cards, with secure deposits and immediate withdrawals" — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T].

### Inferences
- The architecture is self-custody underneath with a fintech-style experience on top. Nearly every hard piece is bought, not built:
  - Privy for keys
  - Crossmint for fiat-to-token
  - Relay for cross-chain
  - fomo's own fee payer for gas
- The Visa change (Sep 19, 2026) threatens the cheapest onboarding funnel: card purchases with no KYC that also earned card rewards. This is the funnel behind the 68k first-time buyers. More friction, higher costs or KYC on card buys may follow; this is speculative.
- The self-custody framing matters legally. It places fomo in the SEC staff's "Covered User Interface Provider" category (see §9).

### Gaps
- MoonPay, Coinbase Onramp, Stripe or Transak: no evidence (no verificado).
- Turnkey, Dynamic, Coinbase CDP or generic MPC: no evidence. Privy is the only wallet provider named.
- Whether fomo's current Privy setup uses Shamir sharing or a TEE-based scheme; card purchase limits; KYC thresholds: no verificado.

## 4. Data and infrastructure, real-time feed, notifications, frontend stack, jobs, open source

### Takeaway
The stack is TypeScript throughout: an Expo (React Native) mobile app, a React Router + Vite web app, and a TypeScript backend. The engineering team is small (8 people). Infrastructure leans heavily on vendors:
- QuickNode Enterprise as the primary Solana RPC, with traffic spread across several providers
- Relay, Privy, Crossmint, DFlow, and Hyperliquid with Trade[XYZ]
- Mobula for market and wallet data. fomo bought Mobula's technology for $17M (Aug 31, 2026) to bring indexing in-house.

### Cited Findings
- Staff Frontend Engineer job ad:
  - The role owns "a mobile app built with Expo and a web app built with React Router + Vite", working in TypeScript. "Our backend services are in TypeScript." Solana or EVM experience is preferred, and candidates should be "AI-native".
  - The engineering team is 8 people (3 frontend, 5 backend), in person in NYC (SoHo). The ad says fomo is "now serving 2M+ users".
  - The salary band is $250k–$300k.
  - Sources: [web3.career](https://web3.career/staff-frontend-engineer-fomo/150820); [Solana Jobs](https://jobs.solana.com/companies/fomo-2-12bbd144-f1c8-44a3-bd2a-ed54a499ceea/jobs/84483801-staff-frontend-engineer); [freehire](https://freehire.me/jobs/staff-frontend-engineer-fomo-labs-onpea2di); applicant tracking system: [Ashby "fomo Labs"](https://jobs.ashbyhq.com/fomo-labs).
- QuickNode case study [P]:
  - fomo "moved core Solana workloads to Quicknode Enterprise".
  - It sustains "high RPS", with "feeds remaining consistent under burst traffic".
  - "Traffic distributes across providers, with Quicknode supporting primary Solana RPC access."
  - "18× growth".
  - "Expansion across additional chains becomes additive, not architectural."
  - Source: [QuickNode](https://www.quicknode.com/case-studies/fomo-real-time-social-trading-at-scale-on-solana).
- Mobula's technology "indexes blockchain data, aggregates it across networks, normalizes it, and exposes it through APIs/data feeds so applications can retrieve market and wallet data without querying multiple blockchains themselves" (snippet) — [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/31/3353368/0/en/fomo-acquires-mobula-technology-to-bring-critical-on-chain-infrastructure-in-house.html). Axios headline: "Fomo brings Mobula's data layer in-house in $17M deal" — [Axios Pro](https://www.axios.com/pro/fintech-deals/2026/08/31/fomo-mobula-data-indexing-acquisition).
- Notifications: users "get notified when traders they follow enter positions" (snippet) — [fomo blog: Perpetuals](https://fomo.family/blog/perpetuals-now-on-fomo) [P]. The app also sends "notifications on market movements" — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T].
- No engineering deep-dive posts were found. fomo.family/blog hosts product posts and "learn" articles — [fomo blog](https://fomo.family/blog).
- No official open-source repositories were found. Other things named "FOMO" that should not be confused with fomo.family: [docs.onfomo.com](https://docs.onfomo.com/), [fomoapi.io](https://fomoapi.io/docs), and the GitHub repo [askspecter/fomotech](https://github.com/askspecter/fomotech) (any link to FOMO Labs is no verificado).
- No evidence that fomo uses Codex, Birdeye, DexScreener or Helius. Searches returned only the vendors' own pages, e.g. [Codex](https://www.codex.io/).

### Inferences
- Mobula was very likely fomo's market-data vendor before the acquisition, given the wording "brings… in-house". Probable, not confirmed.
- The frontend stack is ordinary and easy to reproduce. fomo's edge comes from execution partnerships, data and network effects, not from UI technology.
- The web app uses React Router + Vite rather than Next.js, which suggests a single-page app. The crawlable token, answers and blog pages may be rendered separately; how is unknown.

### Gaps
- Real-time transport (WebSockets, SSE or gRPC), database, queues, hosting, push provider (Expo Notifications? OneSignal?), analytics: no verificado.
- Whether fomo uses Helius, Triton or Jito for Solana transaction landing: no verificado.

## 5. Product features and business model

### Takeaway
The core loop:
1. Trades are public and verified.
2. Other users see them through the feed, follows and notifications.
3. They buy with one tap.
4. Their own trade, plus an optional thesis, becomes content.
5. Leaderboards and clans add competition.
6. Referrals earn a share of revenue.

The business model is a fee of 0.5% on each buy and each sell, with a minimum on small Solana trades. Trades are gasless except on Ethereum. Perps add revenue, probably through builder fees (not confirmed). Referrers earn 25% of their referrals' fees in USDC. There is no token or points program.

### Cited Findings
**Feed, following, portfolio**
- Users see what friends and top traders are buying in real time, which "turns insights that once lived in private group chats into a shared, transparent feed". Trending tokens can be bought in seconds with Apple Pay or a card — [Privy](https://privy.io/blog/turning-trading-into-a-social-experience-with-fomo) [P].
- Trades are publicly visible; users can monitor other traders and take part in leaderboards — [Wikipedia](https://en.wikipedia.org/wiki/Fomo_(platform)).
- Users can follow top traders, see live positions and get notifications — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T]. They can also track cross-chain portfolio and PnL in real time — [Google Play](https://play.google.com/store/apps/details?id=family.fomo.app&hl=en).
- Filters: headline "FOMO helps users filter traders and tokens" — [Toobit](https://www.toobit.com/en-US/news/fomo-helps-users-filter-traders-and-tokens).

**Theses (written reasons attached to trades)**
- "Every token page on FOMO shows the traders currently holding it, their entry price, their unrealized gain or loss, and, often, their actual thesis for the trade" (snippet) — [Datawallet](https://www.datawallet.com/crypto/fomo-app-explained) [T].
- A thesis is a short social post explaining why someone bought, sold or is holding. "FOMO's token page puts the chart, holders, swaps and theses in one place, and every thesis carries the poster's position size and PnL underneath it" (snippet) — [Crypto Daily, Sep 2026](https://cryptodaily.co.uk/2026/09/what-is-a-fomo-app); [Kliment Dukovski](https://klimentdukovski.com/articles/fomo-app-review/) [T].
- The holder table shows each wallet's position, PnL, average entry, hold time and whether it posted a thesis. It has "Thesis only" and "Friends only" filters (snippet) — [fomotrading.app/terminal](https://fomotrading.app/terminal/) [T].
- Perps are also integrated with "feed, leaderboard, thesis, profiles" — [fomo blog](https://fomo.family/blog/perpetuals-now-on-fomo) [P].

**Clans (August 2026)**
- "Clans are now live. Form a family. Trade as a squad. Build an audience together. Join more than 50 clans today." — [fomo X post, 2026-08-10](https://x.com/fomo/status/2086878259279450404) [X/P].
- How clans work, per [T] sources (snippet) — [manuallyreviewed, Aug 2026](https://manuallyreviewed.com/fomo-app-review/); [Crypto Daily](https://cryptodaily.co.uk/2026/09/what-is-a-fomo-app):
  - Each clan has its own feed of member trades, its own leaderboard, and a "card that sums up the whole run".
  - A trader can belong to one clan at a time, and some clans are invite-only.
  - Each clan's combined P&L is ranked against every other clan.
  - "Nobody pools money. Every member trades their own balance and carries their own risk."
  - Invites arrived on Sep 1, and there were 150+ clans by then.

**Perps (Hyperliquid)**
- Launched 2026-06-11: "Perpetuals are now live on fomo, powered by @HyperliquidX and @tradexyz. Equity, pre-IPO, crypto, indices, and commodities perps, all from one app." — [fomo X post](https://x.com/fomo/status/2065102110673277330?lang=en); [fomo blog "Perpetuals, now on fomo"](https://fomo.family/blog/perpetuals-now-on-fomo) [P].
- Markets (snippet):
  - Crypto: BTC, ETH, SOL, HYPE
  - US equities: NVDA, GOOGL, AMD, MU, SNDK
  - Pre-IPO: SpaceX
  - Indices: S&P 500, Nasdaq 100, Kospi 200, Nikkei 225
  - Commodities: oil, silver, gold, copper, natural gas
- Perps are **not available to US persons** (snippet) — [fomo blog](https://fomo.family/blog/perpetuals-now-on-fomo). A [T] mirror of this information: [fomotrading.app/perps](https://fomotrading.app/perps/).
- Market-reaction headline (speculative): "HYPE Price Jumps 17% as Hyperliquid-Powered Fomo Launch Fuels Trading Frenzy" — [Coinpedia](https://coinpedia.org/price-analysis/hype-price-jumps-17-as-hyperliquid-powered-fomo-launch-fuels-trading-frenzy/).

**Tokenized stocks:** added with Robinhood Chain in July 2026 (AAPL, TSLA, NVDA in the same feed); see §2.

**Referrals, rewards, points**
- The referrer earns 25% of their referrals' trading fees. The referred user gets 10% off fees for the life of the account. Rewards are paid in USDC into the cash balance, and "well over a million dollars" has been paid out (snippet) — [AirdropAlert](https://airdropalert.com/airdrops/fomo-memecoin-trading-app/); [fomoappreview](https://fomoappreview.com/fomo-app-referral-code/); [Datawallet](https://www.datawallet.com/crypto/fomo-referral-code) [T].
- "Trader Rewards" is named as an acquisition lever alongside referrals and Clans (snippet) — [Crypto Daily](https://cryptodaily.co.uk/2026/09/what-is-a-fomo-app) [T]. How it works: no verificado.
- No token, points or airdrop: "FOMO Labs has neither issued a token nor committed to one" — [AirdropAlert](https://airdropalert.com/airdrops/fomo-memecoin-trading-app/); [airdrops.io](https://airdrops.io/fomo/) [T].

**Fees**
- A "transparent 0.5% transaction fee", and gas is waived — [Medium @blog_crypto](https://medium.com/@blog_crypto/fomo-family-crypto-app-ae10b1bd17cb) [T]; [Value The Markets](https://www.valuethemarkets.com/cryptocurrency/news/fomo-trading-app-secures-75-million-funding-at-550-million-valuation) (snippet).
- The fee is charged on both buy and sell, so a round trip costs about 1% before slippage — [intercom help center "cryptoreferralcodes"](https://intercom.help/cryptoreferralcodes/en/articles/16595991-fomo-app-fees-explained-2026-the-0-95-minimum-that-decides-everything) [T].
- **Conflict on the Solana minimum fee:**
  - One version: a minimum of about $0.95, which dominates below about $190 per trade ($20 → 4.75% effective, $50 → 1.90%, $100 → 0.95%) — [intercom](https://intercom.help/cryptoreferralcodes/en/articles/16595991-fomo-app-fees-explained-2026-the-0-95-minimum-that-decides-everything) [T]; [FomoAppGuide](https://fomoappguide.com/guides/fees/fomo-fees-explained) [T].
  - Another version: "a flat minimum of up to 0.50 USDC on orders under 100 USDC, or 0.50% above" — [Coinmonks, Aug 2026](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) [T]. The schedule may have changed over time.
- By chain: 0.50% on Base, BNB Chain, Monad and Robinhood Chain; 0.50% plus network fees on Ethereum — [Coinmonks](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) [T].
- Official fee pages exist but were not read: [fomo.family/answers/memecoin-trading-app-lowest-fees](https://fomo.family/answers/memecoin-trading-app-lowest-fees) and the [Terms](https://fomo.family/terms).
- Revenue is tracked on [DefiLlama](https://defillama.com/protocol/fomo), which "tracks its trading fees as protocol revenue" — [Adaora X post, 2026-08-11](https://x.com/adaora_crypto/status/2087133965513605428) [X].

**Copy trading:** some [T] sites mention "copy-trading workflows" — [Token Metrics](https://tokenmetrics.com/blog/fomo-vs-pump-fun-vs-axiom/). No official source confirms automated copy trading (no verificado).

### Inferences
- The key social-proof idea is combining a thesis with verified PnL. The text is attached to a real on-chain position with its size and PnL, so readers can check whether the author has skin in the game. That produces less noise than shilling on X.
- Clans deliberately avoid pooled funds. That keeps fomo away from fund management while adding group identity and competition.
- The business model is essentially a tax on volume (0.5% per side, with a minimum), so it is very sensitive to the memecoin cycle. Perps (probably earning fees through Hyperliquid builder codes, not confirmed) and tokenized stocks diversify revenue.
- Paying referrers 25% for the life of the account is what feeds the affiliate and SEO ecosystem described in §9.

### Gaps
- Perps fee schedule and builder fee: no verificado.
- How "Trader Rewards" works: no verificado (search budget exhausted).
- Leaderboard method (% or $ PnL, time windows) and anti-wash-trading rules: no verificado.
- Moderation of theses: no verificado.

## 6. URL structure /tokens/{chain}/{address} and what a token page shows

### Takeaway
Token pages are public and crawlable at `fomo.family/tokens/{chain}/{mint or contract}`. Referrals are attributed with `?r={username}`. According to third-party descriptions, each page shows:
- a chart
- holders, with position, PnL, average entry and hold time
- swaps
- theses

The site also uses programmatic SEO under `/answers/*` and `/blog/learn/*`.

### Cited Findings
- Indexed examples (search results). The last one is indexed under the generic title "fomo | Social Crypto Trading App & Web Platform":
  - [/tokens/solana/Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump](https://fomo.family/tokens/solana/Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump)
  - [/tokens/solana/24GWZn5HerwLTVoZuC3H7Kxg6jLFMvroA1hTU4uWpump](https://fomo.family/tokens/solana/24GWZn5HerwLTVoZuC3H7Kxg6jLFMvroA1hTU4uWpump)
  - [/tokens/solana/8RNUw4N655VSrZKuhGdywhbSMDTrheguFPfxbpE2NZHQ](https://fomo.family/tokens/solana/8RNUw4N655VSrZKuhGdywhbSMDTrheguFPfxbpE2NZHQ)
  - [/tokens/solana/9HHTQ7YMx82E987cNqF9KczyZrfKgqvKNyA2yHSVpump?r=YappiestMainMite](https://fomo.family/tokens/solana/9HHTQ7YMx82E987cNqF9KczyZrfKgqvKNyA2yHSVpump?r=YappiestMainMite) (a referral parameter in the wild)
  - [/tokens/solana/HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR](https://fomo.family/tokens/solana/HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR)
- Page contents, per third-party descriptions (snippet) — [Crypto Daily](https://cryptodaily.co.uk/2026/09/what-is-a-fomo-app); [Datawallet](https://www.datawallet.com/crypto/fomo-app-explained); [Kliment Dukovski](https://klimentdukovski.com/articles/fomo-app-review/):
  - The chart, holders, swaps and theses are on one page.
  - Each thesis shows the poster's position size and PnL.
  - The holder table shows position, PnL, average entry, hold time and whether the holder posted a thesis.
  - Filters: "Thesis only" and "Friends only".
- Other official SEO sections:
  - `/answers/`: [is-fomo-app-safe](https://fomo.family/answers/is-fomo-app-safe), [memecoin-trading-app-lowest-fees](https://fomo.family/answers/memecoin-trading-app-lowest-fees)
  - `/blog/learn/`: [security architecture](https://fomo.family/blog/learn/fomo-security-wallet-architecture), [fomo vs Phantom](https://fomo.family/blog/learn/fomo-vs-phantom-wallet)
  - `/blog/`: [Series B](https://fomo.family/blog/fomo-series-b), [web launch](https://fomo.family/blog/announcing-fomo-web), [perps](https://fomo.family/blog/perpetuals-now-on-fomo)

### Inferences
- `?r=` turns every shared token link into a landing page with referral attribution. The chain is: share → sign-up → 10% off for the new user → 25% of their fees to the sharer.
- Slugs for EVM chains probably follow `/tokens/{base|bnb|ethereum|monad|robinhood…}/{0x…}`, but the pattern is not verified.
- fomo has a page for any tradable token, so a page existing says nothing about fomo endorsing the token.

### Gaps
- Exact EVM chain slugs, rendering method and meta tags / OG cards: no verificado, because the pages could not be fetched.
- Whether token pages show risk signals (mint or freeze authority, top-holder concentration): no verificado.

## 7. Identity of the token 5wW9mhbwq1HTFh341iimpmrqBB4mfxdXiYhdYBL7hUnp (Solana)

### Takeaway
**Not identified.** Seven different searches found no indexed page containing this address. Its name, ticker, launchpad, market-cap history and purpose are all **no verificado**. It needs a live lookup on a block explorer, which was not possible in this environment. It should not be linked to fomo the company: fomo has no token, and it has pages for any tradable token.

### Cited Findings
The seven searches and what they returned:

| Search | Result |
|---|---|
| Bare address | Only unrelated results: a different Solscan account (5rkPDK…), XRPL pages, EU court pages. Example: [unrelated Solscan account](https://solscan.io/account/5rkPDK4JnVAumgzeV2Zu8vjggMTtHdDtrsd5o9dhGZHD) |
| Address + "dexscreener" | Only generic DexScreener pages, e.g. [DEX Screener Solana](https://dexscreener.com/solana) |
| Address + solscan/gmgn/birdeye/pump.fun/jupiter | Only unrelated pump.fun tokens and accounts, e.g. [Solscan token GcKE…pump](https://solscan.io/token/GcKE9Qtz62Qxt83Fv5QmW9sVcPr9bHKjKPynCLiZpump) |
| Address restricted to explorer and aggregator domains (solscan, dexscreener, gmgn, birdeye, geckoterminal, coingecko, jup.ag, pump.fun, rugcheck, CoinMarketCap, Coinbase, defined.fi and others) | No match |
| 17-character prefix "5wW9mhbwq1HTFh341" | No crypto results |
| Address + "token", restricted to X, GitHub, Medium, DEXTools, Birdeye, CoinCarp, GMGN and others | No match |
| "fomo.family tokens solana 5wW9mhbwq1HT" | Only other fomo token pages (listed in §6) |

- The address looks like a valid Solana base58 public key (44 characters). Unlike several indexed fomo token URLs for pump.fun tokens (e.g. [Ai66…ppump](https://fomo.family/tokens/solana/Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump)), it does **not** end in "pump".
- fomo has no official token (§5). The "fomo"-named Solana tokens that showed up in searches all have **different** addresses, so none of them is 5wW9…:
  - "Fomo Family (FAM)": [Coinbase price page](https://www.coinbase.com/price/fomo-family-solana-famptu6ghv5m3utjfx5qsnwhftz1tlqga1aydt27atf-token) (the address in the URL slug is lowercased)
  - "$fomofamily" `BckxxeyFgppRwf8o8TY317UgGWLtrYVVnehrsVDbpump`: [Solana Compass](https://solanacompass.com/tokens/BckxxeyFgppRwf8o8TY317UgGWLtrYVVnehrsVDbpump)
  - "$FOMO" `3npNVa2KCaAmu5Lc6vrfkuaWZe7oYtBho2zVpWLxVzJF`: [Solana Compass](https://solanacompass.com/tokens/3npNVa2KCaAmu5Lc6vrfkuaWZe7oYtBho2zVpWLxVzJF)
  - "Fomo (FOMO)" `ZxBon4vcf3DVcrt63fJU52ywYm9BKZC6YuXDhb3fomo`: [Solscan](https://solscan.io/token/ZxBon4vcf3DVcrt63fJU52ywYm9BKZC6YuXDhb3fomo)

### Inferences
- The missing "pump" suffix suggests, but does not prove, that it is not a standard pump.fun token. It could come from another launchpad, be an older or non-launchpad SPL or Token-2022 token, or be a low-liquidity token that search engines never indexed. The suffix conventions of launchpads are general knowledge, not verified here.
- Search engines saying nothing about an address usually means little attention or liquidity, or a very recent token. That is weak evidence either way.

### Gaps
- Name, ticker, deployer, launchpad, creation date, supply, liquidity, holders, market-cap history, utility: **all no verificado.**
- To resolve it, look it up live at solscan.io/token/{address}, dexscreener.com/solana/{address}, rugcheck.xyz/tokens/{address}, gmgn.ai/sol/token/{address}, or the fomo page itself.

## 8. Competitors and differentiation

### Takeaway
fomo competes on consumer onboarding, social proof, and many chains and asset types in one app. Axiom still leads Solana professional trading by volume and transactions. Pump.fun is the most direct rival: it copied fomo's social features and unified USDC balance on Aug 7, 2026, then offered payments to fomo traders to switch. No data was gathered on Photon, BullX, Padre, Moonshot, Vector, Believe, Bags, Zora / Base App or Phantom, because the search budget ran out.

### Cited Findings
**Axiom**
- A web terminal focused on token scanning, wallet tracking and filtering by holder concentration, developer holdings, sniper activity, liquidity and volume (snippet) — [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/); [Token Metrics](https://tokenmetrics.com/blog/fomo-vs-pump-fun-vs-axiom/) [T].
- An analyst claimed on 2026-08-14 that Axiom has been "#1 this whole time… $405M weekly volume (#1), 40–60% market share for most of 2026, highest fees" — [jussy X post](https://x.com/jussy_world/status/2088286651286163927) [X].
- OpenChainBench (as of 2026-08-31): Axiom leads unique swap transactions over 24h with 1.64M. The benchmark compares pump.fun, GMGN, Fomo, Axiom and Trojan — [OpenChainBench](https://openchainbench.com/benchmarks/solana-unique-traders).
- On 2026-08-06, fomo briefly passed Axiom in daily fees — [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/).

**Pump.fun**
- A launchpad since January 2024. By March 2026 it was the first Solana app to pass $1B in cumulative revenue — [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/).
- On 2026-08-07 it launched social trading features that mirror fomo's core product: token callout alerts sent to followers, zero-fee trading on supported transactions, and multichain swaps funded from one unified USDC account. Its app then hit all-time highs in daily active users — [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/); [Bitstop](https://bitstop.co/blog/social-trading-pump-fun-fomo).
- On 2026-08-09 it offered fomo traders a $20k sign-up bonus plus $30k a month to switch — [Memeburn](https://memeburn.com/pump-fun-is-paying-fomo-users-30k-per-month-to-switch-platforms/). A KuCoin headline says "$2M sign-on bonus" instead — [KuCoin](https://www.kucoin.com/news/flash/pump-fun-offers-2m-sign-on-bonus-to-lure-fomo-users). The two conflict; $2M may be the total pool (no verificado).

**Revenue race**
- fomo beat Pump.fun in daily revenue on some days in September 2026: $1.76M vs $1.1M on one Friday. Over 30 days Pump.fun is far ahead: $57M+ vs $17.6M — [Cointelegraph](https://cointelegraph.com/news/fomo-pumpfun-revenue-app-solana).
- Similar headlines appeared on 2026-09-07, 09-13 and 09-19 — [Gokhshtein](https://gokhshtein.com/news/2026-09-19-fomo-overtakes-pumpfun-in-daily-revenue-on-solana).
- fomo also beat Pump.fun over 7 days — [KuCoin](https://www.kucoin.com/news/flash/fomo-surpasses-pump-fun-in-7-day-revenue-on-solana).
- On one day it beat Hyperliquid in 24h protocol revenue (date no verificado) — [Solana Compass](https://solanacompass.com/news/fomo-tops-hyperliquid-in-24-hour-protocol-revenue-as-solana-copy-trading-app-extends-its-run); [Bitget](https://www.bitget.com/news/detail/12560605644496).

**Others**
- Robinhood Wallet uses the same Crossmint card checkout for memecoins, so it competes directly on onboarding — [The Block](https://www.theblock.co/news/business/2026-09-01-buying-memecoins-with-credit-cards-on-robinhood-wallet-fomo-sidestep-card-network-crypto-rules-411911).
- fomo publishes its own comparison with Phantom (content not read) — [fomo vs Phantom Wallet](https://fomo.family/blog/learn/fomo-vs-phantom-wallet).
- Third-party framing: "Fomo fits feed and leaderboard research, Pump.fun fits launch provenance and callouts, and Axiom fits filter and wallet-led discovery" — [Token Metrics](https://tokenmetrics.com/blog/fomo-vs-pump-fun-vs-axiom/) [T]. Another piece frames fomo vs Pump.fun as "Factory vs Showroom" — [Our Crypto Talk](https://ourcryptotalk.com/blog/fomo-vs-pump-fun) [T].
- **Source-quality warning:** one [T] comparison says "To use Fomo, you need a Solana wallet (Phantom is the standard) with SOL in it" — [AXL Research Hub](https://www.axltoken.com/trading-bots/fomo-vs-pump-fun-vs-axiom/). That contradicts the Privy embedded wallets and USDC balance described in §3, so third-party comparisons should be treated with caution.
- Chinese-language coverage exists (a practical guide and "why is Benchmark focusing on Fomo"), suggesting interest in Asia — [Odaily](https://www.odaily.news/en/post/5212791); [Bitget News](https://www.bitget.com/news/detail/12560605063209).

### Inferences
- The market splits roughly into four groups:
  - Terminals (Axiom, Photon, BullX, GMGN, Padre): desktop power users who want speed and filters.
  - Launchpads (pump.fun, Believe, Bags): the supply side.
  - Wallets (Phantom, Base App): general purpose.
  - fomo: a consumer social broker for on-chain assets that has grown from memecoins into tokenized stocks and perps. It is converging on a "super-app" for on-chain speculation.
- Pump.fun copied fomo's features within weeks, which shows fomo's UX features are not a durable moat. The defensible parts are the social graph, the content (theses), the data layer (Mobula) and distribution (App Store ranking, referral network).

### Gaps
- 2026 features and metrics for Photon, BullX, GMGN (beyond the benchmark), Padre, Moonshot, Vector, Believe, Bags, Zora / Base App and Phantom's social features: no verificado in this research.

## 9. Security incidents, controversies, criticism, regulation; the unofficial-site ecosystem (including fomotrading.app)

### Takeaway
There is no confirmed breach of the official fomo app. A claimed $6M "iOS hack" was denied by the company, and ZachXBT attacked the accuser's credibility. The "FomoPeek" iOS malware (about $580k stolen, Sep 9–17, 2026) was a different app. The live controversy is the Crossmint card checkout, which let users buy memecoins with credit cards, earn rewards and skip KYC; Visa moved to close it on Sep 19, 2026. On the regulatory side there is a tailwind: an SEC staff statement (April 2026) on non-custodial interfaces. Many unofficial affiliate sites use the brand, and **fomotrading.app shows no sign of being official**.

### Cited Findings
**Hack claim, denied**
- The X account Derivatives_Ape claimed that a friend lost 662 SOL (about $62k) after an app update, and alleged about $6M in total losses.
- Co-founder Prashan Dharmasena replied that the account "has no transaction signed by FOMO's fee payer".
- ZachXBT said Derivatives_Ape is a co-founder of Zkasino who "stole $30 million of investor funds".
- Sources: [Protos](https://protos.com/crypto-trading-platform-fomo-denies-hack-of-its-ios-app/); [Crypto Economy](https://crypto-economy.com/crypto-trading-app-fomo-denies-ios-hack-after-trader-claims-6m-loss/); [BYDFi](https://www.bydfi.com/en/crypto-news/[category]/fomo-denies-6m-ios-app-hack-claim-94236). Exact date no verificado.

**FomoPeek (a different app)**
- SlowMist (Sep 2026) analysed App Store poisoning by "FomoPeek":
  - Versions 1.1 and 1.2, released Sep 9 and Sep 12, contained malicious modules capable of remote configuration, kernel-exploit execution, sandbox escape, Keychain decryption and collecting data across apps.
  - The affected versions were live from Sep 9 to Sep 17.
  - About $580k in USDT moved through the attackers' addresses.
  - Sources: [SlowMist](https://slowmist.medium.com/threat-intelligence-analysis-of-fomopeek-app-store-poisoning-and-ios-kernel-exploitation-e568762d11ca); [The Currency Analytics](https://thecurrencyanalytics.com/stable-coins/fomopeek-ios-app-drained-nearly-580k-in-crypto-before-apple-pulled-it-296300); [AirdropAlert](https://airdropalert.com/blogs/fomopeek-crypto-news-airdrop-update/).
- Protos ran the headline "Crypto-draining FOMO app was available on Apple store for a week" — [Protos](https://protos.com/crypto-draining-fomo-app-was-available-on-apple-store-for-a-week/). Phemex ran "FOMO App Malware on Apple App Store Stole Crypto Private Key" — [Phemex](https://phemex.com/news/article/fomo-app-on-apple-app-store-contained-malware-targeting-crypto-wallets-97599). Both are confusing.
- SlowMist's CISO clarified that the malware report concerns FOMOPeek, **not the official FOMO app** — [KuCoin](https://www.kucoin.com/news/flash/slowmist-ciso-clarifies-malware-report-refers-to-fomopeek-not-fomo-official-app); [PANews](https://panews.io/articles/01a0ce0d-3941-70ae-adaf-afdc6f4a784a).

**Phishing:** lookalike domains have been used in wallet-draining phishing, and fomo.family is the only legitimate domain (snippet) — [fomobyte](https://fomobyte.com/fomo-app-review/) [T].

**Card-network controversy:** see §3 — [The Block, 2026-09-01](https://www.theblock.co/news/business/2026-09-01-buying-memecoins-with-credit-cards-on-robinhood-wallet-fomo-sidestep-card-network-crypto-rules-411911); [The Block, 2026-09-19](https://www.theblock.co/news/regulation/2026-09-19-visa-to-close-crossmint-memecoin-rewards-loophole-following-the-block-investigation-report-415866); [Bloomingbit](https://en.bloomingbit.io/feed/news/119568).

**SEC and regulation**
- On 2026-04-13, the SEC's Division of Trading and Markets issued a staff statement on "Covered User Interface Providers": websites, mobile apps and browser tools that help users prepare and send crypto-asset-securities transactions through self-custodial wallets. Subject to conditions, staff would not recommend enforcement against them for operating without broker-dealer registration — [Global Fintech & Digital Assets blog](https://www.fintechanddigitalassets.com/2026/04/sec-staff-issues-statement-on-broker-dealer-registration-for-cryptoasset-securities-interfaces/); [Pillsbury](https://www.pillsburylaw.com/en/news-and-insights/sec-staff-statement-crypto-trading-interfaces.html); [NatLawReview](https://natlawreview.com/article/sec-staff-clarifies-broker-dealer-registration-expectations-non-custodial-crypto). A parallel CFTC path is described by [Fenwick](https://www.fenwick.com/insights/publications/wallet-to-wall-street-cftc-and-sec-staff-chart-parallel-paths-for-noncustodial-crypto-access).
- TechTimes (2026-06-23) puts fomo in this category but dates the guidance "March 2026", which conflicts with Apr 13 — [TechTimes](https://www.techtimes.com/articles/318895/20260623/social-crypto-trading-app-fomo-raises-75m-sec-clears-non-custodial-wallets-operate.htm).
- Geographic limits: perps are closed to US persons — [fomo blog](https://fomo.family/blog/perpetuals-now-on-fomo) (snippet). A list of restricted countries exists — [Datawallet](https://www.datawallet.com/crypto/fomo-app-restricted-countries) [T] (the list itself is no verificado).

**Criticism**
- Fee drag on small trades: an effective 4.75% on a $20 Solana trade under the ~$0.95 minimum — [intercom](https://intercom.help/cryptoreferralcodes/en/articles/16595991-fomo-app-fees-explained-2026-the-0-95-minimum-that-decides-everything) [T].
- Opinion piece "Fomo is popular, but I advise you not to Fomo" — [Coinlive](https://www.coinlive.com/en/news/fomo-is-popular-but-i-advise-you-not-to-fomo) (content no verificado).
- Guides to withdrawal failures — [Vaulted](https://vaulted.finance/blog/fomo-app-withdrawal) [T]; [fomoappreview](https://fomoappreview.com/fomo-app-withdrawals/) [T].
- A Trustpilot page exists — [Trustpilot](https://www.trustpilot.com/review/fomo.family) (score no verificado). A "legit or scam?" review — [BrokerListings](https://brokerlistings.com/scams/fomo) [T].

**Unofficial and affiliate ecosystem**
- Many unofficial sites use the brand:
  - fomotrading.app, fomofamilyapp.com, fomo-family.app, fomofamily.com
  - fomobyte.com, fomoappguide.com, fomoappreview.com
  - sellthepump.com, crowinvesting.com
  - referral-code "help centers" hosted on intercom.help
- FomoAppGuide says it is "not affiliated with, produced by, reviewed by, endorsed by, or sponsored by FOMO Labs, Inc." (snippet) — [FomoAppGuide](https://fomoappguide.com/guides/getting-started/fomo-wallet-deposit-withdraw) [T].
- Doubtful code claims circulate, such as "BOOST100: Get 100% Off Fees" — [intercom actech](https://intercom.help/actech/en/articles/16829207-fomo-app-referral-code-boost100-get-100-off-fees) [T]. Another site warns that some affiliates promise "free forever" or guaranteed returns, which is false — [fomobyte](https://fomobyte.com/fomo-app-referral-code/) [T].
- **fomotrading.app:**
  - It calls itself "Fomo Trading App: Memecoins on Solana, Base, BNB and Robinhood Chain" and has /terminal, /perps, /web and /download pages — [fomotrading.app](https://fomotrading.app/), [/perps](https://fomotrading.app/perps/), [/web](https://fomotrading.app/web/), [/download](https://fomotrading.app/download/).
  - It is not on the official fomo.family domain, and no official fomo source links to it.
  - Treat it as an **unofficial affiliate/SEO site**. Its own disclaimer could not be read, so it cannot be confirmed from the site itself.

### Inferences
- The structural risks:
  1. The fiat on-ramp depends on how card networks classify purchases.
  2. Revenue depends on the memecoin cycle.
  3. The generic name "fomo" invites impersonation (FomoPeek, lookalike domains).
  4. A public feed of trades combined with paid referrals may draw regulatory attention as promotion or solicitation.
  5. Perps require geofencing.
- The unofficial ecosystem is a side effect of the 25% lifetime revenue share. It helps distribution, but it fills search results with low-quality and sometimes wrong information, such as the claim that a Phantom wallet is required.

### Gaps
- Exact date of the Derivatives_Ape claim, and whether an official post-mortem exists: no verificado.
- Any regulatory action or inquiry specifically against fomo: none found (no verificado).
- App Store rating and Trustpilot score: no verificado.

## 10. What is worth emulating for a small team (Payence, Nomia, Tricker, Tricker Terminal), and what is too heavy

### Takeaway
**Worth copying:**
- Social proof tied to verified positions: a thesis showing position size and PnL.
- Crawlable asset pages whose share links carry referral attribution.
- The "one stablecoin balance, invisible rails" experience, built on rented infrastructure: embedded wallets, cross-chain execution, card checkout and gas sponsorship.
- Referral revenue share paid in USDC.

**Too heavy for a small team:**
- In-house indexing and data (fomo paid $17M to bring it in-house).
- Its own multichain execution engine.
- Perps (geofencing, US exclusion).
- A card on-ramp without KYC (card-network risk).
- Clans and leaderboards before there is a dense user graph.

### Cited Findings (evidence behind the verdict)
- fomo shipped with a very small team: 8 engineers and 17 employees — [web3.career](https://web3.career/staff-frontend-engineer-fomo/150820); [Fortune](https://fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/).
- Almost every hard layer comes from a vendor:

| Layer | Vendor | Source |
|---|---|---|
| Wallets | Privy | [Privy](https://privy.io/blog/turning-trading-into-a-social-experience-with-fomo) |
| Cross-chain, fee sponsorship, escrow | Relay | [Relay](https://radar.relay.link/how-fomo-built-instant-trading-on-relay/) |
| Apple Pay / card | Crossmint | [Crossmint](https://www.crossmint.com/announcement/fomo-crossmint-token-checkout) |
| Solana RPC | QuickNode | [QuickNode](https://www.quicknode.com/case-studies/fomo-real-time-social-trading-at-scale-on-solana) |
| Solana routing | DFlow | [fomo answers](https://fomo.family/answers/is-fomo-app-safe) |
| Perps | Hyperliquid + Trade[XYZ] | [fomo X](https://x.com/fomo/status/2065102110673277330?lang=en) |

- The one layer fomo chose to own was data. It paid $17M (Mobula) at about 1.9M users — [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/31/3353368/0/en/fomo-acquires-mobula-technology-to-bring-critical-on-chain-infrastructure-in-house.html).
- Apple Pay onboarding brought 68k first-time crypto buyers, and weekly active traders rose 7x after it launched — [Crossmint](https://www.crossmint.com/announcement/fomo-crossmint-token-checkout). The card channel is exposed to card-network rules (Visa is closing the "digital media" classification) — [The Block](https://www.theblock.co/news/regulation/2026-09-19-visa-to-close-crossmint-memecoin-rewards-loophole-following-the-block-investigation-report-415866).
- Clans explicitly avoid pooled money — [manuallyreviewed](https://manuallyreviewed.com/fomo-app-review/) [T].
- Pump.fun copied the social features and unified USDC balance within weeks — [Crypto Briefing](https://cryptobriefing.com/fomo-pumpfun-solana-memecoin-competition/).
- fomo's frontend stack (Expo, React Router + Vite, TypeScript) is conventional — [web3.career](https://web3.career/staff-frontend-engineer-fomo/150820).

### Inferences (verdict, mapped to the user's projects)
**Emulate: cheap and high-leverage**
1. **Social proof from verified positions.**
   - Tricker (index "bags"): a bag page listing holders with entry, PnL and hold time, plus an optional thesis per holder. Add filters like "thesis only" / "friends only".
   - Tricker Terminal: fomo's holder table (position, PnL, average entry, hold time) is a good reference. Build it from on-chain reads plus a data API; don't build your own indexer.
   - Payence / Nomia: the equivalent is a public, verifiable log of agent spending that complied with its policies, used as social proof on the landing page.
2. **Programmatic asset pages with referral links.** For example `/bags/{chain}/{id}?r={user}` and `/answers/*`. This fits the user's Next.js stack well (SSG/ISR), and each page doubles as a share card.
3. **"One balance, invisible rails" as positioning and architecture.**
   - fomo's pitch ("no seed phrase, no bridging, no gas, Apple Pay") has the same shape as Nomia's "multi-rail settlement behind one API" and Payence's "spend policies".
   - Copy the pattern of the message, and buy the infrastructure: an embedded wallet, a cross-chain / intents provider, and gas sponsorship.
   - Relay's "escrow until execution is verified" is a useful reference primitive for agent-to-agent settlement.
4. **Referral revenue share paid in stablecoin (fomo pays 25% / gives 10% off).** Simple and proven, but expect affiliate spam. Plan anti-sybil controls and disclosure rules from day one.
5. **Landing pages built on metrics.** fomo's releases lead with users, volume, first-time buyers and social interactions. A pre-launch product should publish only verifiable numbers.

**Too heavy for now**
- Your own indexer or market data: fomo paid $17M to bring it in-house at ~2M users. Use a data API.
- Multichain routing and execution: use an aggregator or cross-chain API and start on a single chain.
- Perps: geofencing, US exclusion, liquidation UX and extra compliance.
- A card on-ramp without KYC: card-network risk, as the Visa episode showed. For **Payence** (virtual cards), correct merchant category (MCC) coding and card-network rules are a core design risk, not a detail.
- Clans and leaderboards: they only work with a dense network and need anti-wash-trading controls. Add them once the feed is active.
- Enterprise RPC and 24/7 real-time feeds: expensive. Start with a vendor's websockets.

**Design note for Tricker (not legal advice).** Clans avoided pooled funds. The equivalent for bags is to keep each bag a position owned by the user in their own wallet, not a pooled fund, so it doesn't look like a collective investment vehicle.

### Gaps
- There is no public data on how much individual features contributed (thesis usage, clan retention), so the ROI of each one can't be measured: no verificado.
- Vendor pricing for Privy, Relay, Crossmint and Mobula was not researched: no verificado.
