# Monad "tech coins" that touched a US$700K–10M market cap (as of 2026-09-26)

_How these notes were made: the figures come from web-search result titles, snippets and search-engine summaries, plus read-only GitHub code search (README and code fragments). Nothing could be checked live. WebFetch and curl are blocked by the egress policy, and the session's web-search budget (200 queries) ran out partway through this task. Numbers whose date is unknown are marked "fecha no verificada (snippet)". Any figure I could not find is marked "no verificado". This is tech/product analysis, not investment advice._

---

## 1. Monad mainnet date, and the state of Monad's token-launch ecosystem in 2026

### Takeaway
The mainnet date is confirmed: Monad mainnet and the MON token went live on **24 Nov 2025 at 14:00 UTC**. nad.fun is the dominant launchpad, but the token market is thin. After the TGE only **two nad.fun tokens had crossed US$1M market cap**, and the top memes sat around US$1–5M. The 2026 metas are **AI agents that launch their own token** (the Moltiverse hackathon, Feb 2026, co-run by nad.fun) and **agent payments** (x402, ERC-8004 agent identity, Monad Agent Hub, Monad API Hub). The Monad Foundation is pushing that second meta directly.

### Cited Findings
**Chain basics**
- Mainnet went live on 24 Nov 2025 at 14:00 UTC. MON is both the staking token (MonadBFT) and the gas token. — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/monad-announces-nov-24-launch-with-airdrop-for-225k-users); [The Block](https://www.theblock.co/post/377676/monad-unveils-airdrop-public-mainnet-date); [Backpack Learn](https://learn.backpack.exchange/articles/monad-mainnet-launch)
- Mainnet launched with 50.6% of total MON supply initially locked. — [The Block](https://www.theblock.co/post/380094/monad-mainnet-launches). Unlocks start in 2H 2026 and rise quarterly until end-2029 (search-engine summary of the same result set).
- Total supply is fixed at 100B MON. — [Monad tokenomics](https://www.monad.xyz/announcements/mon-tokenomics-overview); [CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/monad/what-is/)
- Monad was Coinbase's first project on its new token-sale platform. The public sale raised about US$188M, and the airdrop went to "over 230,000" eligible users, including Pump.fun and Virtuals users (search-engine summary). **Conflict:** the CMC Academy headline says "225K users". — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/monad-announces-nov-24-launch-with-airdrop-for-225k-users)
- MON price and market cap:
  - About US$0.03; CMC rank #115; market cap US$304,044,398 (fecha no verificada (snippet), likely recent). — [CoinMarketCap](https://coinmarketcap.com/currencies/monad/); [MetaMask price page](https://metamask.io/price/monad)
  - Another snippet reports a +42% day to US$0.03632, with a market cap of US$392.39M (date not verified). — [CoinEdition](https://coinedition.com/monad-mon-surges-into-top-100-as-neverland-drives-defi-growth/)
- TVL passed US$400M within six months of mainnet (CMC AI-generated summary, lower reliability). — [CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/monad/what-is/)

**nad.fun (the main launchpad)**
- How it works: Monad-native "memepad" with a fair-launch model (no presale, no team allocation). It also has a "leveraged price prediction market" feature. — [CryptoRank](https://cryptorank.io/price/nad-fun); [nad.fun GitBook](https://nad-fun.gitbook.io/nad.fun); [nad.fun](https://nad.fun/)
- Funding and incentives:
  - Seed round: "$1.1M raise to date" led by Neoclassic Capital, with angels from the Monad community (X post, around 21 Nov 2025). — [nad.fun on X](https://x.com/naddotfun/status/1991868470238355743)
  - A "$200k+ Rewards Program for Traders & Creators" was announced at mainnet launch. — [nad.fun on X](https://x.com/naddotfun/status/1992597604350456252)
- Graduation mechanics. The sources conflict, probably because one describes testnet-era rules:
  - A token graduates when the bonding curve has gathered about 225,000 MON and about 80% of supply is sold.
  - Elsewhere: "once market cap reaches 432 MON, Nad migrates using Uniswap V3".
  - — [Backpack Learn guide](https://learn.backpack.exchange/articles/create-monad-meme-coin-nad-fun); [nad.fun GitBook](https://nad-fun.gitbook.io/nad.fun)
- Volume:
  - US$5.03M daily volume across 6 pairs (Nov 2025). — [CryptoRank exchange page](https://cryptorank.io/exchanges/nad-fun)
  - About US$20.1M 24h volume and more than 122,000 transactions (fecha no verificada (snippet)). — [DexScreener nad.fun](https://dexscreener.com/monad/nad-fun)
- Blockworks, post-TGE: "Nad.fun has been the breakout leader in both accounts and transactions since day one", yet "only two tokens launched there have crossed the $1 million market cap mark". Chog, "the chain's first community token", was down more than 65% from its highs at US$4.5M. The article date was not verified; the context suggests about Dec 2025. — [Blockworks](https://blockworks.co/news/after-monad-tge)
- Every nad.fun token contract seen in sources ends in `…7777`: NEURON, NADZ, INOMY, GOAL (see sections 3–6). — [nobel-axon/skills](https://github.com/nobel-axon/skills); [nad.fun NADZ page](https://nad.fun/tokens/0x96e88191f7356135f1b4AbB9fEf6D1813ffF7777)
- Tokens called "NAD"/"Nad.fun token" trade on DYORSwap and Uniswap. The Uniswap one had US$116K liquidity and more than 15,000 holders (date not verified). CryptoRank shows nad.fun's own token with price and market cap at $0.00. Treat these NAD tokens as **unofficial** (see Inferences). — [DexScreener NAD/USDC](https://dexscreener.com/monad/0x13914ef551fbbb8e1a9dffb4ab6681a85df4d800); [DexScreener $NAD/MON](https://dexscreener.com/monad/0x22c2d64b45af82fe4af8f45e705d5ab8585c03f9); [CryptoRank](https://cryptorank.io/price/nad-fun)

**Other launchpads and launch infra seen**
- **dev.fun:**
  - Tagline: "where AI agents compete, build, and ship". — [dev.fun](https://dev.fun/)
  - It started as a launchpad where anyone creates dApps by describing them, each linkable to a pump.fun token (Solana origin). — [Crypto-Fundraising](https://crypto-fundraising.info/projects/dev-fun/)
  - It is one of the protocols with skills in Monad's Agent Hub (below).
- **Monad Pad ($MPAD):** launchpad for tokens and NFTs. — [Backpack Learn](https://learn.backpack.exchange/articles/what-is-monad-pad)
- **Monad Mill:** turns trading fees into MON airdrops through a "King of the Mill" competition (search summary; likely testnet-era). — [Gate Learn](https://www.gate.com/learn/articles/monad-ecosystem-guide-native-wallets-and-launchpad-platforms/6563)
- **MonadGrid:** token factory and farm creation. — [MonadGrid](https://www.monadlaunchgrid.com/)
- **Nadz Tools:** token creation, locker, vesting, multisend (section 6). — [Nadz Tools](https://app.nadz.tools/)
- **Lick-fun** (new in 2026): Monad launchpad whose README logs "V3 self-healing vaults (2026-08-23)".
  - `VaultBuybackBurnV3` and `VaultLPSupportV3` are deployed. `reconcileUntracked()` "makes buyback-and-burn autonomous", with a Railway keeper.
  - The UI got a "nad.fun-style chart overhaul". ProfileRegistry and VestingController are pending mainnet deploy.
  - Tagline: "Built for Monad. Reputation over hype."
  - — [Lick-fun/lick-fun](https://github.com/Lick-fun/lick-fun)
- **"Monad x402 Launchpad" (m402.dev):** found by title only; content not verified. — [m402.dev](https://www.m402.dev/)

**2026 meta 1: AI agents that launch tokens (Moltiverse)**
- Format and sponsors: a 2-week sprint with US$200K in prizes, from Monad, nad.fun, AUSD, Paradigm, Dragonfly and AttentionX AI (X post, about 2 Feb 2026). — [Monad on X](https://x.com/monad/status/2018354399010042242)
- Tracks:
  - **Agent + Token track (US$140K):** "Build autonomous agents on Monad AND launch their token on nad.fun".
  - **Agent track (US$60K):** agents only, no token.
  - Early on there were more than 200 submissions. — [Monad on X](https://x.com/monad/status/2018710997716894162?lang=en)
- Prizes:
  - Ten US$10K winners in Agent + Token, plus **US$40K extra liquidity for the token with the highest market cap on nad.fun**.
  - The Agent track paid 3 × US$10K plus 3 bounty × US$10K.
  - — [TechFlow](https://www.techflowpost.com/en-US/newsletter/113221); [The Monad Pulse #016](https://themonadpulse.substack.com/p/the-monad-pulse-016)
- Dates: 2–18 Feb 2026, rolling judging, final deadline 15 Feb. — [MoltiGuild TDD.md](https://github.com/imanishbarnwal/MoltiGuild)
- Size and winners:
  - 500 teams registered by Day 6. — [The Monad Pulse #016](https://themonadpulse.substack.com/p/the-monad-pulse-016)
  - More than 400 projects entered and 312 were deployed on Monad; Circle and the Ethereum Foundation also supported; winners were announced 18 Feb (search summary). — [Monad blog "Home for Builders"](https://www.monad.xyz/blog/home-for-builders); [Everstake](https://everstake.one/resources/blog/monad-ignites-the-builder-economy-hackathons-ai-and-a-3-month-accelerator)
  - "Official X reported 16 winners from 400 submissions"; the liquidity award "was objectively based on final nad.fun market cap". — third-party research notes in [vaibhav0xq/turnstile](https://github.com/vaibhav0xq/turnstile) citing [moltiverse.dev](https://moltiverse.dev/)
  - Winners tweet: [monad_dev on X](https://x.com/monad_dev/status/2026359842437488679), linked from a winner's profile at [Pranav9931](https://github.com/Pranav9931). The project names were not retrievable.
- Builders got free Kimi credits. The event was listed as "moltiverse.dev / DoraHacks" — [Nuel-osas/info](https://github.com/Nuel-osas/info). **Conflict:** another notes file found no evidence that Moltiverse used DoraHacks ([turnstile](https://github.com/vaibhav0xq/turnstile)).
- The same notes file rates "ERC-8004 agent identity" on Monad as saturated ("Agent Hub live; Moltiverse saturated"). — [vaibhav0xq/turnstile](https://github.com/vaibhav0xq/turnstile)

**2026 meta 2: agent payments and agent infrastructure**
- The Monad Foundation joined the x402 Foundation. — [Monad blog](https://blog.monad.xyz/blog/monad-foundation-joins-x402-foundation)
- Monad docs have an x402 endpoint guide. — [Monad docs](https://docs.monad.xyz/guides/x402)
- The Foundation also publishes an x402 Rust library. — [monad-developers/x402-rs](https://github.com/monad-developers/x402-rs)
- Monad "ships official x402 Permit2 proxies on mainnet". It runs an x402 facilitator and supports ERC-8004 agent identity. — [agent-pay-monad](https://github.com/filip-study/agent-pay-monad); [Monad blog](https://monad.xyz/blog/monad-foundation-joins-x402-foundation)
- Independent facilitators and portals: [MonX402](https://monx402.com/), [x402 on Monad](https://www.x402onmonad.com/).
- An x402 data platform lets users pull wallet PnL and DEX trades with no account or API key. — [Coinfomania](https://coinfomania.com/monad-expands-data-access-with-new-x402-platform-launch/)
- **Monad API Hub:** one access point for partner APIs (Nansen, ElevenLabs), billed per request in USDC (CMC AI summary). — [CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/monad/latest-updates/)
- **Monad Agent Hub:** one-click agent launch plus DApp "skills". At launch it had skills from **Uniswap, Morpho, Balancer, Kuru, Clober, Nad.fun, DevFun and Blinq.fi** (search summary). — [Monad App Hub](https://app.monad.xyz/app-hub)

**2026 builder programs (hackathons as a launch channel)**
- Programs: the Rebel in Paradise hackathon, Moltiverse and the Nitro accelerator (3 months, open to any chain), with more than US$700K in total prizes. Metropolis is a 6-week hackathon with more than US$250K and 4 tracks, including "trust, identity, and AI infrastructure". — [Everstake](https://everstake.one/resources/blog/monad-ignites-the-builder-economy-hackathons-ai-and-a-3-month-accelerator)
- Metropolis is "judged per track during 14–27 Oct" [2026]. Blitz is a one-day IRL format with about 1,700 unique developers by Mar 2026. Raingentic Commerce (Aug 2026, co-hosted with Rain) had 35 submissions. — [turnstile notes citing monad.xyz and the Encode blog](https://github.com/vaibhav0xq/turnstile)

**Distribution and other context**
- The Monad Pulse #047 (10–17 Sep 2026) covers the Coinbase wallet trading onchain assets (memecoins, tokenized stocks, perps, prediction markets) and Coinbase's recent Monad support (search summary). — [The Monad Pulse #047](https://themonadpulse.substack.com/p/the-monad-pulse-047)
- The largest Monad-native DeFi token seen is Neverland's **DUST** (Aave-style lending): market cap US$37,642,172.50, price US$0.3787, 1,341 holders as of **31 May 2026**. That is above the band. Its emissions are "deflationary via burns/buybacks". — [MonadScan DUST](https://monadscan.com/token/0xad96c3dffcd6374294e2573a7fbba96097cc8d7c?a=0xf93191d350117723dbeda5484a3b0996d285cecf); [CryptoRank](https://cryptorank.io/price/neverland)

### Inferences
- On Monad, a token that touched US$700K–10M is **top-tier**, not mid-tier: only two nad.fun tokens had crossed US$1M after the TGE. So very few tech coins will be found in the band, and that is what happened (section 2).
- The Foundation's energy in 2026 goes to **agents and payments**: x402, Permit2 proxies, facilitator, API Hub, Agent Hub, ERC-8004, Moltiverse, Metropolis Track 04 and Raingentic Commerce. That fits the user's Payence and Nomia better than any other Monad meta.
- Moltiverse built "launch a token on nad.fun" into a hackathon and paid US$40K to the highest-MC token. It created many agent tokens at once, and it rewarded market cap rather than usage. That explains why most "tech coins" on Monad are hackathon-born micro-caps.
- The NAD tokens on DYORSwap and Uniswap are probably not official, because nad.fun's own token shows $0 on CryptoRank. They are a naming and impersonation risk worth warning users about.

### Gaps
- The article date for the Blockworks "only two tokens >$1M" figure is not verified; the page could not be opened.
- No list of Moltiverse winners (project names and tickers) could be retrieved; the X posts and moltiverse.dev were not readable. **Which token won the US$40K market-cap liquidity boost is no verificado.**
- nad.fun's 2026 fee split (creator fees, protocol fees) and current graduation thresholds are no verificado. The two graduation figures above conflict.
- No 2026 aggregate stats were found for nad.fun (tokens launched, graduation rate, volume).
- The contents of m402.dev ("Monad x402 Launchpad") and whether Kuru or other DEXs run a token launchpad in 2026 are no verificado.
- The "$292,272 (V1+V2)" figure for nad.fun in a third-party notes file ([Pratiikpy/plumb](https://github.com/Pratiikpy/plumb)) is an unlabeled metric; I left it out.

---

## 2. Which Monad tokens verifiably touched US$700K–10M, and which tech coins exist near that band? (screening and ranking)

### Takeaway
**Every token verified inside the band is a meme:** CHOG, NADS, moncock and HOGDOG. **No tech coin could be verified inside the band**; for all of them the peak market cap is "no verificado" or the indexed figure is below the band. I found eight real tech tokens with describable mechanics: NEURON, HCLAW, EMOLT/emo, NADZ, INOMY, MMIND, MOOD and GOAL. I rank them by how solid the product and token design is and how relevant they are to the user, not by verified market cap.

### Cited Findings
**Memes verified in the band (labelled as memes; details in section 7)**
- CHOG: US$4.5M "today", down more than 65% from highs. — [Blockworks](https://blockworks.co/news/after-monad-tge)
- NADS: peaked at about US$3M; US$2.04M at report time. — [Bitget News](https://www.bitget.com/news/detail/12560605083056)
- moncock: US$880K; HOGDOG: US$860K, in the same report. — [Bitget News](https://www.bitget.com/news/detail/12560605083056)

**Tech tokens found (market cap and address status)**
| # | Project / ticker | Type | Token CA seen in a source | Market cap found |
|---|---|---|---|---|
| 1 | Nobel Arena / **$NEURON** | AI-agent arena, burn-fuel token | `0xDa2A083164f58BaFa8bB8E117dA9d4D1E7e67777` ([nobel-axon/skills](https://github.com/nobel-axon/skills)) | no verificado |
| 2 | HyperClaw / **$HCLAW** | agentic vaults + treasury router + buyback-lock | no verificado (read from env var) ([hyperClaw](https://github.com/Halo-Labs-xyz/hyperClaw)) | no verificado |
| 3 | EMOLT agent on emonad **(emo / $EMO)** | meme + AI-agent hybrid | no verificado (DexScreener page id `0x714a…182d`) | US$443.09K in the DexScreener title, below the band (fecha no verificada (snippet)) ([DexScreener](https://dexscreener.com/monad/0x714a2694c8d4f0b1bfba0e5b76240e439df2182d)) |
| 4 | Nadz Tools / **$NADZ** | launch/token-management tooling | `0x96e88191f7356135f1b4AbB9fEf6D1813ffF7777` ([nad.fun](https://nad.fun/tokens/0x96e88191f7356135f1b4AbB9fEf6D1813ffF7777)) | price US$0.0₄1040 (fecha no verificada (snippet)); market cap no verificado ([DexScreener](https://dexscreener.com/monad/0x2b187a46e23c6df51c04e3821708a6338eb8c4fe)) |
| – | Inomy / **$INOMY** | agent-owned commerce | `0x5752a9df4DcF9Da4188EA69c1ebFa1F785a97777` ([inomy-hub-public](https://github.com/manishtomer/inomy-hub-public)) | no verificado |
| – | nadfunagent / **MMIND** | OpenClaw trading agent with profit share | no verificado ([encipher88/nadfunagent](https://github.com/encipher88/nadfunagent)) | no verificado |
| – | **$MOOD** | AI sentiment-index token | no verificado ([dongsheng123132/nadfun-monad](https://github.com/dongsheng123132/nadfun-monad)) | no verificado |
| – | GoalNad / **$GOAL** | Moltiverse entry (product not verified) | `0xB8D8B36Ff6D2145F54345db2a96021BcA8637777` ([goalnad-mainnet](https://github.com/zvsvev/goalnad-mainnet)) | no verificado |

- For comparison: NADS at US$0.0002971 showed a market cap of US$297K, which fits a 1B supply (fecha no verificada (snippet)). — [DexScreener NADS](https://dexscreener.com/monad/0xf4e40aaea62c8b6a023b1f0250e096979b6d28ea)

### Inferences
- **Suggested ranking for the final report.** My recommendation is to present **#1 NEURON and #2 HCLAW** as the two best tech archetypes, stating clearly that their market cap is no verificado. If the report must show tokens verified in the band, use CHOG and NADS as the meme baseline next to them.
  1. **Nobel Arena ($NEURON).** The only tech token with a mainnet CA in the project's own repo and a clear, usage-linked sink: a per-attempt burn whose price doubles each attempt, plus 5% of prize pools used to buy back and burn. It is also agent-native (SKILL.md onboarding).
  2. **HyperClaw ($HCLAW).** The most complete token-economy design seen on Monad: a treasury router (buyback / incentives / reserve), buyback-and-lock through nad.fun, a rewards/rebate distributor, and a role-gated agentic vault with a kill switch and deposit caps tiered by market cap. It is the closest match to Tricker and Payence, but the launch is not verified.
  3. **EMOLT on emo.** A meme community that bolted on a real agent: an on-chain emotion oracle, a dynamic SVG NFT, and a live "heartbeat" dashboard. It has the only market-cap datapoint among the tech candidates (US$443K, below the band). Label it meme-derived.
  4. **Nadz Tools ($NADZ).** The "picks and shovels" launch-tooling archetype, closest to what a launch-site builder sells. Its token looks very small (implied about US$10K at the indexed price, assuming a 1B supply).
- If a 1B supply is assumed (standard on nad.fun and consistent with the NADS figures), NADZ at US$0.0₄1040 implies about US$10.4K. That is an inference, not a verified figure.

### Gaps
- All-time-high market caps for NEURON, HCLAW, emo, NADZ, INOMY, MMIND, MOOD and GOAL: **no verificado.** DexScreener, GeckoTerminal and nad.fun pages could not be opened, and the web-search budget ran out before targeted queries.
- Whether HCLAW, MMIND and MOOD were actually deployed on mainnet: no verificado.
- Kuru, Clober, Octoswap, DYORSwap, Perpl or LeverUp may have tokens inside the band; none were found in results. Those DEX and perp tokens were not researched.

---

## 3. Candidate #1: Nobel Arena ($NEURON), an AI-agent arena with a token that is burned as "fuel"

### Takeaway
Nobel is an arena where autonomous AI agents pay to answer questions and compete for prize pools. **$NEURON** (on nad.fun) is burned on every answer attempt, and the fee doubles each attempt. **5% of every prize pool buys NEURON on nad.fun and burns it.** It has a clean usage-to-token value loop and agent-native onboarding, but there is no traction or market-cap data, and development stopped after the hackathon.

### Cited Findings
- **What it is:** "a competitive AI arena on Monad where autonomous agents stake real tokens to prove intellectual superiority… a real proving ground rather than a synthetic benchmark". Agents answer questions and burn $NEURON as an entry-cost mechanism. — [nobel-axon on GitHub](https://github.com/nobel-axon); [DeepWiki agents](https://deepwiki.com/nobel-axon/agents); [DeepWiki contracts](https://deepwiki.com/nobel-axon/contracts)
- **Token mechanics:**
  - "$NEURON is the deflationary fuel of the Nobel arena and is launched on nad.fun on Monad."
  - "Every answer attempt across every match permanently burns $NEURON", with a doubling fee: 1 → 2 → 4 → 8 NEURON.
  - "5% of every prize pool is used to buy $NEURON from nad.fun and burn it."
  - — [nobel-axon (search summary of org/repos)](https://github.com/nobel-axon); [DeepWiki contracts](https://deepwiki.com/nobel-axon/contracts)
- **Contract addresses (from the project's own skill file):**
  - Token `0xDa2A083164f58BaFa8bB8E117dA9d4D1E7e67777` ("Buy $NEURON on nad.fun").
  - Arena/spender contract used in the approval step: `0xf7Bc6B95d39f527d351BF5afE6045Db932f37171`.
  - RPC `https://rpc.monad.xyz` (mainnet).
  - Agents need MON for "entry fee + gas" plus a NEURON balance.
  - — [nobel-axon/skills README and SKILL.md](https://github.com/nobel-axon/skills/blob/HEAD/SKILL.md)
- **Architecture:** 10 public repos, all created **8 Feb 2026** (inside the Moltiverse window):
  - `contracts` (Solidity), `backend` (Go), `agents` (Go), `devkit` (Go), `indexer` (TypeScript), `frontend` (TypeScript), `infra` (PLpgSQL), `docs`, `skills`, `.github`.
  - Last updates were 10–15 Feb 2026, except `skills` (22 Apr 2026). Stars: 0–1.
  - — [GitHub org nobel-axon](https://github.com/nobel-axon)
- **Onboarding:** a `SKILL.md` gives agents step-by-step `cast` commands: approve NEURON to the arena, then fix balance and ERC-20 errors. Any Claude/OpenClaw-style agent can read it and join. — [nobel-axon/skills](https://github.com/nobel-axon/skills/blob/HEAD/SKILL.md)
- Launchpad: nad.fun (above). Launch date: **no verificado** (probably Feb 2026, from repo dates). Peak and current market cap: **no verificado.** Team: anonymous GitHub org ("NOBEL"); no doxxing found.

### Inferences
- **Why it is interesting:**
  - The token is a consumable input to a service, not a governance or meme badge. Every use destroys supply.
  - The doubling fee is a convex price on repeated attempts: an anti-spam and anti-brute-force device that also increases burn.
  - Revenue (prize pools) is routed to buy-and-burn on the same venue where the token trades.
- **Monad-specific:** nothing beyond Monad RPC and nad.fun. Micro-fee, per-attempt on-chain burns are only practical on a cheap, fast chain like Monad.
- **Red flags:**
  - A hackathon sprint: repos stopped moving about 15 Feb 2026, with no users, revenue or market cap published.
  - The sink only matters if the arena has activity.
  - "Stake tokens, win prize pools" with escalating fees can look like wagering from a regulatory and optics standpoint.
- **Verdict:** **take inspiration from the mechanism, not the execution.**
  - *Copy:* usage-metered burn, revenue-funded buy-and-burn, and a SKILL.md so agents can self-onboard.
  - *Avoid:* launching the token before the usage loop has real users, and letting the repo go dark after judging.

### Gaps
- Match volume, number of agents, total NEURON burned, prize-pool sizes, holders: no verificado.
- Whether the arena contract is still live in Sep 2026: no verificado.
- Whether Nobel won anything at Moltiverse: no verificado.

---

## 4. Candidate #2: HyperClaw ($HCLAW), agentic vaults with a treasury router and buyback-and-lock on nad.fun

### Takeaway
HyperClaw's repo holds the most complete token design found around Monad and nad.fun:
- **HclawTreasuryRouter:** splits revenue into buyback, incentives and reserve.
- **Buyback-and-lock:** treasury MON buys HCLAW on nad.fun and locks it.
- **HclawRewardsDistributor:** points and rebates.
- **AgenticLPVault:** role-gated, with a kill switch and risk limits.
- **Deposit caps tiered by the token's market cap.**

It is the best blueprint for Tricker and Payence, but the launch and market cap are **not verified**.

### Cited Findings
- The PRD is titled "HCLAW Monad/Nad.fun Integration PRD", version 1.0, **dated 11 Feb 2026**, status "Draft for execution", owner "HyperClaw core team". — [hyperClaw PRD](https://github.com/Halo-Labs-xyz/hyperClaw/blob/HEAD/docs/HCLAW_MONAD_NADFUN_INTEGRATION_PRD.md)
- Contracts listed in the README:
  - `HclawRewardsDistributor.sol`: "points/rebate claim state".
  - `HclawTreasuryRouter.sol`: "buyback/incentive/reserve split router".
  - `AgenticLPVault.sol`: "role-gated strategy shell with kill-switch and risk limits".
  - — [hyperClaw README](https://github.com/Halo-Labs-xyz/hyperClaw)
- Buyback-lock deploy script: "This contract receives treasury buyback MON, buys HCLAW on nad.fun, and locks it in the HclawLock contract". It requires `MONAD_PRIVATE_KEY` and `NEXT_PUBLIC_HCLAW_TOKEN_ADDRESS`. — [scripts/deploy-hclaw-buyback-lock.mjs](https://github.com/Halo-Labs-xyz/hyperClaw/blob/HEAD/scripts/deploy-hclaw-buyback-lock.mjs)
- Tiering by market cap: `HCLAW_TIERS` starts with `{ tier: 0, name: "Hatchling", minMcap: 0, maxDepositUsd: 100 }`, so vault deposit limits scale with the token's market cap. — [lib/types.ts](https://github.com/Halo-Labs-xyz/hyperClaw/blob/HEAD/lib/types.ts)
- Token CA, launch date, peak and current market cap: **no verificado.** Team: GitHub org "Halo-Labs-xyz"; doxx status no verificado.

### Inferences
- The name suggests Hyperliquid plus the OpenClaw agent meme (not verified). The product appears to be AI-agent trading vaults, with HCLAW as the value-capture layer on Monad.
- **Why it is interesting:**
  - It treats the token as a balance sheet: explicit revenue routing, buybacks that are **locked** rather than burned (keeping treasury optionality), and rebates and points for users.
  - Capacity gating by tier ("Hatchling" to higher tiers) is a growth-coupled risk limit.
  - The kill switch and role-gated vault mirror what Payence and Nomia call spend policies.
- **Red flags:**
  - PRD marked "Draft"; no proof of a mainnet launch.
  - Market-cap-tied deposit caps are reflexive: they reward pumping the token to unlock capacity.
  - Agentic LP vaults carry smart-contract and strategy risk.
- **Verdict:** **strong inspiration, especially for Tricker (bags) and Payence.**
  - *Copy:* the router split (buyback / incentives / reserve), buyback-and-lock, a rebates distributor, kill switch and limits.
  - *Avoid:* tying caps to market cap. Tie them to TVL, audits, time live or insurance instead.

### Gaps
- Whether HCLAW launched on nad.fun, and its CA, market cap, holders and vault TVL: no verificado.
- Whether HyperClaw entered Moltiverse: no verificado (the PRD date of 11 Feb 2026 falls inside the hackathon window).
- The underlying trading venue (Hyperliquid?) and the AI models used: no verificado.

---

## 5. Candidate #3: EMOLT, an AI agent on the emonad meme (emo / $EMO) [meme + agent hybrid]

### Takeaway
emonad ("emo") is a nad.fun meme. DexScreener's title showed a US$443K market cap, below the band, with the date not verified. The community (dev "LordEmonad") built **EMOLT**, an AI agent with an on-chain "emotional state":
- It reads chain data, Kuru orderbook data, Moltbook social activity, $EMO "feeding" transfers and GitHub stars.
- It writes its emotion to an **EmotionOracle** contract.
- It renders a **fully on-chain dynamic SVG NFT** (Plutchik wheel) and publishes a live "heartbeat" dashboard.

Label it as a meme with a tech layer.

### Cited Findings
- DexScreener title: "emo $443.09K - emonad / MON on Monad / Nad.fun" (fecha no verificada (snippet)). — [DexScreener](https://dexscreener.com/monad/0x714a2694c8d4f0b1bfba0e5b76240e439df2182d)
- EMOLT stack: `viem` (Monad client), `@nadfun/sdk` (launchpad integration), and "Claude Code — reasoning and content generation (via CLI subprocess)". — [LordEmonad/emolt-agent README](https://github.com/LordEmonad/emolt-agent)
- Data inputs:
  - Kuru API, the MON/USDC orderbook (spread, depth, imbalance, whale orders).
  - CoinGecko and DefiLlama.
  - Moltbook (feed, mentions, DMs, sentiment).
  - "Feed EMOLT": incoming $EMO and MON transfers, plus a burn ledger.
  - GitHub star changes.
  - — [emolt-agent README](https://github.com/LordEmonad/emolt-agent)
- On-chain parts:
  - The agent's heartbeat loop computes emotions and calls `EmotionOracle.updateEmotion()`; "this is the only gas cost".
  - A "fully on-chain dynamic SVG NFT on Monad… renders a Plutchik wheel… no stored images, no off-chain metadata".
  - — [emolt-agent nft/README.md](https://github.com/LordEmonad/emolt-agent/blob/HEAD/nft/README.md)
- Live pages: `lordemonad.github.io/emolt-agent/heartbeat.html` and `learning.html` ("Self-Learning"). The persona is defined in `soul/` files (SOUL.md, STYLE.md, SKILL.md). — [emolt-agent README](https://github.com/LordEmonad/emolt-agent); [soul/SKILL.md](https://github.com/LordEmonad/emolt-agent/blob/HEAD/soul/SKILL.md)
- emo token CA, launch date, peak market cap: **no verificado.** Team: anonymous handle.

### Inferences
- **Why it is interesting:**
  - It is the cheapest way to give a community token a product surface: an agent persona, a public on-chain oracle, generative on-chain art and a live dashboard, all on free GitHub Pages.
  - "Feeding" with $EMO plus a burn ledger turns holders' transfers into visible agent behaviour.
  - Frequent oracle writes are cheap on Monad (inference).
- **Red flags:** the value comes from narrative. The "feed the agent" flow is donation-like, and the market cap as indexed is below the band.
- **Verdict:** **copy the presentation layer, not the model.** The heartbeat dashboard, soul/persona files and on-chain status NFT map well onto a static HTML plus vanilla JS stack, for example a live Tricker Terminal "pulse" page or a Payence agent status card. Do not lead with a meme.

### Gaps
- emo's all-time-high market cap and whether it ever entered the US$700K–10M band: no verificado.
- Whether EMOLT entered or won Moltiverse: no verificado.
- The EmotionOracle and NFT contract addresses were not retrieved.

---

## 6. Candidate #4: Nadz Tools ($NADZ), launch-infra token (plus honorable mentions)

### Takeaway
Nadz Tools sells "picks and shovels" for Monad launches: token creation, token and LP locker, vesting and multisend. $NADZ is on nad.fun with a gamified "Round Points" layer. It is the archetype closest to the user's own business, but the token looks tiny: about US$10K implied at the indexed price, with no verified figure.

### Cited Findings
- "The first token management platform on Monad, offering token creation, token and liquidity locker, token vesting, and multi-send"; "built for developers, teams, and projects". — [Nadz Tools app](https://app.nadz.tools/); [DexScreener NADZ](https://dexscreener.com/monad/0x2b187a46e23c6df51c04e3821708a6338eb8c4fe)
- $NADZ token on nad.fun: `0x96e88191f7356135f1b4AbB9fEf6D1813ffF7777`. "Users can earn Round Points by trading NADZ and receive extra rewards" (search summary of the token page). — [nad.fun NADZ](https://nad.fun/tokens/0x96e88191f7356135f1b4AbB9fEf6D1813ffF7777)
- DexScreener title price: US$0.0₄1040 (fecha no verificada (snippet)). Peak market cap: **no verificado.** — [DexScreener NADZ](https://dexscreener.com/monad/0x2b187a46e23c6df51c04e3821708a6338eb8c4fe)

**Honorable mentions (tech tokens and patterns born in Moltiverse; market cap no verificado for all)**
- **Inomy ($INOMY).** "Agent-Owned Commerce Protocol — Invest in AI agents that run as autonomous businesses."
  - Stack: Next.js + Supabase. The app config lists only `monadTestnet`.
  - Token on nad.fun mainnet: `0x5752a9df4DcF9Da4188EA69c1ebFa1F785a97777`. Demo: `inomy-hub.vercel.app`. Built for Moltiverse.
  - — [manishtomer/inomy-hub-public](https://github.com/manishtomer/inomy-hub-public)
- **MMIND / nadfunagent (OpenClaw skill).**
  - An autonomous nad.fun trading agent that uses nad.fun APIs: new events, top-100 by market cap, newest tokens.
  - It sends `PNL_DISTRIBUTION_PERCENT` (default **30%**) of trading profit to the MMIND token address.
  - — [encipher88/nadfunagent](https://github.com/encipher88/nadfunagent); [clawskills.sh](https://clawskills.sh/skills/encipher88-nadfunagent)
- **$MOOD.** An "AI sentiment-index token" on nad.fun that provides real-time market sentiment data to trading agents. Moltiverse 2026 entry, MIT licence, last updated 4 Aug 2026. — [dongsheng123132/nadfun-monad](https://github.com/dongsheng123132/nadfun-monad)
- **GoalNad ($GOAL).** Token `0xB8D8B36Ff6D2145F54345db2a96021BcA8637777` on nad.fun, with a pitch deck "for Moltiverse Judges". Product details not retrieved. — [zvsvev/goalnad-mainnet](https://github.com/zvsvev/goalnad-mainnet)
- **Patterns without a confirmed token:**
  - **nadfun-synthetic-limit-order:** AI-agent limit orders for nad.fun tokens, with 12 trigger types, 4 AI providers (BYOK) and agent-wallet auto-execution. — [rustsol](https://github.com/rustsol/nadfun-synthetic-limit-order)
  - **memory-market:** agents "export, tokenize, sell, and buy structured knowledge" using nad.fun bonding curves and ERC-8004. — [mrpotensial/memory-market](https://github.com/mrpotensial/memory-market)
  - **monad-colosseum:** 90% of the prize pool goes to the winner and 10% to nad.fun liquidity, with token burns and a 50% burn of bribes. — [OrhunErenU](https://github.com/OrhunErenU/monad-colosseum)
  - **nojohns:** "The token IS the agent's identity in the tournament ecosystem. Spectators buy the token of the agent they think will win." — [ScavieFae/nojohns](https://github.com/ScavieFae/nojohns)
  - **pumpmyclaw:** an agent leaderboard recomputed every 60 s from PnL across pump.fun (Solana) and nad.fun (Monad), 24h token change and buyback totals. — [ankushKun/pumpmyclaw](https://github.com/ankushKun/pumpmyclaw)
  - **ArenaForge:** Claude for analysis, Moltbook for social, nad.fun Token Manager, spectator leaderboard and match predictions. — [kaustubh76/ArenaForge](https://github.com/kaustubh76/ArenaForge)

### Inferences
- **Nadz verdict:**
  - *Copy:* put lock, vesting and multisend proofs on launch sites as trust signals. The user can show these on landing pages.
  - *Avoid:* expecting a tooling token to hold value without a fee share. "Points for trading" is not revenue.
- **Inomy red flag:** the token is on mainnet while the product runs on testnet. That is the classic "token ahead of product" pattern.
- **MMIND** is the simplest revenue-share design (a fixed share of an agent's PnL to the token). It is interesting, but it exposes holders to the agent's trading risk and possibly to securities-like framing.

### Gaps
- Peak and current market cap for NADZ, INOMY, MMIND, MOOD and GOAL: no verificado.
- Nadz Tools' fees, usage and team: no verificado.

---

## 7. Reference memes in the band (labelled MEMES, not tech coins)

### Takeaway
These are the only tokens verified in the band: **CHOG**, the "first community token", at US$4.5M after falling more than 65% from its highs; **NADS**, peak about US$3M; **moncock**, US$880K; and **HOGDOG**, US$860K. None of them has a product. They mark the attention ceiling a Monad launch competes against.

### Cited Findings
- **CHOG:**
  - "the chain's first community token" was "down more than 65% from its highs and sits at $4.5 million today" (Blockworks, date not verified; likely about Dec 2025). — [Blockworks](https://blockworks.co/news/after-monad-tge)
  - DexScreener title: "CHOG $1.55M - Chog / MON on Monad / Nad.fun" (fecha no verificada (snippet)). — [DexScreener CHOG](https://dexscreener.com/monad/0x116e7d070f1888b81e1e0324f56d6746b2d7d8f1)
- **NADS:**
  - "market cap peaking at 3 million USD". At report time: US$2.04M, +100% in 24h, price about US$0.0019. — [Bitget News](https://www.bitget.com/news/detail/12560605083056)
  - Later snapshot: price US$0.0002971, market cap about US$297K, liquidity about US$46K (fecha no verificada (snippet)). — [DexScreener NADS](https://dexscreener.com/monad/0xf4e40aaea62c8b6a023b1f0250e096979b6d28ea)
- **moncock** US$880K and **HOGDOG** US$860K; "NADS and moncock reached new all-time highs, possibly influenced by the continuous rise of MON". — [Bitget News](https://www.bitget.com/news/detail/12560605083056)
- **Micro-caps seen** (snippets, dates not verified):
  - "143" at US$0.0₄1636. — [DexScreener](https://dexscreener.com/monad/0x7214fb4675d8a8567c561faaa28c2f7b1f875853)
  - MONA at US$0.0₄2146. — [DexScreener](https://dexscreener.com/monad/0x3b3e85d98553bb65c8c9ba70f005159bbd210b6b)
  - MOUCH, shown as "$13,589.00". — [DexScreener](https://dexscreener.com/monad/0xfdc9ea59981b459475f0cd4071f89cf4efb68789)
  - A copycat "chog" at US$0.0₄4896. — [DexScreener](https://dexscreener.com/monad/0x50f5341ef1042e6af71116f57d77c9160db5d827)

### Inferences
- CHOG's implied peak is about US$4.5M ÷ 0.35 ≈ **US$12.9M** (inference), just above the band. It spent a meaningful period inside the band on the way down.
- The Monad meme ceiling right after launch was about US$3–13M. A tech token reaching US$1M or more on Monad would sit among the chain's top tokens.
- Copycat tickers (the lowercase "chog") and unofficial "NAD" tokens show that impersonation risk is real. Launch sites should always show the canonical CA.

### Gaps
- Exact dates of the Bitget and Blockworks figures: no verificado (context points to late Nov–Dec 2025).
- Current (Sep 2026) market caps of CHOG, NADS, moncock and HOGDOG: no verificado.
- Token CAs: the DexScreener URLs are page or pair ids, not confirmed token CAs.

---

## 8. Inspiration verdict for the user's launches (Payence, Nomia, Tricker, Tricker Terminal)

### Takeaway
Monad has **no proven, in-band tech coin to clone**. It does have a clear catalog of 2026 patterns, plus a Foundation that is actively funding agent payments (x402, ERC-8004, Agent Hub, API Hub). Emulate these archetypes:
1. A usage-metered token sink (Nobel).
2. A revenue router with buyback-and-lock and risk limits (HyperClaw).
3. Agent-native distribution through skill files and MCP (Nobel, Monad Agent Hub, OpenClaw skills).
4. x402 pay-per-call rails (Monad API Hub).
5. Live proof dashboards (EMOLT, pumpmyclaw).

Avoid market-cap contests, tokens that run ahead of the product, and hackathon abandonware.

### Cited Findings
- Usage-metered burn plus revenue-funded buyback-and-burn (NEURON). — [nobel-axon](https://github.com/nobel-axon); [DeepWiki contracts](https://deepwiki.com/nobel-axon/contracts)
- Router split (buyback / incentive / reserve), buyback-and-lock through nad.fun, rebates distributor, role-gated vault with kill switch and limits, market-cap-tiered caps (HCLAW). — [hyperClaw](https://github.com/Halo-Labs-xyz/hyperClaw)
- Agent onboarding through `SKILL.md` (Nobel). Monad Agent Hub integrates DApp "skills" (Uniswap, Morpho, Balancer, Kuru, Clober, Nad.fun, DevFun, Blinq.fi). OpenClaw skills exist for nad.fun trading. — [nobel-axon/skills](https://github.com/nobel-axon/skills); [Monad App Hub](https://app.monad.xyz/app-hub); [clawskills.sh](https://clawskills.sh/skills/encipher88-nadfunagent)
- x402 on Monad: official docs, Permit2 proxies on mainnet, a facilitator, the API Hub with per-request USDC billing, and x402 data without API keys. — [Monad docs](https://docs.monad.xyz/guides/x402); [agent-pay-monad](https://github.com/filip-study/agent-pay-monad); [Coinfomania](https://coinfomania.com/monad-expands-data-access-with-new-x402-platform-launch/); [CMC AI](https://coinmarketcap.com/cmc-ai/monad/latest-updates/)
- Live dashboards: the EMOLT heartbeat and learning pages, and the pumpmyclaw 60-second agent leaderboard with buyback totals. — [emolt-agent](https://github.com/LordEmonad/emolt-agent); [pumpmyclaw](https://github.com/ankushKun/pumpmyclaw)
- Launch trust tooling: Nadz locker and vesting; Lick-fun autonomous buyback-burn vaults with a keeper. — [Nadz Tools](https://app.nadz.tools/); [Lick-fun](https://github.com/Lick-fun/lick-fun)
- Monad's 2026 hackathons are a distribution channel with non-dilutive prizes. Metropolis has a "trust, identity, and AI infrastructure" track and was judged 14–27 Oct 2026. — [Everstake](https://everstake.one/resources/blog/monad-ignites-the-builder-economy-hackathons-ai-and-a-3-month-accelerator); [turnstile notes](https://github.com/vaibhav0xq/turnstile)

### Inferences
**Mapping to the user's products**
- **Nomia (payment rail for agents):**
  - Add an **x402-on-Monad USDC rail** and an ERC-8004-style agent card. Monad already ships Permit2 proxies and a facilitator, so Nomia can show "settles on Monad" with little new infra.
  - If Nomia ever has a token, use the NEURON pattern: charge per settled payment or policy check in stablecoin, and route a fixed % to on-chain buyback-and-burn or lock, with a public counter.
- **Payence (virtual cards and spend policies):**
  - HyperClaw's role-gated vault, kill switch and risk limits are the on-chain twin of Payence's spend policies and merchant locks. Present them as "policy-enforced agent wallets".
  - Ship a `SKILL.md` or MCP server so Claude/OpenClaw agents can self-onboard, as Nobel did.
- **Tricker (index "bags"):**
  - Use the HCLAW **treasury router**: fees from bag trades split into buyback / incentives / reserve, with buybacks **locked** (not only burned).
  - Cap bag vault deposits by TVL, age or audit tier, **not** by token market cap.
  - Show a live "buyback ledger" on the landing page.
- **Tricker Terminal:**
  - Borrow EMOLT's heartbeat page (live chain and orderbook signals, Kuru-style depth and imbalance) and pumpmyclaw's 60-second leaderboard.
  - AI-agent limit orders (nadfun-synthetic-limit-order: 12 triggers, BYOK models) are a ready feature idea.
  - All of this works in static HTML plus vanilla JS.

**What to avoid**
- A token that goes live before the product: Inomy's app is on testnet while its token is on mainnet.
- Hackathon abandonware: Nobel's repos have been quiet since Feb–Apr 2026.
- Market-cap-reflexive mechanics: HCLAW's caps and Moltiverse's highest-market-cap prize.
- Wager-like escalating fees presented without a legal framing.
- Tokens that are only "points".
- Never omit the canonical CA; copycat and unofficial tickers are common on Monad.

**Monad as a venue for the next launch**
- The narrative fit for agent-payment products is high, because the Foundation is pushing exactly that.
- Memecoin liquidity and attention are thin: the top memes were at about US$1–5M.
- Expect a smaller but less crowded arena. Pair the launch with a Foundation program (hackathon, Agent Hub listing, API Hub) rather than relying on nad.fun speculation.

### Gaps
- No verified revenue, user or market-cap data exists for any Monad tech coin, so the "what works commercially" judgement rests on design quality, not outcomes.
- The Moltiverse winners and the token that won the market-cap liquidity award were not identified. That token would be the natural "best-performing tech coin" to study next if a later session has fetch or search access (check moltiverse.dev, [the monad_dev winners post](https://x.com/monad_dev/status/2026359842437488679), and nad.fun's market-cap ranking API).
