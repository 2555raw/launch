# Solana "tech coins" that touched a US$700K–US$10M market cap (research as of 2026-09-26)

**Method note (read first).** Only WebSearch worked in this environment. The session-wide WebSearch cap (200 calls, shared with the parallel researchers) ran out after this researcher's 24th query. WebFetch and curl are blocked by the egress policy. So **no figure below was checked live** on DexScreener, GeckoTerminal, Birdeye or GMGN. Market caps come from search-result titles, snippets and summaries.

**GitHub-sourced items (scope disclosure).** Before the coordinator limited GitHub MCP use to the `2555raw/launch` repo, this researcher had already made 10 GitHub MCP search calls on public repos outside that scope:
- 1 `search_repositories` call (`org:Dexter-DAO`);
- 9 `search_code` calls: in thedotmack/claude-mem, Dexter-DAO/dexter-x402-sdk, org:Dexter-DAO, bagsfm/bags-sdk, pump-fun/pump-fun-skills and ikhwanhsn/syra_agent (no results), plus global code searches for the CMEM mint, the DEXTER mint and `"CMEM" "market cap"`.

Two `get_file_contents` attempts on outside repos were refused. No GitHub calls were made after the restriction was communicated.

The data is public and cited to github.com URLs. In these notes it is identifiable as **any fact that cites a specific file inside a repo (shown as file `…`, or "README/examples") or repo metadata (stars, forks, creation or update dates, repo descriptions)**. The coordinator or report writer may drop these items if the tool-scope rule should also apply to calls made before it arrived. They are the main source for:
- Dexter's official CA confirmation and its 25% token discount;
- Dexter "Tabs" and the passkey wallet;
- Dexter's repo activity;
- the CMEM airdrop and CMEM Pro details;
- the moollm GAS timeline;
- Bags `feeClaimers`;
- pump.fun's tokenized-agent defaults.

Labels:
- **"Current"** = the snapshot shown in search results in Sep 2026. The exact timestamp was not visible.
- **"Derived"** = my own arithmetic from cited inputs, labelled as such.
- **"no verificado"** = not found in any source.

This is tech/product analysis, not investment advice.

---

## 1. Shortlist and ranking: which Solana tech coins fit the band?

### Takeaway
Only one well-documented Solana tech coin clearly peaked **inside** the band: **Dexter AI ($DEXTER)**, an x402 payments facilitator and agent-wallet stack. Its derived ATH is ≈ US$5.9M and it now trades at ≈ US$0.35M. The other three:
- **Claude Memory ($CMEM):** a very strong product, but its peak market cap is no verificado.
- **Paystream ($PAYS):** a MetaDAO ownership coin at the floor of the band (≈ US$0.68M).
- **Gas Town ($GAS) and $RALPH:** these only passed through the band on the way up or down from ≈ US$60M peaks.

Recommended "best 2" for the report: **#1 Dexter, #2 CMEM**, with CMEM's market-cap caveat stated and GAS/RALPH as the cautionary backdrop.

