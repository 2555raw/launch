# Tech coins en BNB Chain que tocaron US$700K–10M de market cap (2025–2026): notas de investigación al 2026-09-26

> **Método y límites.** Todas las cifras vienen de títulos, snippets y resúmenes de resultados de WebSearch, y de metadatos de GitHub (búsqueda de repositorios: fechas, descripciones, estrellas). WebFetch y curl estaban bloqueados. Además, el presupuesto de WebSearch de la sesión (200 llamadas, compartido con otros investigadores) se agotó a mitad de esta tarea. Por eso **ninguna cifra se comprobó en vivo** en DexScreener, GeckoTerminal o BscScan. Cuando pone "no verificado", el dato no apareció en ninguna fuente. Las fechas de los posts de X se calcularon a partir del ID del post (snowflake), que es un cálculo exacto y no una estimación. Esto es análisis técnico y de producto, no asesoramiento de inversión.

## 1. Candidatos (ranking): identidad, launchpad, fecha y market cap tocado

### Takeaway
Solo **un** token ligado a un producto tiene un market cap dentro de la banda respaldado por una fuente: **BNC4**, el stock token de four.meme, que "rompe US$5M". Los candidatos con más sustancia técnica (**4CLAW**, **EQUITY/StonksPad** sobre Flap y **B402/x402 en BNB**) tienen el producto bien documentado, pero su MC queda **no verificado**. Ranking propuesto: **1) BNC4, 2) 4CLAW, 3) EQUITY/StonksPad, 4) B402/x402-BNB**. Quack AI (Q) sirve como referencia de x402 fuera de banda: US$73–113M hoy.

### Cited Findings

**#1: BNC4 (four.meme, línea "4Stock"/"Stock Memes")**
- Qué es: según el resumen de búsqueda de los artículos de 4Stock/BNC4, four.meme "lanzó BNC4, un stock token con peg 1:1 a CEA Industries (BNC)". — [Gate News](https://www.gate.com/news/detail/bnc4-meme-token-on-bsc-breaks-5-million-market-cap-10x-bnc-stock-value-24100472); [Phemex](https://phemex.com/news/article/4stock-surges-over-1980-within-five-hours-of-bsc-launch-95859)
- MC tocado: titular "BNC4 Meme Token on BSC Breaks $5 Million Market Cap, 10x BNC Stock Value". La fecha exacta no está verificada. — [Gate News](https://www.gate.com/news/detail/bnc4-meme-token-on-bsc-breaks-5-million-market-cap-10x-bnc-stock-value-24100472)
- Contexto de la ola: "3 hours, single token hits A7, BNC surges over 50% pre-market, BSC stock-Meme flywheel restarts". — [Odaily](https://www.odaily.news/en/post/5212895)
- El token base de la misma línea, 4Stock, subió más de un 1,980% en unas 5 horas y su MC superó brevemente los US$70M (fuera de banda). 4Stock "is minted with a 1:1 peg to U.S. stocks and can serve as a base asset for 'stock meme' tokens". — [Phemex](https://phemex.com/news/article/4stock-surges-over-1980-within-five-hours-of-bsc-launch-95859). Otra fuente habla de ">US$40M en 2 horas". — [KuCoin](https://www.kucoin.com/news/flash/4stock-meme-coin-surpasses-40m-market-cap-in-2-hours-on-bsc)
- Contrato: no verificado. Fecha de lanzamiento: no verificada. Estado actual: no verificado.
- **Contradicción sin resolver:** "peg 1:1" frente a "10x BNC stock value" en el titular de Gate.

**#2: 4CLAW (4claw.fun, integrado con four.meme)**
- Qué es: "the first specialized launchpad for OpenClaw agents, seamlessly integrated with Four.meme, Moltbook, and Moltx to tokenize and launch agent-led projects on BSC". Despliega tokens para agentes a partir de prompts en lenguaje natural. — [GitHub 4CLAW](https://github.com/4clawd); [CryptoRank 4claw](https://cryptorank.io/price/4-claw)
- Existe una ficha de precio "4claw" en CryptoRank, lo que sugiere que hay token. Su MC no está verificado. — [CryptoRank](https://cryptorank.io/price/4-claw)
- Repos:
  - `4claw-agent-cli` ("Cli version of 4claw agent. run it on any computer you like"): creado el 2026-03-04, último push el 2026-05-28, 8 issues abiertos, 0 estrellas, homepage agent.4claw.fun, topics `openclaw`/`picoclaw`/`bsc`. — [GitHub](https://github.com/4clawd/4claw-agent-cli)
  - `4claw-flashloan` ("Flashloan contract of 4claw"), creado el 2026-03-30. — [GitHub](https://github.com/4clawd/4claw-flashloan)
  - `flashloan-dapp`, creado el 2026-04-01. — [GitHub](https://github.com/4clawd/flashloan-dapp)
- Contrato, ticker exacto y MC pico o actual: no verificados.

**#3: EQUITY (getequity.fun) y StonksPad, launchpads sobre Flap que pagan a los holders en bStocks**
- EQUITY: "launch a coin that already pays its holders". Cada coin se lanza en flap.sh como tax token. El impuesto de cada trade se paga a los holders en BNB o en un bStock (NVDAB, TSLAB, SPYB). El creador se queda el 20% y los holders el 80%. Flap cobra el tax y el vault paga on-chain. — [getequity.fun](https://getequity.fun/)
- StonksPad: "a meme-token launchpad on BNB Chain where every token pays its holders in tokenized stocks". El tax compra acciones tokenizadas (y otros reward assets registrados) para los holders. Los tokens se crean con `VaultPortal.newTokenV6WithVault()` de Flap, usando `StonksPadVaultFactory` como vault factory. El repo incluye factory, vault y treasury. — [GitHub stonkspad-contracts](https://github.com/StonksPadBNB/stonkspad-contracts); [stonkspad-docs](https://github.com/StonksPadBNB/stonkspad-docs)
- Hay una página "Equity (EQUITY)" en CMC y una ficha "Equity" en CoinBrain (0xc24eda6c22b3b4232607f931d3dfc19bd24f3e8e). Pero existen varios "Equity" (equitycoin.finance, equitycoin.fun) y **no se confirmó** que ninguno sea el de getequity.fun. — [CMC](https://coinmarketcap.com/currencies/equity/); [CoinBrain](https://coinbrain.com/coins/bnb-0xc24eda6c22b3b4232607f931d3dfc19bd24f3e8e)
- MC de tokens EQUITY o StonksPad: no verificado.
- Referencia de la misma narrativa: "BSC Meme Coin Stonks Tops $14M Market Cap" (nuevo máximo). Atravesó la banda, pero su pico la supera y no documenta producto. — [Phemex](https://phemex.com/news/article/bsc-meme-coin-stonks-hits-14-million-market-cap-sets-fresh-high-95588)

**#4: B402 / tokens x402 en BNB (con Quack AI "Q" como referencia fuera de banda)**
- Repo BNBChain402/B402: "The first X402 Protocol on BNB Chain, powered by USD1 payments, enabling seamless on-chain transactions with zero gas hassle". Solidity, creado el 2025-10-28, actualizado el 2026-06-10, 0 estrellas. — [GitHub](https://github.com/BNBChain402/B402)
- Vistara Labs anunció "b402" el 25-oct-2025: pagos de agentes con cualquier BEP-20, con el B402 relay como intermediario de confianza. — [Bitget News](https://www.bitget.com/news/detail/12560605040847); [Gate Learn](https://www.gate.com/learn/articles/x402-builders-list-who-s-really-powering-x402/13436)
- CMC lista una **colección NFT** "b402.ai" en BNB (contrato 0xc67fa9e70d2aad3c5392c6b4522206edb8be3edd). — [CMC NFT](https://coinmarketcap.com/nft/collections/bnb/0xc67fa9e70d2aad3c5392c6b4522206edb8be3edd/b402.ai). Token fungible B402 y su MC: no verificados.
- Token "x402" de four.meme: FDV de US$6,513.79, liquidez de US$5,074.71 y volumen 24h de US$2.92, es decir, muerto. La dirección 0xcd5038c6dc6134041c45de22e6fcd4f2ffe14444 aparece en la URL del pool. — [GeckoTerminal](https://www.geckoterminal.com/bsc/pools/0xcd5038c6dc6134041c45de22e6fcd4f2ffe14444)
- Quack AI (Q), referencia fuera de banda. MC "live" en los resultados consultados el 2026-09-26: US$108.1M (CMC, rank #243), US$72.7M (CoinGecko) y US$112.9M (Bitget). — [CMC](https://coinmarketcap.com/currencies/quack-ai/); [CoinGecko](https://www.coingecko.com/en/coins/quack-ai); [Bitget](https://www.bitget.com/price/quack-ai)
  - Contrato visto en la URL de Bitget Web3: 0xc07e1300dc138601FA6B0b59f8D0FA477e690589. — [Bitget Web3](https://web3.bitget.com/en/swap/bnb/0xc07e1300dc138601FA6B0b59f8D0FA477e690589)
  - Pool principal: PancakeSwap V3 Q/BSC-USD, con US$1,693,060 de volumen 24h. — [CMC](https://coinmarketcap.com/currencies/quack-ai/)

**Tokens en banda (o cerca) que NO son tech (contexto)**
- "Freedom of Money": US$7M de MC en 24h (meme cultural). — [Phemex](https://phemex.com/news/article/bsc-meme-coin-freedom-of-money-hits-7m-market-cap-in-24-hours-63234)
- "memes": US$13M (+300%) y después más de US$14M. — [Phemex](https://phemex.com/news/article/bsc-meme-coin-memes-hits-13m-market-cap-with-300-surge-54898); [Phemex](https://phemex.com/news/article/memes-coin-market-cap-surpasses-14m-with-80-daily-surge-55781)
- OPENCLAW en BSC: MC de ~US$3.44K (contrato 0xfd580625fe91373f3db7d78b5e2983fcf6754444 en la URL de OKX). Es narrative-squatting, muy por debajo de la banda. — [OKX Wallet](https://web3.okx.com/token/bsc/0xfd580625fe91373f3db7d78b5e2983fcf6754444)
- WARD (BSC) subió un 500% tras la fusión Warden–Venice AI. El MC no aparece en el snippet. — [Phemex](https://phemex.com/news/article/bsc-token-ward-soars-500-following-warden-and-venice-ai-merger-81263)

### Inferences
- **Por qué este orden:**
  - BNC4 es el único con MC en banda respaldado por fuente y vínculo real a un producto (el rail 4Stock de acciones tokenizadas). Su profundidad técnica, sin embargo, es baja-media: es más RWA-meme que "tech".
  - 4CLAW tiene la tecnología más verificable (CLI open source, contratos de flashloan) y es de 2026, pero su MC no está verificado.
  - EQUITY/StonksPad aporta la mecánica más copiable para el usuario, pero no se confirmó que tenga token propio.
  - B402/x402 es la narrativa más alineada con Payence/Nomia, pero no hay token en banda verificado.
- **Sugerencia para el informe final ("mejores 2"):** presentar **BNC4** y **4CLAW** con caveats explícitos sobre el MC, e integrar **EQUITY/StonksPad** como "la mecánica a copiar" dentro de la sección de narrativas. Si el informe prioriza la inspiración sobre el MC verificado, EQUITY/StonksPad puede sustituir a BNC4.
- "A7" en el titular de Odaily parece jerga china para un MC de 7 cifras (millones). Es interpretación, no confirmada.
- Las direcciones de "x402" y OPENCLAW terminan en `...4444`. Parece el patrón de vanity address de los tokens de four.meme (conocimiento previo del modelo, no verificado aquí).
- Datación aproximada por el orden de IDs de artículos de Phemex:
  - Stonks (95588), 4Stock (95859) y "BSC DEX volume tops $1.3B" (95889) caen en la misma ventana que el post "BNB Stonks Szn" de Flap del 2026-09-04, así que probablemente son de sept-2026.
  - "memes" (54898/55781) sería de principios de 2026.
  - Es inferencia, no un dato.
- 4CLAW probablemente se lanzó hacia marzo de 2026: primeros repos del 2026-03-04, días después de que Agentic Mode de four.meme se lanzara el 2026-03-01.

### Gaps
- MC pico y actual, fecha de lanzamiento, contrato y estado (activo, abandonado, rug) de **4CLAW, EQUITY, StonksPad y B402**: no verificados. No se pudo abrir CryptoRank, CMC, DexScreener ni BscScan.
- Fecha, contrato y estado actual de BNC4: no verificados. Tampoco se pudo resolver la contradicción entre "peg 1:1" y "10x".
- No se pudo leer la reseña de Bitget sobre los primeros proyectos x402 de BSC y Solana, que probablemente nombra tokens concretos con MC ([Bitget](https://www.bitget.com/news/detail/12560605040847)). Se agotó el presupuesto de búsqueda.
- **Leads sin verificar (memoria del modelo, NO usar en el informe sin comprobar):** tokens de agentes IA y x402 en BNB de 2025 como SIREN, SKYAI, OLAXBT (AIO), Unibase (UB), Pieverse, y el token NB de Nubila (este aparece en la fuente de Aster Rocket Launch, pero sin MC). Pueden haber pasado por la banda en algún momento; no hay datos.

## 2. Producto y mecánica: arquitectura, contratos y cómo fluye el valor al token

### Takeaway
Los diseños "tech" que funcionan en BNB en 2025–2026 comparten algo: el token está conectado a un flujo de fees explícito on-chain. Flap y su ecosistema (tax, luego vault, luego buyback o dividendos en BNB o bStocks) es el caso más claro. En los tokens de agentes (4CLAW, Agentic Mode de four.meme) y de x402 (b402, Quack AI) el producto es real, pero el vínculo fee→token o no está documentado o no existe (B402 lanzó una colección NFT, no un token verificado).

### Cited Findings
**Rail de acciones tokenizadas de four.meme (base de BNC4)**
- 4Stock tiene peg 1:1 a acciones de EE. UU. y sirve de activo base para "stock memes". — [Phemex](https://phemex.com/news/article/4stock-surges-over-1980-within-five-hours-of-bsc-launch-95859)
- Four.meme lanzó los "Stock Memes", emparejados con bStocks en lugar del par habitual. — [CoinGabbar](https://www.coingabbar.com/en/crypto-currency-news/bnb-news-today-four-meme-stock-memes-launch-update)
- Four.meme también soporta **TaxToken**. Su CLI oficial comunitario ofrece "structured JSON outputs for config, token details, pricing quotes, on-chain events, and TaxToken fee configuration". — [GitHub four-meme-ai](https://github.com/four-meme-community/four-meme-ai)

**Capa de agentes de four.meme (contexto de 4CLAW)**
- Agentic Mode se lanzó el 1-mar-2026: los agentes de IA crean memes y operan de forma autónoma. — [KuCoin](https://www.kucoin.com/news/flash/four-meme-to-launch-agentic-mode-ai-agent-meme-product-on-bnb-chain); [Phemex](https://phemex.com/news/article/fourmeme-to-launch-agentic-mode-ai-meme-product-on-bnb-chain-63402)
- La primera fase del roadmap es un "Agent Skill Framework" que equipa a los agentes con "skills" on-chain. — [KuCoin](https://www.kucoin.com/news/articles/four-meme-unveils-ai-agent-roadmap-a-new-era-for-bnb-chain-memes)
- "Four.meme allows you to create, trade, and manage Meme tokens directly inside Claude, OpenClaw, and other AI agents". — [four.meme/agentic](https://four.meme/en/agentic)
- "ALPHA AI Agent" (con GoPlus) toma la idea de un meme desde la cuenta de X del usuario y genera el nombre, la descripción y la imagen del token. — [CoinGape](https://coingape.com/blog/3-meme-coin-launchpads-making-it-up-with-ai-trends-in-2026/)
- Ejemplos de tooling de terceros:
  - `alenfour/four-meme-agent` ("Autonomous AI agent for four.meme — Agentic Mode token launcher on BSC"): Python, creado el 2026-03-01, 2 estrellas. — [GitHub](https://github.com/alenfour/four-meme-agent)
  - `Clawd4U/fourmeme-launchpad` ("AI Agent Token Launchpad on Four.meme"), creado el 2026-02-03. — [GitHub](https://github.com/Clawd4U/fourmeme-launchpad)

**4CLAW**
- Lanzamiento de tokens para agentes OpenClaw a partir de lenguaje natural, integrado con four.meme, Moltbook y Moltx. — [GitHub 4CLAW](https://github.com/4clawd)
- Tiene un CLI ejecutable en local (agent.4claw.fun) y un contrato y dapp de flashloan propios. — [GitHub](https://github.com/4clawd/4claw-agent-cli); [GitHub](https://github.com/4clawd/4claw-flashloan)
- Cómo acumula valor el token (fees, buyback): no documentado en lo encontrado.

**Flap (base de EQUITY y StonksPad)**
- Launchpad modular iniciado en BNB Chain en enero de 2024. Los creadores eligen módulos (tax tokens, quote assets personalizados, mecánicas de recompensa), pares con acciones y "stock dividend rewards". Está activo en BNB Chain y Robinhood Chain. — [AirdropAlert](https://airdropalert.com/blogs/what-is-flap-launchpad/)
- Soporta tax tokens y vanity addresses. — [Bitquery docs](https://docs.bitquery.io/docs/blockchain/BSC/flap-sh/)
- **Commission receiver:** cualquier operador de launchpad de terceros o integrador gana un "permanent, protocol-enforced fee share from every tax token they deploy through Flap". — [Flap docs, Tax Token V3](https://docs.flap.sh/flap/developers/basic-and-mechanism/flap-tax-token/tax-token-v3)
- **Vault MYX:** el tax (en BNB o en cualquier quote token ERC20/RWA habilitado) recompra el propio tax token vía Flap Portal y lo deposita como liquidez base en el protocolo MYX. — [GitHub myx-flap-vault](https://github.com/myx-protocol/myx-flap-vault)
- **Flap AI Oracle:** `FlapAIProvider` soporta tool calling. El backend del oráculo ejecuta las tool calls del prompt e inyecta los resultados en el contexto del LLM antes de decidir. — [Flap docs, AI Oracle](https://docs.flap.sh/flap/developers/preview/flap-ai-oracle); [flap.sh/ai](https://flap.sh/ai)
- EQUITY: tax → vault → pago on-chain; 80% para holders y 20% para el creador; el pago es en BNB o en un bStock a elegir. — [getequity.fun](https://getequity.fun/)
- StonksPad: tax → compra de acciones tokenizadas para los holders, vía `newTokenV6WithVault()`. — [GitHub](https://github.com/StonksPadBNB/stonkspad-contracts)
- Otro ejemplo: "Asian Stock Strategy — 3% tax coin designed to launch via flap.sh with custom vault" (ago-2026). — [GitHub ass-protocol](https://github.com/AstrosDiary/ass-protocol)

**x402 / pagos de agentes en BNB (B402, Quack AI y facilitators)**
- En la página de BNB Chain, los agentes liquidan pagos por llamada a API "in USDC, USDT, USD1, or U — with no accounts, no API keys, and finality in under 200 milliseconds". — [BNB Chain AI Agent Solutions](https://www.bnbchain.org/en/solutions/ai-agent)
- **Binance x402** es un facilitator de pagos de Binance Pay para BNB Chain, pensado para APIs, plataformas de datos, herramientas de agentes, servidores MCP y workflows. Su fecha de lanzamiento no está verificada. — [FX News Group](https://fxnewsgroup.com/forex-news/cryptocurrency/binance-introduces-binance-x402-enabling-http-native-payments-on-bnb-chain/); [Blockchain.news](https://blockchain.news/news/binance-x402-http-native-payments-bnb-chain); [Blockonomi](https://blockonomi.com/binance-x402-launches-http-native-programmable-payments-for-ai-agents-on-bnb-chain/)
- **Quack AI, "x402 BNB":** sign-to-pay con ejecución delegada EIP-7702, firmas witness EIP-712 y un relayer que patrocina el gas. Sustituye approve → transfer → pay por "one verifiable signature". — [Quack AI (Medium)](https://medium.com/@quackai/4e9db5f513f5)
- Q402, el producto MCP de pagos de Quack AI, está en mainnet con "gasless stablecoin rails for AI agents across 12 blockchains". — [CMC AI, Quack AI](https://coinmarketcap.com/cmc-ai/quack-ai/latest-updates/)
- **Pieverse x402b:** pagos sin gas con pieUSD (USDT envuelto compatible con EIP-3009). El facilitator genera recibos conformes a la jurisdicción y los guarda de forma inmutable en BNB Greenfield. — [ChainCatcher](https://www.chaincatcher.com/en/article/2215459); [Bitget News](https://www.bitget.com/news/detail/12560605040847)
- **AEON:** su facilitator salió el 30-oct-2025 y valida "payment payloads for authenticity and mandate compliance" antes de confirmar. AEON fue seleccionado para MVB Season 10 el 25-jul. — [PR Newswire](https://www.prnewswire.com/news-releases/aeon-launches-x402-facilitator-on-bnb-chain-advancing-real-world-autonomous-ai-payments-302599547.html); [Bitget News](https://www.bitget.com/news/detail/12560605045785)
- Las fechas de anuncio de los tres facilitators fueron: b402 el 25-oct, x402b el 27-oct y AEON el 28-oct de 2025. — [Bitget News](https://www.bitget.com/news/detail/12560605040847)

**Identidad y trabajo de agentes (ERC-8004 / ERC-8183)**
- ERC-8004 se desplegó en BSC mainnet y testnet el 4-feb-2026; otra fuente dice que se "habilitó" el 4-mar-2026, lo que disparó una ola de lanzamientos.
- El 13-may-2026 BNB Chain anunció el framework completo: identidad 8004, pagos P2P, delegación de tareas con ERC-8183 y reputación en 8004scan.
- En la fuente, BNB Chain aparece con 44,051 agentes frente a 36,512 en Ethereum (fecha del dato no verificada).
- Fuentes de estos tres puntos: [The Defiant](https://thedefiant.io/news/blockchains/bnb-chain-agent-identity-erc-8004-go3uof); [Cryptopolitan](https://www.cryptopolitan.com/bnb-chain-lead-erc-8004-ai-agent/); [Crypto Economy](https://crypto-economy.com/bnb-chain-surges-ahead-in-erc-8004-adoption-as-on-chain-ai-agents-multiply/)
- Ejemplo de composición de 2026: `chainhelix-agents` es un marketplace donde agentes ERC-8004 en BSC "are found, probed and hired per job in ERC-8183 escrow or per call on B402". El entregable se guarda en BNB Greenfield y cada verificación se sella en opBNB. — [GitHub](https://github.com/kairovate/chainhelix-agents)

### Inferences
- Resumen de cómo llega el valor al token en cada candidato:
  - EQUITY/StonksPad: explícito (reparto de tax 80/20 y pago en activos).
  - Tokens tipo MYX-vault: explícito (buyback más liquidez).
  - BNC4: peg al subyacente, más un posible premium especulativo.
  - 4CLAW: no documentado.
  - B402: ninguno verificado (NFT en lugar de token).
  - Quack AI: el token existe, pero su vínculo con el volumen de Q402 no se encontró.
- Four.meme adoptó los TaxTokens, que eran el diferenciador de Flap. La mecánica "tax → vault → recompensa" se está convirtiendo en estándar del BNB meme stack de 2026.
- El Flap AI Oracle (LLM con tool calling que decide on-chain) permitiría tokens cuyas reglas de vault o recompensa las decide un agente. No se encontraron tokens concretos que lo usen.

### Gaps
- No se encontraron tasa de tax, supply, reparto al equipo ni auditorías de 4CLAW, EQUITY, StonksPad o BNC4.
- No se pudo leer el código (el acceso a GitHub se limita a metadatos y a 2555raw/launch). Las mecánicas de StonksPad y MYX vienen de las descripciones de los repos en los resultados de búsqueda.
- No consta si el tax de los Tax Tokens V3 de Flap es inmutable tras el lanzamiento, que es clave para descartar el riesgo de honeypot.

## 3. Links, equipo, tracción y red flags

### Takeaway
Todos los candidatos tienen tracción pública débil o sin medir: repos con 0–2 estrellas, equipos anónimos o sin identificar, sin métricas de usuarios. La tracción real está en las plataformas (Flap: unos US$14M en fees en 30 días; four.meme: más de 20,000 tokens al día en oct-2025), no en los tokens. Las red flags del ecosistema son concretas y recientes: honeypots "Pixiu" como 4AGENT, micro-caps que ocupan el nombre de una narrativa (x402, OPENCLAW), caídas tras los listados de Binance Alpha y repos cebo de "four.meme bot".

### Cited Findings
**Links y equipo**
- 4CLAW: GitHub [4clawd](https://github.com/4clawd); homepage agent.4claw.fun (en los metadatos del repo) — [GitHub](https://github.com/4clawd/4claw-agent-cli). Equipo autodescrito como "hardcore development team building on the BNB Chain... builders and friends of the Four.meme ecosystem", sin nombres, es decir, anónimo. — [GitHub 4CLAW](https://github.com/4clawd)
- EQUITY: [getequity.fun](https://getequity.fun/). Equipo: no verificado.
- StonksPad: [contracts](https://github.com/StonksPadBNB/stonkspad-contracts) y [docs](https://github.com/StonksPadBNB/stonkspad-docs). Equipo: no verificado.
- B402: [BNBChain402/B402](https://github.com/BNBChain402/B402). La b402 de Vistara Labs es un equipo con nombre de empresa. — [Bitget News](https://www.bitget.com/news/detail/12560605040847)
- Quack AI: [Medium](https://medium.com/@quackai/4e9db5f513f5); [CMC](https://coinmarketcap.com/currencies/quack-ai/)
- Flap: X [@flapdotsh](https://x.com/flapdotsh/status/2095886155296247819); [docs](https://docs.flap.sh/flap/developers/basic-and-mechanism/flap-tax-token/tax-token-v3); [DappBay](https://dappbay.bnbchain.org/detail/flap)

**Tracción**
- Flap según DefiLlama: unos US$29.85M en fees acumulados, US$14.23M en los últimos 30 días y unos US$10.77M de protocol revenue; TVL +46.4% en 30 días.
- Flap está en 4 cadenas (BSC, X Layer, Monad, Robinhood Chain), con BSC en torno al 98%.
- Fuente de ambos puntos: [DefiLlama](https://defillama.com/protocol/flap-sh). Cifras del resumen de búsqueda, sin comprobar en vivo.
- Four.meme en la temporada de oct-2025: más de 20,000 tokens nuevos en 24h y US$1.4M de revenue diario, frente a US$885K de Pump.fun. La fuente exacta dentro del set de resultados no se identificó. — [BingX Learn](https://bingx.com/en/learn/article/bnb-meme-season-key-metrics-and-what-you-need-to-know); [Atomic Wallet](https://atomicwallet.io/academy/articles/top-5-bnb-chain-memecoins-october-2025-season)
- MC de la categoría Four.meme Ecosystem en CoinGecko: US$523M (con US$347M de volumen) en un snapshot y US$824M en otro. Son instantáneas distintas, sin fecha. — [CoinGecko](https://www.coingecko.com/en/categories/four-meme-ecosystem)
- GitHub:
  - 4claw-agent-cli: 0 estrellas y 8 issues abiertos.
  - four-meme-agent: 2 estrellas.
  - B402: 0 estrellas.
  - Enlaces: [4claw-agent-cli](https://github.com/4clawd/4claw-agent-cli), [four-meme-agent](https://github.com/alenfour/four-meme-agent), [B402](https://github.com/BNBChain402/B402)
- Uso real del rail "Binance x402 (b402)" por builders en ago–sep 2026:
  - `bnb-agent-marketplace` (hackathon Build the Era; contratar agentes ERC-8004 con Binance x402). — [GitHub](https://github.com/Ai-Rook/bnb-agent-marketplace)
  - `till` ("payment counter for agent skills on Binance x402... real USD1 settles on BNB Chain inside the same HTTP request", EIP-3009). — [GitHub](https://github.com/bzdmin/till)
  - `agent-payment-templates` (x402 en Base y b402 en BSC). — [GitHub](https://github.com/kairovate/agent-payment-templates)
- Q402 ya se integra en copilots de hackathon ("Copilot built with quackai q402 + Chaingpt", dic-2025). — [GitHub](https://github.com/OWK50GA/BNB-Super-Web3-Agent)

**Red flags**
- **4AGENT (Pixiu/honeypot):** GoPlus avisó de 4AGENT, vinculado al token "Gork 4.2". KOLs y smart money perdieron 170 BNB (unos US$100K). Un resultado lo califica de alegación no confirmada. — [Bitget News](https://www.bitget.com/news/detail/12560605236729); [Phemex](https://phemex.com/news/article/goplus-warns-of-bsc-token-scam-investors-lose-100000-64146)
- Copycats "Pixiu" de $114514. — [Bitget News](https://www.bitget.com/news/detail/12560605132118)
- BNB Chain está bajo escrutinio por rug-pulls y honeypots. — [Bitget News](https://www.bitget.com/news/detail/12560605238207)
- Micro-caps que ocupan el nombre de una narrativa: "x402" de four.meme con FDV de US$6.5K ([GeckoTerminal](https://www.geckoterminal.com/bsc/pools/0xcd5038c6dc6134041c45de22e6fcd4f2ffe14444)) y OPENCLAW en BSC con US$3.44K ([OKX](https://web3.okx.com/token/bsc/0xfd580625fe91373f3db7d78b5e2983fcf6754444)).
- Binance Alpha:
  - "Over 40% of Binance Alpha Tokens Drop in Price After Announcement" (titular). — [iTiger](https://www.itiger.com/hant/news/2493021754)
  - Hacia mediados de 2025 había ~190 proyectos listados; ~70% por debajo de US$50M de MC y ~5% por encima de US$1B. — [EasyMM](https://www.easymm.io/post/what-is-binance-alpha-the-complete-guide-for-traders-and-projects-in-2026)
- Quack AI:
  - El MC de Q difiere mucho entre agregadores: US$72.7M en CoinGecko frente a US$108–113M en CMC y Bitget. — [CoinGecko](https://www.coingecko.com/en/coins/quack-ai); [CMC](https://coinmarketcap.com/currencies/quack-ai/)
  - En GitHub abundan scripts "auto quackai" de 2025 (farming de puntos). — [GitHub jackerdev01/quackai](https://github.com/jackerdev01/quackai); [GitHub unwinned/quack-ai](https://github.com/unwinned/quack-ai)
- Repo `bsc-fourmeme-bot`: descripción rellena de keywords ("bnb four meme" repetido), 227 estrellas frente a 4,788 forks, creado en 2021 y actualizado en sept-2026. — [GitHub](https://github.com/1009682175845693/bsc-fourmeme-bot)
- Artículos promocionales de preventas (MemeToro, AlphaPepe) que se cuelan en las búsquedas de "BNB AI". — [Bitcoin Sistemi](https://en.bitcoinsistemi.com/top-bnb-chain-meme-coins-2026-where-memetoros-ai-launchpad-fits-in-the-bnb-memecoin-ecosystem/); [OpenPR](https://www.openpr.com/news/4637903/bnb-news-bnb-chain-is-building-the-agent-economy-while-alphapepe)

### Inferences
- El patrón del repo `bsc-fourmeme-bot` (keyword stuffing, forks anómalos, fecha de creación antigua) encaja con repos cebo que distribuyen bots que roban claves. Conviene no ejecutarlo. Es inferencia, no se analizó el código.
- En los tax tokens (Flap, four.meme TaxToken), un tax alto o modificable es la forma más fácil de montar un honeypot. Una landing seria debería mostrar el tax, su inmutabilidad y el destino de los fondos.
- BNC4 y los stock-memes tienen un riesgo regulatorio y de peg (acciones tokenizadas cotizando con premium). Es inferencia; no se encontró ninguna acción regulatoria concreta.
- El flashloan de 4CLAW amplía la superficie de ataque. No consta ninguna auditoría.

### Gaps
- No se encontraron auditorías, datos de holders, concentración de supply, bundling ni snipers de ningún candidato, porque no hubo acceso a BscScan ni a los escáneres de GoPlus.
- Tampoco se encontraron métricas de usuarios o ingresos de 4CLAW, EQUITY, StonksPad ni B402.

## 4. Por qué es interesante y veredicto de inspiración (Payence / Nomia / Tricker / Tricker Terminal)

### Takeaway
Hay que inspirarse en las **mecánicas y en el producto**, no en los tokens en sí. Lo más valioso para el usuario:
- **Para Tricker:** la mecánica de Flap "tax → vault → pago a holders en el activo que se elija (BNB o bStocks)" (EQUITY/StonksPad), y los stock tokens de four.meme como activos base (BNC4/4Stock).
- **Para Payence/Nomia:** la pila x402/b402 más ERC-8004/8183 (pagos por request en USD1/USDT, un solo gesto de firma, identidad y escrow para agentes).
- **Para cualquier landing:** "lanza desde tu agente" (four.meme Agentic, 4CLAW).

### Cited Findings
- En la hackathon Good Vibes Only: OpenClaw Edition de BNB Chain se repartieron US$100K entre 10 ganadores. Hubo 600 builders y 200 proyectos en vivo; el jurado pesó un 60% y la comunidad un 40%. — [BNB Chain Blog](https://www.bnbchain.org/en/blog/good-vibes-only-openclaw-edition-winners); [Blockchain.news](https://blockchain.news/news/bnb-chain-openclaw-hackathon-awards-100k-ai-agent-projects)
- Ganadores relevantes, según las mismas fuentes:
  - **ProceedGate:** "AI governance agent... monitors other agents, enforces spending limits, and prevents runaway execution".
  - **AGOS Clawjob Marketplace:** agentes OpenClaw que se venden y compran servicios en USDT on-chain.
  - **VibeCheck:** puntuación de seguridad de tokens nuevos de BSC, hecha con IA y respaldada por una attestation en opBNB.
  - **Aegis y OpButler:** monitorización de posiciones DeFi con agentes.
  - Cuatro de los diez ganadores atacan exploits de DeFi.
  - Fuentes: [Blockchain.news](https://blockchain.news/news/bnb-chain-openclaw-hackathon-awards-100k-ai-agent-projects); [DoraHacks](https://dorahacks.io/hackathon/goodvibes/winner)
- Flap "BNB Stonks Szn": "$4M in rewards from @BNBCHAIN for bStocks-paired memes and the communities that actually hold them". Post del 2026-09-04 (fecha derivada del ID). — [X @flapdotsh](https://x.com/flapdotsh/status/2095886155296247819)
- Existe un panel público de APY de dividendos de tax de flap.sh ("flap.sh 税收分红 APY 面板 — 每10分钟自动更新"), creado el 2026-08-01. — [GitHub flap-apy](https://github.com/Glaucus666/flap-apy)
- La fuente sobre el ecosistema four.meme advierte de que la falta de utilidad fundamental hace que los precios colapsen cuando se va la atención. — [CryptoSlate](https://cryptoslate.com/launchpads/four-meme-review/)

### Inferences
**Veredicto por candidato**
- **BNC4 / 4Stock: inspirarse parcialmente.**
  - *Copiar (Tricker):* usar stock tokens como activos base de un "bag". La narrativa "tu meme está respaldado por acciones reales" es fácil de explicar en una landing.
  - *Evitar:* la ambigüedad peg/premium (dice "1:1" y cotiza "10x"). Una landing de Tricker debería mostrar el NAV del bag frente al precio de mercado, sin ocultar el premium.
- **4CLAW: inspirarse en la UX, no en el token.**
  - *Copiar (Payence/Nomia, launch sites):* lanzar tokens a partir de un prompt, un CLI ejecutable en local y la integración con el launchpad dominante (four.meme) en lugar de competir con él.
  - *Evitar:* un token sin fee link documentado y contratos de flashloan sin auditoría como "utilidad".
- **EQUITY / StonksPad: la mejor fuente de inspiración para Tricker.**
  - *Copiar:* el hook de la landing ("launch a coin that already pays its holders"); el reparto transparente 80/20; que el holder elija el activo de pago; montarse sobre Flap como operador con commission receiver (fee share permanente) en lugar de desplegar contratos propios.
  - *Traducción a Tricker:* un "bag token" cuyo tax compre la cesta de 3–5 activos y la reparta, con el APY del vault en directo en Tricker Terminal, al estilo del patrón flap-apy.
  - *Evitar:* un tax alto o modificable (riesgo de honeypot) y prometer "dividendos" sin mostrar los contratos y el vault.
- **B402 / x402-BNB (y Quack AI): la narrativa más alineada con Payence/Nomia, pero NO copiar el "token de protocolo".**
  - *Copiar:*
    - Liquidación por request en USD1/USDT/USDC/U dentro del propio HTTP.
    - Firma única con relayer que paga el gas (EIP-7702/EIP-712/EIP-3009).
    - Recibos auditables (Pieverse guarda los recibos en Greenfield).
    - Identidad de agente ERC-8004 y escrow ERC-8183.
    - Binance x402 como uno de los rails de Nomia.
    - ProceedGate valida en BNB la tesis de "spend policies" de Payence.
  - *Evitar:*
    - Tokens que se apropian del nombre del protocolo ("x402" muerto con US$6.5K de FDV).
    - La confusión de nombres (b402 de Vistara, BNBChain402/B402 y "Binance x402 (b402)").
    - Un token sin conexión con el volumen del facilitator.
- **Para Tricker Terminal:** integrar puntuaciones de seguridad (patrón VibeCheck más alertas tipo GoPlus sobre honeypots y Pixiu) y paneles de APY de vaults de tax como features diferenciales.

### Gaps
- No hay datos de conversión, retención ni usuarios de ninguna landing de estos proyectos para validar qué hooks funcionan.
- No se verificó si EQUITY o StonksPad tienen token propio ni cuánto han distribuido en dividendos.

## 5. Launchpads y narrativas dominantes en BNB Chain 2025–2026

### Takeaway
**four.meme** domina el volumen y **Flap** domina el estándar de tax, vault y dividendos. Flap funciona además como infraestructura para launchpads de terceros (StonksPad, EQUITY), y **Genius.fun** aparece como nuevo actor RWA. Tras la meme season de oct-2025 impulsada por CZ, las narrativas "tech" se sucedieron así: **x402** (oct-2025) → **agentes OpenClaw, Moltbook y ERC-8004** (ene–may 2026) → **stock memes y bStocks** (mediados de 2026 hasta la "BNB Stonks Szn" de sept-2026). Binance aporta el rail oficial **Binance x402** y el embudo **Binance Alpha**.

### Cited Findings
**Oct-2025: meme season**
- CZ compartió el meme el 1-oct-2025 y nació el token "4", que subió más del 2,000% hasta US$243M de MC. — [Decrypt](https://decrypt.co/343290/bnb-meme-season-arrives-binance-cz-coins-get-hot)
- Volumen de la cadena: US$20.5B frente a US$12.7B de Solana; memecoins BNB con US$335M diarios; tokens de four.meme por encima de US$1B de MC. Cifras del resumen de búsqueda. — [Atomic Wallet](https://atomicwallet.io/academy/articles/top-5-bnb-chain-memecoins-october-2025-season); [BingX](https://bingx.com/en/learn/article/bnb-meme-season-key-metrics-and-what-you-need-to-know)

**Oct-2025: x402 en BNB**
- Hilo de BNB Chain Devs sobre x402, del 2025-10-28 (fecha derivada del ID). — [X @BNBChainDevs](https://x.com/BNBChainDevs/status/1983198549039780026)
- Tres facilitators en una semana: b402 (25-oct), x402b (27-oct) y AEON (28/30-oct). — [Bitget News](https://www.bitget.com/news/detail/12560605040847); [PR Newswire](https://www.prnewswire.com/news-releases/aeon-launches-x402-facilitator-on-bnb-chain-advancing-real-world-autonomous-ai-payments-302599547.html)
- Más tarde llegó Binance x402, el facilitator de Binance Pay. — [Blockchain.news](https://blockchain.news/news/binance-x402-http-native-payments-bnb-chain)

**Oct-2025: Aster**
- **Rocket Launch:** pools de recompensa con ASTER más el token del proyecto. Los proyectos aportan capital y tokens, Aster recompra ASTER en el mercado y reparte según el volumen de trading. — [The Block](https://www.theblock.co/post/375876/aster-unveils-rocket-launch-your-gateway-to-early-stage-crypto-projects-and-trading-rewards); [The Defiant](https://thedefiant.io/news/defi/aster-rallies-on-rocket-launch-incentives-campaign)
- Para el 31-oct-2025 había superado US$1B de volumen; Nubila se sumó con más de 6M NB de recompensas. — [Chainwire](https://chainwire.org/2025/10/31/asters-rocket-launch-surpasses-1b-in-trading-volume-as-nubila-joins-with-over-6-million-nb-in-rewards/)
- ASTER superó US$2.2B de MC el 23-oct (fuera de banda). — [Bitget News](https://www.bitget.com/news/detail/12560605028354)

**Ene–may 2026: agentes**
- Hackathon OpenClaw de BNB Chain (ver sección 4). — [BNB Chain Blog](https://www.bnbchain.org/en/blog/good-vibes-only-openclaw-edition-winners)
- Moltbook (MOLT, en Base): Phemex habla de un ATH de US$7M, pero BingX dice más de US$42M a principios de feb-2026. Las fuentes se contradicen y es otra cadena. — [Phemex](https://phemex.com/news/article/molt-meme-coin-surpasses-7m-market-cap-reaches-alltime-high-56995); [BingX](https://bingx.com/en/learn/article/what-is-moltbook-molt-coin-reddit-like-ai-agent-social-network)
- ERC-8004 en BSC (4-feb / 4-mar-2026) y framework 8004/8183 (13-may-2026). — [The Defiant](https://thedefiant.io/news/blockchains/bnb-chain-agent-identity-erc-8004-go3uof)
- Agentic Mode de four.meme (1-mar-2026). — [KuCoin](https://www.kucoin.com/news/flash/four-meme-to-launch-agentic-mode-ai-agent-meme-product-on-bnb-chain)
- 4CLAW (mar-2026). — [GitHub](https://github.com/4clawd/4claw-agent-cli)
- "Four.Meme AI Sprint 2026" (abr-2026), con proyectos como waifu.fun (launchpad de tokens nativo para agentes) y VeriVerse (confianza entre agentes verificada con zkTLS). — [GitHub waifu.fun](https://github.com/waifufun/waifu.fun-hackathon); [GitHub VeriVerse](https://github.com/Skottbie/VeriVerse)

**2026: stock memes**
- Four.meme lanzó los Stock Memes emparejados con bStocks. — [CoinGabbar](https://www.coingabbar.com/en/crypto-currency-news/bnb-news-today-four-meme-stock-memes-launch-update)
- 4Stock alcanzó más de US$70M de MC y BNC4 más de US$5M. — [Phemex](https://phemex.com/news/article/4stock-surges-over-1980-within-five-hours-of-bsc-launch-95859); [Gate News](https://www.gate.com/news/detail/bnc4-meme-token-on-bsc-breaks-5-million-market-cap-10x-bnc-stock-value-24100472)
- Stonks llegó a US$14M. — [Phemex](https://phemex.com/news/article/bsc-meme-coin-stonks-hits-14-million-market-cap-sets-fresh-high-95588)
- Flap anunció la "BNB Stonks Szn" con US$4M de BNB Chain (2026-09-04). — [X @flapdotsh](https://x.com/flapdotsh/status/2095886155296247819)
- El volumen DEX de BSC superó US$1.3B en 24h, por encima de Ethereum (fecha no verificada). — [Phemex](https://phemex.com/news/article/bsc-24hour-dex-volume-tops-13b-overtakes-ethereum-95889)
- GMGN compara launchpads de stock memes: Pons (Robinhood Chain), StonkFun (Solana) y Flap (BSC). — [GMGN Blog](https://gmgn.ai/blog/pons-vs-stonkfun-vs-flap-robinhood-solana-bsc/)

**Mapa de launchpads**
- Four.meme es el launchpad líder de BNB (bonding curve y migración automática a PancakeSwap). — [CryptoSlate](https://cryptoslate.com/launchpads/four-meme-review/)
- Flap es "a leading token launch and trading platform on BNB Chain, especially known for creator revenue sharing and tax token standards". — [Flap docs](https://docs.flap.sh/flap/developers/basic-and-mechanism/flap-tax-token/tax-token-v3); [DefiLlama](https://defillama.com/protocol/flap-sh)
- TechFlow y ChainCatcher describen la evolución "From Flap to Genius, Shadows of CZ and the Strategic Moves of Binance" (solo títulos; contenido no leído). — [TechFlow](https://www.techflowpost.com/en-US/article/34070); [ChainCatcher](https://www.chaincatcher.com/en/article/2290715)
- Genius.fun se lanzó en BNB Chain como plataforma RWA de "corporate ownership" (fecha no verificada). — [crypto.news](https://crypto.news/genius-fun-launches-bnb-chain-platform-ownership/)
- Binance Alpha es el embudo de preselección de Binance Wallet. — [EasyMM](https://www.easymm.io/post/what-is-binance-alpha-the-complete-guide-for-traders-and-projects-in-2026)
- La hoja de ruta 2026 de BNB Chain apunta a 20,000 TPS y a pagos impulsados por IA. — [BNB Chain Blog](https://www.bnbchain.org/en/blog/tech-roadmap-2026)

### Inferences
- **Arquetipos dominantes de tech coin en BNB 2025–2026:**
  1. Tokens de agentes y launchpads para agentes (Agentic Mode, 4CLAW, identidad 8004).
  2. Rails de pago para agentes (x402/b402, USD1).
  3. Tokens "que pagan" (tax → vault → dividendos en BNB o en acciones tokenizadas).
  4. Herramientas de seguridad y análisis de tokens (VibeCheck, GoPlus).
- Lo que más a menudo "toca" US$1–10M en BNB siguen siendo memes culturales ligados a CZ o Binance ("Freedom of Money", "memes"). Los tech coins en banda son pocos y apenas tienen cobertura de prensa.
- Para un builder de landings de tech tokens en BNB, lo más defendible en sept-2026 es montarse sobre **Flap** (commission receiver) o **four.meme** (TaxToken, Agentic, Stock Memes) en lugar de desplegar un launchpad propio. El diferencial está en la landing, la transparencia de fees y vault, y las herramientas para agentes.
- Binance empuja institucionalmente los agentes (8004/8183, Binance x402, hackathons). Esa es la narrativa con más respaldo del ecosistema para Payence y Nomia.

### Gaps
- No se pudo leer el contenido de los artículos de TechFlow y ChainCatcher sobre la evolución de los launchpads, ni cuotas de mercado entre four.meme, Flap y Genius en 2026.
- Tampoco hay datos sobre lanzamientos o TGEs de Binance Wallet en 2026 de tokens tech pequeños ni sobre qué siguió exactamente al ecosistema de Aster en 2026 (Aster Chain, nuevos Rocket Launch).
- La fecha de lanzamiento de Binance x402 y la de Genius.fun no están verificadas.