### Cited Findings
- **#1 Dexter AI ($DEXTER)** (pump.fun, late 2025).
  - Search summaries of the "Dexter AI" price pages give an ATH price of $0.005890, a circulating supply of 1B and a current MC of $346,850 — [CoinGecko](https://www.coingecko.com/en/coins/dexter-ai) / [Coinbase](https://www.coinbase.com/en-in/price/solana-dexter-ai-pump). The exact page behind each figure was not isolated; the wording matches CoinGecko.
  - The token was released on pump.fun in late 2025 — [LBank](https://www.lbank.com/price/dexter-ai/what-is).
- **#2 Claude Memory ($CMEM)** (Bags.fm; the CA ends in "BAGS").
  - Current MC $6,654.96 (FDV identical, 1B max supply) — [CoinGecko](https://www.coingecko.com/en/coins/claude-memory).
  - Peak MC: **no verificado**.
- **#3 Paystream ($PAYS)** (MetaDAO ICO).
  - Raised $750K. MC $680K while trading about 30% below its ICO price (date not shown) — search summary; the source page is likely [blocmates](https://www.blocmates.com/articles/metadao-projects-distilled), possibly the [MEXC-hosted MetaDAO article](https://www.mexc.com/news/129206).
- **#4 (case study) Gas Town ($GAS)** (Bags.fm, Jan 2026).
  - Reached ≈ $60M on Jan 15, 2026, then fell about 98% to ≈ $1.1M — [Whale Alert](https://whale-alert.io/stories/d27c01673ae5/Gas-Town-GAS-tumbles-98-to-11M-after-creator-Steve-Yegge-distances-himself-other-Bags-launchpad-tokens-also-plunge).
  - "From $10M to $60M" on Jan 16, 2026 — [SimHacker/moollm analysis](https://github.com/SimHacker/moollm) (file `designs/gastown/YEGGE-ARC-ANALYSIS.md`).
  - Current MC $40,052.93 — [CoinGecko](https://www.coingecko.com/en/coins/gas-town).
- **Honorable mention (closest analog to Tricker Terminal, likely below the band): Syra Agent ($SYRA).** ATH price $0.0003887; now 81.2% below it — [CoinGecko](https://www.coingecko.com/en/coins/syra-agent).
- **Above the band (context only):**
  - PayAI: ATH ≈ $58.9M on Oct 27, 2025 — [Bitget News](https://www.bitget.com/news/detail/12560605032404).
  - RALPH: ATH $58.74M on Jan 21, 2026 — [crypto.news](https://crypto.news/ralph-meme-coin-tanks-after-de-risking-token-sale-by-dev-wallet/).
  - KLED: $15.6M and DUPE: $10.58M, current — [FXEmpire Believe category](https://www.fxempire.com/crypto/categories/believe-app-ecosystem).

### Inferences
- **Why this ranking.**
  - Dexter is the only candidate with an in-band peak (derived), a working product with measurable usage, an official CA in its own repo, and active GitHub commits in Sep 2026.
  - CMEM has the strongest product traction (a very popular open-source repo plus a paid hosted tier). It also has the clearest token disclosure. But its band fit cannot be proven.
  - Paystream fits the band, but its product (P2P lending) is less relevant to the user.
  - GAS is the best-documented example of the Bags "GitHub developer token" meta, but its ATH is 6× the top of the band.
- In 2025–2026, the US$0.7–10M band behaves more like a **post-hype resting zone** than a place where tokens peak. GAS (≈ $1.1M), RALPH ($1.5M) and LAUNCHCOIN (≈ $1.6M current) all landed there after crashes. Tokens that *peak* inside the band tend to be product-first projects without a viral celebrity developer (Dexter).

### Gaps
- No verified ATH market cap for CMEM or Paystream, and no ATH date for Dexter. Live chart checks were impossible (WebFetch/curl blocked; search budget exhausted).
- These narratives were **not** covered in depth for lack of search budget: trading terminals/bots, DePIN, privacy small caps (beyond Umbra), Moonshot, Heaven and Jupiter Studio launches. There may be better in-band candidates there.

---

## 2. Candidate #1: Dexter AI ($DEXTER), x402 facilitator plus agent wallet/MCP stack

### Takeaway
Dexter is a working "financial OS for AI agents" on Solana:
- an x402 facilitator that handled most Solana x402 traffic in late 2025;
- a TypeScript SDK with capped, metered payment "Tabs";
- passkey-based non-custodial agent wallets;
- MCP connectors for ChatGPT, Claude, Codex and Cursor.

Its pump.fun token has a derived ATH of ≈ US$5.9M (inside the band) and now sits ≈ 94% lower. It is the closest analog to Payence/Nomia. **Verdict: take strong inspiration from the product, docs and proof-of-usage; do not copy the token's weak value capture.**

### Cited Findings
**Identity**
- Name and ticker: Dexter AI / DEXTER. The official CA `EfPoo4wWgxKVToit7yX5VtXXBrhao4G8L7vrbKy6pump` appears in Dexter's own repo: "The DEXTER token is Dexter's Solana token (`EfPoo4wWgxKVToit7yX5VtXXBrhao4G8L7vrbKy6pump`)" — [Dexter-DAO/opendexter-ide](https://github.com/Dexter-DAO/opendexter-ide) (file `packages/mcp/skills/instinct-advertiser/SKILL.md`).
- Other sources match that CA:
  - Coinbase India lists the same mint in lowercase — [Coinbase](https://www.coinbase.com/en-in/price/solana-dexter-ai-pump).
  - A third-party token list records "Dexter AI", 6 decimals, classic SPL token program — [Rioxdevsol/xstok-platform](https://github.com/Rioxdevsol/xstok-platform) (file `scripts/new-entries.txt`).
- Launchpad and date: pump.fun, "late 2025" — [LBank](https://www.lbank.com/price/dexter-ai/what-is). Exact launch date **no verificado**.
- The product came before the token: the `dexter-mcp` repo was created 2025-09-17 — [GitHub Dexter-DAO/dexter-mcp](https://github.com/Dexter-DAO/dexter-mcp).
- **Ticker collisions:**
  - An OpenSea page titled "DEXTER (DEXTER)" uses a *different* mint, `EU3Mv9ZkmfZsdEuE4QD8xDdX1aRETfKiBx9c5gSHpump` — [OpenSea](https://opensea.io/token/solana/EU3Mv9ZkmfZsdEuE4QD8xDdX1aRETfKiBx9c5gSHpump).
  - Coinbase also lists an unrelated "DEX TRADER (DEXTER)" — [Coinbase](https://www.coinbase.com/price/dex-trader-solana-d6fa0488).
  - Another DexScreener DEXTER pool shows "$4,583" — [DexScreener](https://dexscreener.com/solana/hgreumcnytmo98eq3yzmxp4radktmp9nkwad1nvvumqd).

**Market cap**
- ATH price $0.005890; circulating supply 1 billion; current MC $346,850 (Sep 2026 snapshot) — search summaries of [CoinGecko](https://www.coingecko.com/en/coins/dexter-ai) / [Coinbase](https://www.coinbase.com/en-in/price/solana-dexter-ai-pump) "Dexter AI" pages. Caveat: several unrelated "DEXTER" tokens exist, so a live check of the ATH on the `EfPoo4…pump` mint is still needed.
- The DexScreener page title for the "Dexter AI / SOL on PumpSwap" pool reads "$309.67K". Which metric and timestamp this is was not visible — [DexScreener](https://dexscreener.com/solana/csqt5axbzlcsd13dpy6ayltrkcu5q1nztapam67elxro).
- Status: **active**. The GitHub org shows commits and updates through 2026-09-25 (see Traction).

**Product and how it works**
- **x402 facilitator.** It verifies, signs and settles x402 (HTTP 402 plus stablecoin) payments on Solana and is open to any developer or project — [dexter.cash/facilitator](https://dexter.cash/facilitator).
  - Public facilitator address: `DEXVS3su4dZQWTvvPnLDJLRK1CeeKG6K3QqdzthgAkNV` — [Orb explorer](https://orbmarkets.io/address/DEXVS3su4dZQWTvvPnLDJLRK1CeeKG6K3QqdzthgAkNV/history).
- **Positioning.** A "vertically-integrated operating system and an x402-based economy for interactive AI agents" — search summary of price-page descriptions ([CoinGecko](https://www.coingecko.com/en/coins/dexter-ai) / [LBank](https://www.lbank.com/price/dexter-ai)).
  - Claims "crypto's first native ChatGPT App, Claude Connector, and secure realtime voice agent" — search summary. The source is one of [dexter.cash/facilitator](https://dexter.cash/facilitator) or [LBank](https://www.lbank.com/price/dexter-ai/what-is), not isolated.
- **Feature list per a third-party explainer:** pay-per-call API billing, LLM-integrated trading, voice control, social (SNS) integration, private transfers; X handle @dexteraisol — [Web3ResearchGlobal](https://www.web3researchglobal.com/p/dexter).
- **Dexter Connectors** link authenticated AI agents to Solana wallets, so users can research markets, trade and monitor portfolios from inside ChatGPT and Claude — search summary of [CoinGecko](https://www.coingecko.com/en/coins/dexter-ai).
- **x402 SDK.** "TypeScript SDK for x402 buyers and sellers, with bounded Solana Tabs and one-shot multichain payments" — [Dexter-DAO/dexter-x402-sdk](https://github.com/Dexter-DAO/dexter-x402-sdk). What the README and example code show about Tabs:
  - one open tab per seller, reused across calls (`payUrlWithTab`);
  - a `totalCap` spending cap;
  - a "tab rail: stream + meter + settle";
  - `tab.cumulative()` receipts that are "accrual counters, not settlement confirmations", with settlement at tab close;
  - seller documentation at docs.dexter.cash/docs/get-paid/sell-with-tabs;
  - examples `metered-inference` and `push-per-send` — [dexter-x402-sdk README and examples](https://github.com/Dexter-DAO/dexter-x402-sdk).
- **Wallet.** "Your passkey creates a non-custodial Solana wallet. Dexter never receives the key." — [Dexter-DAO/dexter-mcp](https://github.com/Dexter-DAO/dexter-mcp) (file `apps-sdk/ui/src/entries/dexter-wallet.tsx`).
- **Other repos in the org:**
  - `dexter-mcp`: "hosted Dexter and OpenDexter MCP runtimes, including OAuth-bound Wallet, x402, and governed asset tools".
  - `opendexter-ide` (created 2026-03-04): clients and plugins for a "governed Dexter Wallet across ChatGPT, Codex, Claude Code, Cursor".
  - `dexter-connect` (created 2026-06-20): "Passkey-based Dexter identity, Wallet access, and governed agent authority for web apps".
  - `dexter-mainnet-proofs` (archived): "Historical June 2026 proof receipts for the Dexter Vault deployment before its August 18 upgrade".
  - `clawdexter` (created 2026-01-28, archived): an OpenClaw plugin for x402 discovery and payments.
  - `composed-skills`: a "Legacy x402gle experiment".
  - Source for all of the above: [GitHub org Dexter-DAO](https://github.com/Dexter-DAO).
- **Token utility found in the repo (verified).** Advertisers can "fund a campaign in DEXTER instead of USDC and get a **25% discount**" (`asset: "dexter"`) — [opendexter-ide SKILL.md](https://github.com/Dexter-DAO/opendexter-ide).
- **Token utility per an exchange blurb (unverified).** DEXTER is "utilized for transaction facilitation, staking, and granting access to premium agent functionalities" — [LBank](https://www.lbank.com/price/dexter-ai/what-is). The GitHub searches found no staking, buyback or burn code.
- **Community activity.** Issue #73 proposes a feeless Nano (XNO) settlement rail beside USDC across the SDK's chains — [GitHub issue](https://github.com/Dexter-DAO/dexter-x402-sdk/issues/73).

**Traction**
- About 68.7% of all x402 transactions on Solana went through Dexter, which also handled more than 75% of the volume. Date likely around Dec 2025, no verificado — [Coinspot](https://coinspot.io/en/analysis/solana-controls-49-of-the-x402-market-amid-the-race-for-micropayments/); [SolanaFloor](https://solanafloor.com/news/solana-commands-49-of-x402-market-share-as-the-race-for-micropayment-dominance-intensifies).
- Dexter "has overtaken Coinbase to become the largest daily facilitator for x402 transactions since December 11" (2025 by context) and "controls over 50% of X402 transactions" — [MEXC News](https://www.mexc.com/news/395460); [MEXC News](https://www.mexc.com/news/392947) (search summary).
- **GitHub, as of Sep 2026:**

  | Repo | Stars | Forks | Other | Last update |
  |---|---|---|---|---|
  | `dexter-mcp` | 11 | 5 | — | 2026-09-25 |
  | `dexter-x402-sdk` | 3 | 4 | 23 open issues | 2026-09-17 |
  | `opendexter-ide` | 2 | — | — | 2026-09-18 |

  Source: [GitHub Dexter-DAO](https://github.com/Dexter-DAO).
- Team: **no verificado**. It presents as a brand (X @dexteraisol, GitHub org "Dexter-DAO"); no named founders were found.

**Red flags**
- The token did not track usage. Dexter led the facilitator market while the MC fell from ≈ $5.9M (derived ATH) to ≈ $0.35M — [CoinGecko](https://www.coingecko.com/en/coins/dexter-ai).
- Several unrelated "DEXTER" tokens create an impostor risk (see Identity).
- Exchange-described utilities such as staking are not evidenced in the repos.
- Few GitHub stars (≤ 11 per repo), which suggests limited outside developer adoption of the SDK itself.
- Supply distribution, insider holdings and bundling: **no verificado**.

### Inferences
- **Derived ATH MC** ≈ $0.005890 × 1,000,000,000 ≈ **US$5.89M**, inside the band. It may reflect an intraday wick; the date is no verificado.
- **Derived drawdown** ≈ 346,850 / 5,890,000 ≈ **−94%**. Current MC is below the band.
- **Why it is interesting.**
  - It is a real payments rail with public on-chain proof: a facilitator address and a repo of mainnet proof receipts.
  - It iterated fast with each agent meta: MCP (Sep 2025) → x402 SDK (Dec 2025) → OpenClaw plugin (Jan 2026) → IDE plugins (Mar 2026) → passkey identity and a "governed agent authority" layer (Jun 2026) → Vault upgrade (Aug 2026).
  - The token has at least one concrete, legible use: a 25% discount when paying in DEXTER.
- **Direct overlap with the user's products.**
  - Tabs (a per-seller open tab with a `totalCap`, metered and then settled) is essentially a *merchant-locked spend policy with a cap*. That is Payence's "spend policies + merchant locks" in x402 form.
  - "One-shot multichain payments" plus proposals for more rails mirrors Nomia's "multi-rail settlement behind one API".
  - Passkey identity with governed agent authority mirrors Nomia's "per-agent identity".
- **Verdict: YES, take inspiration (strongest match).**
  - **Copy:**
    - code-first landing pages with a runnable snippet (for example `payUrlWithTab` with a cap);
    - public proof of usage (facilitator address, transaction-share stats, a proofs repo);
    - MCP/ChatGPT/Claude connectors as distribution;
    - a single honest token utility (a fee discount when paying in the token);
    - an official-CA block to fight ticker impostors.
  - **Avoid:**
    - launching a token whose value does not accrue from product revenue (Dexter shows market leadership ≠ token value);
    - vague "staking/premium" promises;
    - generic tickers that collide with other tokens.

### Gaps
- ATH date and exact ATH MC (only the ATH price was found). Whether any facilitator fees flow to the token (buyback, burn or treasury). Facilitator revenue in USD. Team identity. Holder concentration. Exact token launch date.

---

## 3. Candidate #2: Claude Memory ($CMEM), an open-source AI dev tool with a Bags fee-share token

### Takeaway
$CMEM is a Bags.fm token around **claude-mem**, a hugely popular open-source memory plugin for coding agents. A third party launched it; developer Alex Newman then "officially embraced" it and wove it into products (airdrops in a sibling app) while monetizing through a hosted Pro tier (cmem.ai). The token collapsed with the January 2026 Bags developer-token meta and is now illiquid (≈ US$7K–51K MC). Its peak MC is **no verificado**. **Verdict: copy the disclosure and the product funnel; avoid the third-party-launch path and meta-dependence.**

### Cited Findings
**Identity**
- CA `2TsmuYUrsctE57VLckZBYEEzdokUF8j8e1GavekWBAGS` — [Phantom](https://phantom.com/tokens/solana/2TsmuYUrsctE57VLckZBYEEzdokUF8j8e1GavekWBAGS).
- The developer's own app uses it as `CMEM_MINT` with `AIRDROP_AMOUNT = 420` — [thedotmack/crabspace-app](https://github.com/thedotmack/crabspace-app) (file `src/lib/airdrop.ts`).
- Launchpad: **Bags.fm**. The "Official $CMEM Links" block points to `bags.fm/2TsmuYUrs…WBAGS`, Jupiter, a Photon LP (`6MzFAkWnac6GSK1EdFX93dZeukGfzrFq4UHWarhGSQyd`) and DEXScreener — [README copy of claude-mem at JuanLuisLozadaGx/claude-men](https://github.com/JuanLuisLozadaGx/claude-men).
- Provenance statement, quoted: "$CMEM is a solana token created by a 3rd party without Claude-Mem's prior consent, but officially embraced by the creator of Claude-Mem (Alex Newman, @thedotmack). The token acts as a community catalyst for growth and a vehicle for bringing real-time agent data to the developers and knowledge workers that need it most." — [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem). The text was found in mirrors: [dxdyt/blog-web](https://github.com/dxdyt/blog-web) and [2kDarki/codex-mem](https://github.com/2kDarki/codex-mem).
- Launch date: **no verificado**. A community timeline lists $CMEM among Bags tokens that "also collapse" after GAS in mid/late January 2026, alongside $RALPH, $VVM and $COW — [SimHacker/moollm](https://github.com/SimHacker/moollm) (file `designs/gastown/YEGGE-ARC-ANALYSIS.md`; secondary community document).

**Market cap**
- Current MC $6,654.96 (FDV identical, 1B max supply). The main pool is Meteora DAMM v2 CMEM/SOL, with $79.22 of 24-hour volume — [CoinGecko](https://www.coingecko.com/en/coins/claude-memory).
- Other trackers show values up to ≈ $51K (search summary across [Coinbase](https://www.coinbase.com/price/claude-memory-solana-a3aa2ace), [Holder.io](https://holder.io/coins/cmem/) and others).
- Peak MC: **no verificado**.
- Status: token **near-abandoned** (negligible liquidity); product **active** (see below).

**Product and how it works**
- **claude-mem** "captures everything your agent does during sessions, compresses it with AI, and injects relevant context back into future sessions".
  - It works with Claude Code, OpenClaw, Codex, Gemini, Hermes, Copilot, OpenCode and more.
  - The core runs locally: a SQLite database plus a local HTTP API — [GitHub thedotmack/claude-mem](https://github.com/thedotmack/claude-mem).
- **cmem.ai** links memory to any MCP client (Cursor, Codex and more) "via one private link" — [cmem.ai](https://cmem.ai/).
- **CMEM Pro** is hosted memory where "Pro runs the worker and observer server-side". The upsell reads: "Get up to 100% more usage from your plan — memory runs off-plan, free for 7 days" — [claude-mem](https://github.com/thedotmack/claude-mem) (files `cowork/README.md` and `cursor-hooks/README.md`).
- **Still active in Sep 2026.** The repo documents OpenRouter price history "2026-07-01 through 2026-09-08" for CMEM observation expense reports — [claude-mem](https://github.com/thedotmack/claude-mem) (file `docs/expense-pricing/README.md`).

**Links, team and traction**
- Team: Alex Newman (@thedotmack), publicly identified — [LinkedIn](https://www.linkedin.com/in/alexnewman/).
- GitHub traction (search summary; exact source page not isolated): over 86,000 stars, more than 92 contributors, over 3,500 forks and 295+ releases — [Crypto Briefing](https://cryptobriefing.com/claude-mem-permanent-memory-46k-stars/).
- "1,400+ GitHub Stars in Single Day" (title) — [Substack](https://claudeopus45.substack.com/p/claude-code-plugin-claude-mem-explodes).
- Counterpoint: a skeptical post titled "'The Numbers Are Wild': Anatomy of a LinkedIn Tech Hype Post" shows up in the same results (content not read) — [SQLServerScience](https://www.sqlserverscience.com/professional-development/linkedin-tech-hype-anatomy/).

**Red flags**
- Launched by a third party without the developer's consent, so there was no control over launch, supply or timing — [claude-mem README statement](https://github.com/thedotmack/claude-mem).
- Collapsed together with the Bags meta — [moollm analysis](https://github.com/SimHacker/moollm).
- $79 of daily volume now — [CoinGecko](https://www.coingecko.com/en/coins/claude-memory).

### Inferences
- **Why it is interesting.** It is the clearest example of the 2026 open-source-developer-token playbook done relatively well:
  1. open-source core (free, local);
  2. a paid hosted tier that does not depend on the token (CMEM Pro);
  3. a token formally acknowledged in the README with an official-links block, which reduces scam confusion;
  4. the token reused as an ecosystem incentive (airdrops in another app by the same developer).
- The "BAGS" CA suffix and the Meteora DAMM v2 main pool suggest Bags launches graduate to Meteora pools. This is an inference; the Bags→Meteora link was not checked in these sources.
- **Verdict: PARTIAL inspiration.**
  - **Copy:** the "What about $TOKEN?" disclosure section; the official CA and links block; keeping revenue (SaaS) separate from the token; token-powered airdrops or quests inside real products.
  - **Avoid:** letting a third party launch the token, or riding a launchpad meta (the value collapsed with the meta).
  - For the user: if Tricker or Tricker Terminal are open source, a Bags-style fee-share to the GitHub identity is a known pattern. The token will likely stay illiquid unless the product itself drives demand.

### Gaps
- Peak MC and date. Creation date. The Bags fee-share percentage assigned to @thedotmack. Total fees the developer claimed. Holder distribution.

---

## 4. Candidate #3: Paystream ($PAYS) and the MetaDAO "ownership coin" archetype

### Takeaway
MetaDAO runs fixed-price public raises: every buyer pays the same price, there is a minimum raise and a monthly budget, oversubscription is refunded pro rata, and a futarchy-governed treasury controls spending. It produced several product tokens in or near the band. Paystream (P2P lending) raised US$750K and traded around US$0.68M MC, roughly 30% under its ICO price. **Verdict: a strong model for a credibility-first fintech launch page (Payence); weak on post-ICO price performance.**

### Cited Findings
- **Paystream** raised $750K through MetaDAO. It is "a peer-to-peer lending protocol on Solana featuring a built-in leveraged engine that maximizes APYs by directly connecting borrowers and lenders". MC $680K while trading 30% below its ICO price — search summary; the source page is likely [blocmates](https://www.blocmates.com/articles/metadao-projects-distilled), possibly the [MEXC-hosted MetaDAO article](https://www.mexc.com/news/129206).
  - CA, launch date and ATH: **no verificado**.
- **MetaDAO mechanics** (search summary of MetaDAO sources):
  - a public sale "where everyone pays the same price";
  - founders set "the mission, market opportunity, minimum raise, and monthly budget";
  - a 4-day USDC deposit period;
  - the team caps the raise, and amounts above the cap are refunded pro rata;
  - larger budget requests go through futarchy (conditional prediction markets).
  - Sources: [KuCoin](https://www.kucoin.com/news/flash/metadao-launches-onchain-treasury-model-for-post-token-sale-funding); [Basis Point](https://basispointres.substack.com/p/metadao-ownership-coins); [Alea Research](https://alearesearch.substack.com/p/metadao).
- **Scale:**
  - Earlier count: ≈ $580M of ICO commitments, $535M (92.2%) refunded, over 14 launches — search summary ([Basis Point](https://basispointres.substack.com/p/metadao-ownership-coins) / [blocmates](https://www.blocmates.com/articles/metadao-projects-distilled)).
  - Later: "MetaDAO raises $625 million across 23 sales, faces challenge of filtering high-quality projects" (title) — [KuCoin](https://www.kucoin.com/news/flash/metadao-raises-625m-in-23-sales-faces-challenge-of-filtering-quality-projects).
  - MetaDAO launchpad category MC ≈ $27M — [CoinGecko category](https://www.coingecko.com/en/categories/metadao-launchpad).
- **Platform fee revenue** (search summary; exact source page not isolated, likely [01resolved, June 2026](https://01resolved.com/research/ownership-coin-monthly-research-report-june-2026/) or [Messari](https://messari.io/project/metadao)):

  | Quarter | Revenue |
  |---|---|
  | Q4 2025 | $1.8M |
  | Q1 2026 | $556K |
  | Q2 2026 | $376.5K |

- **Other ownership coins:** Omnipair, Umbra, Solomon, Paystream, Avici, Loyal — search summary; the source page is likely [blocmates](https://www.blocmates.com/articles/metadao-projects-distilled) or [Basis Point](https://basispointres.substack.com/p/metadao-ownership-coins). From the same summary:
  - **Umbra** (privacy, "incognito mode" for Solana) drew over $154M in commitments. MC ≈ $11M at $1.1, about 4× its $0.30 ICO price.
  - **Avici** ("internet neobank") has a treasury of $3,325,489. Prices of $1.02 and $0.59 were seen at different dates.

### Inferences
- **Derived:** at the ICO price, Paystream's MC would have been ≈ $680K / 0.7 ≈ **US$0.97M**, assuming constant circulating supply. So it sat at the bottom of the band.
- Umbra, at ≈ $11M, sits just above the band. At its $0.30 ICO price it would derive to ≈ $3M on the same supply assumption, which is uncertain.
- **Why it is interesting.** It is the one 2025–26 Solana launch format built around anti-rug credibility: treasury control, budgets, refunds. Avici (a crypto neobank and card) is thematically closest to Payence.
- **Verdict: inspiration for the raise page and governance transparency, not for price action.**
  - **Copy:** a raise page showing the minimum raise, monthly burn/budget, treasury address and refund rules.
  - **Avoid:** assuming ICO demand means aftermarket demand (Paystream is −30% from ICO; platform revenue fell each quarter).

### Gaps
- Paystream CA, launch date, ATH, current MC and team. Avici MC. Umbra's supply and ATH. Which 2026 MetaDAO raises (23 sales total) landed inside the band.

---

## 5. Candidate #4 (case study): Gas Town ($GAS) and $RALPH, the January 2026 Bags "GitHub developer token" meta

### Takeaway
In January 2026, anonymous users and Bags itself launched tokens for viral open-source AI tools and routed about 99% of Bags creator fees (1% of volume) to the developers. GAS and RALPH hit ≈ US$60M within days, then collapsed about 96–98% into the band. One collapse followed a developer stepping back; the other followed a developer-linked sale. **Verdict: copy the fee-share primitive; avoid everything about the hype cycle.**

### Cited Findings
**Gas Town ($GAS)**
- Gas Town is an open-source multi-agent workspace manager that orchestrates coding agents (Claude Code, Gemini). Steve Yegge released it on Jan 1, 2026 — search summary ([Yahoo Finance / BeInCrypto](https://finance.yahoo.com/news/gas-token-500-surge-reveals-114036375.html)).
- The token "was created by an anonymous community member on the BAGS platform". Yegge "has no ownership or control" over it and receives 99% of the trading fees — search summary ([CoinGecko](https://www.coingecko.com/en/coins/gas-town) / [Yahoo](https://finance.yahoo.com/news/gas-token-500-surge-reveals-114036375.html)).
- Price path:
  - ≈ $60M on Jan 15 after Yegge's Medium post — [Medium, "BAGS and the Creator Economy"](https://steve-yegge.medium.com/bags-and-the-creator-economy-249b924a621a).
  - Yegge stepped back four days later and the token fell about 98% to ≈ $1.1M — [Whale Alert](https://whale-alert.io/stories/d27c01673ae5/Gas-Town-GAS-tumbles-98-to-11M-after-creator-Steve-Yegge-distances-himself-other-Bags-launchpad-tokens-also-plunge); ["GAS Tanks 90%", The Defiant](https://thedefiant.io/news/defi/gas-tanks-90-after-ai-dev-steps-back).
- **Conflicting data:** a community timeline says "January 16, 2026 … $GAS surges from $10M to $60M market cap. Token peaks at $0.044". With 1B supply, $0.044 implies ≈ $44M, not $60M. The date also differs (Jan 15 vs 16) — [SimHacker/moollm](https://github.com/SimHacker/moollm).
- Current MC $40,052.93 — [CoinGecko](https://www.coingecko.com/en/coins/gas-town).
- CA `7pskt3A1Zsjhngazam7vHWjWHnfgiRump916Xj7ABAGS` — [Phantom](https://phantom.com/tokens/solana/7pskt3A1Zsjhngazam7vHWjWHnfgiRump916Xj7ABAGS).

**$RALPH**
- The "Ralph Wiggum technique" is an autonomous coding-agent loop that Geoffrey Huntley developed in July 2025 — [VentureBeat](https://venturebeat.com/technology/how-ralph-wiggum-went-from-the-simpsons-to-the-biggest-name-in-ai-right-now); [ghuntley.com/ralph](https://ghuntley.com/ralph/).
- The token "was created and is operated by BagsApp"; Huntley "did not deploy the smart contract" — [XT blog](https://www.xt.com/en/blog/post/what-is-ralph-a-simpsons-inspired-meme-coin-built-on-a-viral-ai-technique). Site: [ralphcoin.org](https://ralphcoin.org/) (repo [ghuntley/ralphcoin](https://github.com/ghuntley/ralphcoin)).
- Huntley was assigned 99% of royalties on a vesting schedule and reported ≈ $300K in his bank account within 7 days. Bags reported more than $1B of trading volume within 30 days — search summary ([Bitget News](https://www.bitget.com/news/detail/12560605155959)).
- ATH $58.74M on Jan 21, 2026. It then lost 95.76% in 24 hours to $1.5M ($0.0016) after a Huntley-linked wallet sold ≈ $300K in three transactions, which he called "de-risking" before the next vesting window — [crypto.news](https://crypto.news/ralph-meme-coin-tanks-after-de-risking-token-sale-by-dev-wallet/); [CryptoPotato](https://cryptopotato.com/ai-meme-coin-ralph-crashes-80-after-300k-dev-selloff/). AMBCrypto reports a 97% collapse — [AMBCrypto](https://ambcrypto.com/ralph-memecoin-collapses-by-97-after-developer-sale-sparks-backlash-details/).
- Critique of the meta: "Crypto grifters are recruiting open-source AI developers" — [Sean Goedecke](https://www.seangoedecke.com/gas-and-ralph/). See also "RALPH and GAS Suffer Sharp Losses as Creator Economy Meta Faces Stress Test" — [Bitget News](https://www.bitget.com/news/detail/12560605165010).

### Inferences
- Both tokens traded inside the US$0.7–10M band only briefly: before the surge (GAS ≈ $10M) and after the crash (≈ $1.1M and $1.5M). That is not a sustained in-band product token.
- Band fit is weak: the ATHs were ≈ 6× the top of the band.
- The 99% fee routing shows how Bags' fee-share configuration can pay a developer who never launched the token.
- **Verdict: NO for the launch style; YES for the primitive.**
  - The primitive: programmable fee splits to verified X or GitHub identities. It fits the user well, for example paying Tricker basket curators or contributors.
  - **Avoid:** celebrity endorsement pumps; developer vesting that allows large sales into thin liquidity; tokens with no utility inside the product.

### Gaps
- Exact launch timestamps and CAs for RALPH, VVM and COW. Total fees paid out to Yegge and Huntley over the full period (only the "$300K in 7 days" figure was found). Bundling or sniper data.

---

## 6. Also scanned: outside the band, below it, or unverifiable

### Takeaway
The biggest 2025–26 Solana tech coins (PayAI, KLED, DUPE, LAUNCHCOIN, Umbra) peaked **above** the band. The most product-relevant small cap for Tricker Terminal (Syra) likely peaked **below** it.

### Cited Findings
- **PayAI ($PAYAI)**, a Solana-native x402 facilitator.
  - MC surpassed $31M (+39.62% in 24h) — [Bitget News](https://www.bitget.com/news/detail/12560605031489).
  - Then an ATH of ≈ $58.9M on Oct 27, 2025 (+147.7% in 24h), after a rise of over 1,500% in one week — [Bitget News](https://www.bitget.com/news/detail/12560605032404); [RootData](https://www.rootdata.com/news/403925).
  - CA `E6NFGtZem6eEYev8yHF2QMBSqesqtEudSVWZj6XnYuPh` — [Phantom](https://phantom.com/tokens/solana/E6NFGtZem6eEYev8yHF2QMBSqesqtEudSVWZj6XnYuPh).
  - Self-described "largest x402 facilitator on Solana" — [PayAI blog](https://blog.payai.network/largest-x402-facilitator-solana/).
  - **Above the band.**
- **Syra Agent ($SYRA)**, an "AI trading intelligence layer" for Solana. It combines market data, on-chain activity, smart-money flows, sentiment and research.
  - Surfaces: web chat at agent.syraa.fun, a Telegram bot, automation on x402scan, and an API with 30+ endpoints, most priced pay-per-call via x402 — [Syra docs](https://mintlify.wiki/ikhwanhsn/syra_agent/introduction); [syraa.fun](https://www.syraa.fun/terms); [API gateway](https://api.syraa.fun/); X [@syra_agent](https://x.com/syra_agent/status/2021064952765874204?lang=en).
  - ATH price $0.0003887, now 81.2% below. PumpSwap SYRA/SOL volume was $481.46 over 24h — [CoinGecko](https://www.coingecko.com/en/coins/syra-agent).
  - CA `H4bwqJ6PB9JsSGFvvsJinkZ4EcHLZJ7xmmh75coBzJad` — [OKX Wallet](https://web3.okx.com/token/solana/H4bwqJ6PB9JsSGFvvsJinkZ4EcHLZJ7xmmh75coBzJad).
- **Other x402 small caps listed in results:** DEXTER, DND (a "Do Not Disturb" meme), Relay AI Solana and SYRA. Market caps no verificado — search summary ([Bitget small-cap x402 list](https://www.bitget.com/amp/news/detail/12560605035525); [Solana Hub on X](https://x.com/SolanaHub_/status/2003502307187786087)).
- **Believe survivors (current):**
  - KLED (Kled AI): $15.6M.
  - DUPE: $10.58M. Its description says it is "set to leverage Google's Universal Commerce Protocol and has been selected for the OpenAI App Store".
  - Believe category total: $34.2M.
  - Sources: [FXEmpire](https://www.fxempire.com/crypto/categories/believe-app-ecosystem); [CoinGecko category](https://www.coingecko.com/en/categories/believe-app-ecosystem).
  - Earlier, DUPE was ≈ $26M after a 6× week (2025) — [Cryptonews](https://cryptonews.com/exclusives/launchcoin-believe-future-of-meme-coins/).
- **LAUNCHCOIN (Believe):**
  - Peak ≈ $200M, up to $319M during May 12–15, 2025 — [Incrypted](https://incrypted.com/en/internet-capital-markets-and-believe-app-when-an-explosive-trend-finds-its-launchpad/).
  - Current MC $1,603,142 — search summary of price pages ([CoinMarketCap](https://coinmarketcap.com/currencies/launch-coin-on-believe/) / [Kraken](https://www.kraken.com/prices/launch-coin-on-believe)).

### Inferences
- **Syra (derived, assuming 1B supply, which is not verified):** ATH ≈ $389K, below the band. Still the best functional analog for Tricker Terminal: pay-per-call x402 analytics plus a chat agent plus a Telegram bot.
- KLED and DUPE are "ICM" survivors that kept product news flowing (the OpenAI App Store listing). They sit just above the band now, so they are useful narrative references rather than candidates.

### Gaps
- ATH MCs for KLED and DUPE. Syra's supply. PayAI's current MC. Market caps for Relay AI Solana and DND.

---

## 7. Which launchpads and narratives dominate Solana tech coins in 2025–2026

### Takeaway
- **pump.fun** dominates Solana launches and revenue. Through 2026 it added agent- and fee-sharing features, although Tokenized Agents ran only from March to June 2026.
- **Bags.fm** became the "creator/developer fee-share" launchpad and hosted January 2026's GitHub-developer token meta.
- **Believe** owned the May 2025 "ICM" narrative.
- **MetaDAO** owns "ownership coins".
- The strongest *tech* narratives were:
  - x402/agentic payments (Oct–Dec 2025);
  - open-source AI developer tokens (Jan 2026);
  - OpenClaw/agent plugins (Q1 2026);
  - agent-revenue buybacks (Mar–Jun 2026).

### Cited Findings
**pump.fun**
- Market share: Pump.fun "rebounded from 5% to 90%" of Solana meme launchpad share within two weeks. LetsBonk "collapsed from 80% to just 3%" of active launches (2025) — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/pumpfun-reclaims-90percent-market-share-in-solana-launchpad-war).
- Q1 2026 revenue ≈ $124.7M, about 36% of the $342.2M earned by all Solana apps — [BitKE](https://bitcoinke.io/2026/05/pump-fun-in-q1-2026/).
- August 2026: more than $10M earned in one week and $5.02M of PUMP burned; a 6.875B PUMP unlock followed — [CryptoTicker](https://cryptoticker.io/en/pump-fun-record-week-unlock-solana-memecoins/); [Crypto Briefing](https://cryptobriefing.com/pump-fun-pump-token-unlock-pressure/).
- PUMP buybacks: "In April" (2026 by context) it had burned ≈ $370M of bought-back PUMP, about 36% of circulating supply, and "committed half of revenue to buybacks for a year" — [Bitcoin.com News](https://news.bitcoin.com/pump-fun-burns-370-million-pump-tokens-revenue-buyback/).
- **Tokenized Agents (Mar 13–14, 2026).**
  - A creator sets a revenue buyback percentage and gives the agent the token contract plus a Skills.md file. Buyback-and-burn triggers once cumulative revenue reaches $10 — [KuCoin](https://www.kucoin.com/news/flash/pump-fun-launches-tokenized-agents-for-automated-token-buybacks); [The Defiant](https://thedefiant.io/news/defi/pumpfun-launches-automated-buyback-tool-for-ai-agent-tokens).
  - **Deprecated June 30, 2026**, because "too many ways to launch a token was creating toxic player-versus-player dynamics" — [Crypto Briefing](https://cryptobriefing.com/pump-fun-kills-tokenized-agent-launch/).
- **pump.fun skills repo:**
  - The tokenized-agent default is `DEFAULT_BUYBACK_BPS = 5000` (50%) and requires an initial buy greater than 0.
  - "Coin Fees" lets creators "create or update sharing configs with up to 10 shareholders".
  - "Tokenized Agent Payments" lets agents "accept USDC or wrapped SOL payments and verify invoices on-chain" with `@pump-fun/agent-payments-sdk`, including React/Next.js integration guides.
  - Other options: cashback, "mayhem mode" and Jito front-runner protection.
  - Source: [pump-fun/pump-fun-skills](https://github.com/pump-fun/pump-fun-skills) (files `README.md`, `create-coin/SKILL.md`, `create-coin/scripts/build-create-coin-tx.mjs`).
- Also reported: "Pump.fun Lets Creators Launch Coins Priced In Tokenized Stocks" (title only; date no verificado) — [The Defiant](https://thedefiant.io/news/defi/pump-fun-lets-creators-launch-coins-priced-in-tokenized-stocks).

**LetsBonk.fun**
- BONK ecosystem integration, volume-based graduation fees and direct Raydium listing on graduation — search summary of 2026 comparison posts ([StakePoint](https://stakepoint.app/blog/letsbonk-fun-vs-pump-fun-2026) / [SolBundler](https://solbundler.app/blog/pump-fun-vs-bonk)).
- It peaked in mid-2025 and then lost share (see the pump.fun share figure above).

**Bags.fm**
- Creators "earn 1% of all trading volume on their tokens — forever" — [DEV Community](https://dev.to/sivarampg/bagsfm-the-solana-launchpad-thats-changing-creator-monetization-4g7n).
- Fee claimers are identified by Twitter, Kick or GitHub accounts, with a maximum of 100 fee earners per launch — [Bags docs changelog](https://docs.bags.fm/changelog/changelog).
- The SDK defines `feeClaimers[]` with a `userBps` share each (validated to sum to the total). Address lookup tables are used when there are many claimers, and a fee-share admin can update claimers after launch — [bagsfm/bags-sdk](https://github.com/bagsfm/bags-sdk) (files `src/utils/validations.ts`, `src/services/config.ts`, `src/services/fee-share-admin.ts`).
- More than $5B of on-chain volume and $40M+ of creator payouts. Won the "Crowdfunding Innovation Award" at the 2026 FinTech Breakthrough Awards (Mar 20, 2026) — [BusinessWire](https://www.businesswire.com/news/home/20260320414386/en).
- **The Bags Hackathon (2026):** over $1M in direct prizes and $3M of ongoing funding. Projects **must have a linked token** — [DoraHacks](https://dorahacks.io/hackathon/the-bags-hackathon/detail).
- BagsApp ecosystem category MC is now only $9.53M — [CoinGecko](https://www.coingecko.com/en/categories/bagsapp-ecosystem).
- Positioning: a "smaller but dedicated community"; less organic discovery but less sniper competition — search summary of 2026 comparison posts ([SolBundler](https://solbundler.app/blog/pump-fun-vs-bonk) / [StakePoint](https://stakepoint.app/blog/letsbonk-fun-vs-pump-fun-2026)).

**Believe (Launchcoin)**
- Tokens launch by replying on X with "$TICKER + @launchcoin", no wallet needed — [CoinGecko Learn](https://www.coingecko.com/learn/what-is-believe-token-launchpad).
- "Believe App Token Soars 900% After Generating $6.3 Million in Daily Revenue" (2025) — [The Defiant](https://thedefiant.io/news/defi/believe-app-token-soars-900-after-generating-usd6-3-million-in-daily-revenue).
- The whole category is now ≈ $34.2M — [CoinGecko category](https://www.coingecko.com/en/categories/believe-app-ecosystem).

**MetaDAO:** see section 4.

**x402 / agentic payments**
- Solana held about 49% of x402 market share — [SolanaFloor](https://solanafloor.com/news/solana-commands-49-of-x402-market-share-as-the-race-for-micropayment-dominance-intensifies).
- x402 on Solana (official) — [solana.com/x402](https://solana.com/x402).
- Leading tokens: PayAI and Dexter (sections 2 and 6).

**Privacy**
- **privacy.fun** is a "privacy-first Solana token launchpad" wrapper that lets users launch on pump.fun without connecting a wallet (search summary) — [privacyfun.com](https://www.privacyfun.com/).
- Umbra (MetaDAO) is the flagship privacy product token (section 4).

**OpenClaw / agent-plugin meta (Q1 2026)**
- Dexter shipped `clawdexter`, an "OpenClaw plugin for x402 discovery and payments" (created 2026-01-28) — [GitHub](https://github.com/Dexter-DAO/clawdexter).
- claude-mem lists OpenClaw support — [GitHub](https://github.com/thedotmack/claude-mem).

### Inferences
**Chronology of Solana tech-coin metas:**

| Period | Meta |
|---|---|
| May 2025 | ICM (Believe) |
| Jul–Aug 2025 | Launchpad war (LetsBonk vs pump.fun) |
| Oct–Dec 2025 | x402/agentic payments (PayAI, Dexter, Syra) |
| Q4 2025–2026 | MetaDAO ownership coins |
| Jan 2026 | Bags GitHub-developer tokens (GAS, RALPH, CMEM, VVM, COW) |
| Q1 2026 | OpenClaw/agent plugins |
| Mar–Jun 2026 | pump.fun Tokenized Agents (revenue buybacks) |
| 2026 | Bags hackathon (token-required apps) |

**Common thread.** Every meta tries to tie token value to something real: developer fees (Bags), agent revenue buybacks (pump.fun), treasury governance (MetaDAO), or payment volume (x402). Most still decoupled after the hype.

**Launchpad identification.** CA suffixes identify the launchpad: pump.fun mints end in "pump" (DEXTER); Bags vanity mints end in "BAGS" (GAS, CMEM). A launch site can show the suffix as a trust cue.

### Gaps
- No usable data was retrieved for **Moonshot, Heaven, Jupiter Studio, Raydium LaunchLab, or other Meteora DBC-based pads** in 2025–26, because the search budget ran out.
- Bags being built on Meteora DBC is background knowledge, not verified here.
- Month of the pump.fun/LetsBonk share flip: 2025, exact month not verified in these sources.
- PUMP ICO size: sources conflict (≈ $1B vs $1.3B).

---

## 8. Inspiration verdict for the user's next launch (Payence, Nomia, Tricker, Tricker Terminal)

### Takeaway
Model the next launch on the **Dexter archetype**: a real agent-payments rail, public proof of usage, a developer SDK with runnable snippets, MCP/ChatGPT/Claude connectors, and one honest token utility. Add **CMEM-style disclosure hygiene** and, if a raise is needed, **MetaDAO-style raise transparency**. Avoid the **GAS/RALPH hype archetype** and don't depend on launchpad metas that are likely to be retired (pump.fun Tokenized Agents lasted about 3.5 months).

### Cited Findings
- **Agent-payment primitives that already exist on Solana (competitors or analogs for Payence/Nomia):**
  - Dexter's capped per-seller "Tabs" (`totalCap`; stream, meter, settle) and "one-shot multichain payments" — [dexter-x402-sdk](https://github.com/Dexter-DAO/dexter-x402-sdk).
  - Passkey non-custodial wallets and "governed agent authority" — [dexter-connect](https://github.com/Dexter-DAO/dexter-connect); [dexter-mcp](https://github.com/Dexter-DAO/dexter-mcp).
  - pump.fun's agent-payments SDK with on-chain invoice verification (USDC/wSOL) and React/Next.js guides — [pump-fun-skills](https://github.com/pump-fun/pump-fun-skills).
- **A token utility tied to product flow:** paying in DEXTER gives a 25% discount — [opendexter-ide](https://github.com/Dexter-DAO/opendexter-ide).
- **A revenue→token loop as an off-the-shelf primitive:** pump.fun buyback bps (default 50%) — [pump-fun-skills](https://github.com/pump-fun/pump-fun-skills). It was deprecated Jun 30, 2026 — [Crypto Briefing](https://cryptobriefing.com/pump-fun-kills-tokenized-agent-launch/).
- **Contributor fee-sharing primitives:**
  - Bags `feeClaimers` with `userBps`: up to 100 claimers, identified by X, GitHub or Kick — [bags-sdk](https://github.com/bagsfm/bags-sdk); [Bags docs](https://docs.bags.fm/changelog/changelog).
  - pump.fun fee sharing with up to 10 shareholders — [pump-fun-skills](https://github.com/pump-fun/pump-fun-skills).
- **Disclosure pattern:** "What About $CMEM?" plus an official links block (Bags, Jupiter, DEXScreener) — [claude-mem](https://github.com/thedotmack/claude-mem); [claude-men copy](https://github.com/JuanLuisLozadaGx/claude-men).
- **Analytics terminal pattern (Tricker Terminal):** Syra's 30+ endpoints with x402 pay-per-call, web chat agent, Telegram bot and x402scan automation — [Syra docs](https://mintlify.wiki/ikhwanhsn/syra_agent/introduction).
- **Raise transparency pattern:** same price for everyone, a minimum raise, a monthly budget, pro-rata refunds and futarchy — [KuCoin](https://www.kucoin.com/news/flash/metadao-launches-onchain-treasury-model-for-post-token-sale-funding); [Basis Point](https://basispointres.substack.com/p/metadao-ownership-coins).
- **Failure patterns:**
  - a developer-linked $300K sale at the peak (RALPH) — [crypto.news](https://crypto.news/ralph-meme-coin-tanks-after-de-risking-token-sale-by-dev-wallet/);
  - a developer stepping back, followed by a 98% drop (GAS) — [Whale Alert](https://whale-alert.io/stories/d27c01673ae5/Gas-Town-GAS-tumbles-98-to-11M-after-creator-Steve-Yegge-distances-himself-other-Bags-launchpad-tokens-also-plunge);
  - a token launched without the developer's consent (CMEM) — [claude-mem](https://github.com/thedotmack/claude-mem).

### Inferences
**Payence (virtual cards, spend policies, merchant locks)**
- Dexter's Tabs are the on-chain twin of "merchant lock + cap". The landing page should *differentiate* on card rails (fiat merchants) and policy UX.
- Show an interactive policy playground: agent → merchant lock → cap → live ledger.
- If a token is launched, give it one verifiable utility, such as fee discounts when fees are paid in the token (the Dexter model), and publish treasury and budget like MetaDAO. Do not promise staking yield.

**Nomia (per-agent identity, spend policies, multi-rail settlement behind one API)**
- Dexter already markets "one-shot multichain payments" and passkey-governed agent authority. Nomia's site must show what it adds: rails beyond x402/USDC, a per-agent identity model, and a single API.
- Publish copy-paste SDK snippets, an x402 compatibility badge (Solana holds about 49% of x402 share) and public settlement or facilitator addresses as proof.

**Tricker (index "bags")**
- No verified in-band Solana index-basket token was found (gap).
- Watch the **name collision**: "bags" is the brand of a major Solana launchpad (Bags.fm), which could hurt search and trust.
- The Bags/pump.fun fee-split primitives (bps per claimer) fit a "curator earns X bps of basket volume" mechanic well.

**Tricker Terminal**
- Follow the Syra and Dexter pattern: expose terminal data as x402 pay-per-call endpoints and MCP tools so agents can pay for them. Add a Telegram or chat surface and a ChatGPT/Claude connector.
- On the landing page, show live counters (calls served, paying agents) rather than token charts.

**Landing-site checklist distilled from the candidates**
1. An official CA block with the launchpad suffix and links (Jupiter, DEXScreener, launchpad), plus an impostor warning.
2. Proof of usage: on-chain addresses, transaction share, a proofs repo, GitHub activity.
3. Honest provenance and a token FAQ ("What about $TOKEN?").
4. One concrete token utility wired into the product.
5. Vesting and sell policy disclosed up front (the RALPH lesson).
6. Revenue kept separate from token price (CMEM Pro, Dexter facilitator).
7. No celebrity or developer-endorsement pump mechanics.

**Overall archetype ranking for emulation**
1. Dexter (agent-payments infrastructure).
2. CMEM (open-source developer tool plus SaaS plus embraced token).
3. MetaDAO ownership coin (credible raise).
4. GAS/RALPH (anti-pattern).

### Gaps
- The candidates' landing sites and docs could not be viewed (WebFetch blocked), so site-level design patterns (layout, copy, calls to action) were not verified. The patterns above come from READMEs, SDK code and news summaries.
- No data links landing-site design choices to market-cap outcomes.
