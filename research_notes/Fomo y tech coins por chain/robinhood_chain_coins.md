# Robinhood Chain: estado a septiembre de 2026 y tokens (tech coins primero) que tocaron un market cap de US$700K–US$10M

## 1. ¿Qué es Robinhood Chain y cómo está a septiembre de 2026? (testnet/mainnet, permisos, DEXs, launchpads, explorer, bridge, soporte de fomo)

### Takeaway
Robinhood Chain es una L2 de Ethereum construida sobre Arbitrum (Orbit / "Arbitrum Dedicated Blockchains"), pensada para stock tokens/RWA y "AI-native". Su testnet pública arrancó el 10-feb-2026 y su mainnet pública el 1-jul-2026. Desplegar contratos y lanzar tokens no requiere permiso. Desde julio, la mayor parte de la actividad son memecoins lanzadas por launchpads: Noxa (cerró en julio), luego Pons, Long.xyz, Uniswap Pools.trade, Virtuals y otros. fomo.family integró la cadena el 9-jul-2026 como una de sus seis cadenas. El ecosistema NO es pequeño: a inicios de septiembre movía ~US$1,5–1,9B diarios en DEX. Después las fees de la red cayeron un 97% (a mediados de septiembre).

### Cited Findings
**Cronología y producto**
- La testnet pública salió el 10-feb-2026 — [Robinhood Newsroom](https://robinhood.com/us/en/newsroom/robinhood-chain-launches-public-testnet). Se lanzó en Consensus Hong Kong — [The Defiant](https://thedefiant.io/news/blockchains/robinhood-launches-robinhood-chain-mainnet-adds-stock-tokens-onchain-lending-and-agentic-crypto) (dato tomado del resumen del buscador).
- La testnet procesó 4 millones de transacciones en su primera semana — [Crowdfund Insider](https://www.crowdfundinsider.com/2026/02/262764-robinhood-chain-testnet-achieves-solid-start-with-4-million-transactions-in-first-week/); [Yahoo Finance](https://finance.yahoo.com/news/robinhood-arbitrum-l2-chain-launches-124715466.html).
- Datos de la testnet — [Arbitrum blog](https://blog.arbitrum.io/robinhood-chain-testnet/):
  - bloques de hasta ~100 ms y compatibilidad con el tooling de Ethereum;
  - ETH de prueba y "stock tokens" simulados (TSLA, AMZN);
  - partners: Alchemy, Chainlink, LayerZero y TRM Labs;
  - Robinhood comprometió US$1M al programa Arbitrum Open House 2026, con buildathons en NY, Dubái, Londres y Singapur.
- La mainnet pública salió el 1-jul-2026 en la keynote "Robinhood Presents: The World is Flat" (Old Royal Naval College, Londres), presentada por Vlad Tenev y Johann Kerbrat. Llegó junto con stock tokens 24/7, perps de Lighter, lending on-chain y un agentic trading cripto todavía planificado — [The Block](https://www.theblock.co/news/business/2026-07-01-robinhood-chain-goes-live-mainnet-alongside-24-7-tokenized-stocks-lighter-perps-planned-crypto-agentic-trading-406918); [The Defiant](https://thedefiant.io/news/blockchains/robinhood-launches-robinhood-chain-mainnet-adds-stock-tokens-onchain-lending-and-agentic-crypto); [Robinhood Newsroom](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/); [Fintech Global](https://fintech.global/2026/07/03/robinhood-launches-robinhood-chain-mainnet-and-defi-suite/).
- Launch partners — [The Defiant](https://thedefiant.io/news/blockchains/robinhood-launches-robinhood-chain-mainnet-adds-stock-tokens-onchain-lending-and-agentic-crypto); Chainlink además en [PR Newswire](https://www.prnewswire.com/news-releases/robinhood-chain-launches-and-adopts-chainlink-to-unlock-access-to-the-onchain-economy-for-millions-of-users-302816242.html):
  - Uniswap: un AMM dedicado como protocolo principal de liquidez pública;
  - Pleiades: su propio AMM como venue de trading propietario;
  - Alchemy, BitGo y Chainlink.
  - La cadena se describe como "AI-native" y orientada a RWA.
- La cadena está construida sobre Arbitrum Dedicated Blockchains y es compatible con Ethereum — [Robinhood Newsroom](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/) (vía resumen).
- Con "Agentic Trading", un agente de IA de terceros accede a una cuenta de brokerage dedicada y ejecuta operaciones permitidas — misma fuente, vía resumen. Agentic Trading se abrió a cripto con soporte de agentes vía MCP (21-jul-2026) — [Genfinity](https://genfinity.io/2026/07/21/robinhood-agentic-trading-crypto-ai-agents/); [Robinhood "Robinhood is Now Open to Agents"](https://robinhood.com/us/en/newsroom/robinhood-is-now-open-to-agents/) (solo título).

**Datos técnicos (fuentes mayoritariamente de terceros)**
- Chain ID 4663 en mainnet y 46630 en testnet. RPC públicas `https://rpc.mainnet.chain.robinhood.com` y `https://rpc.testnet.chain.robinhood.com`. El gas se paga en ETH y el stack es Arbitrum Orbit — [TrustSwap network details](https://trustswap.com/robinhood/network-details); [ChangeNOW](https://changenow.io/blog/what-is-robinhood-chain); [QuickNode guide](https://www.quicknode.com/guides/robinhood/what-is-robinhood-chain) (atribución vía resumen). El chain ID 4663 también aparece en [Rates.my](https://rates.my/insights/robinhood-chain-fomo-pons-index-cashcat-2026) y en [GitHub nirholas/robinhood-volume-alerts](https://github.com/nirholas/robinhood-volume-alerts).
- Explorer de mainnet: Blockscout en `robinhoodchain.blockscout.com`, con páginas de tokens como CRUMBS — [Blockscout](https://robinhoodchain.blockscout.com/token/0x80bAa4b3bfAC6f4978700dF824B1B3d98e889136). Explorer de testnet: [explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com/).
- Bridge: el canónico de Arbitrum (portal.arbitrum.io) y bridges de terceros — [TrustSwap](https://trustswap.com/robinhood/network-details); [ChangeNOW](https://changenow.io/blog/what-is-robinhood-chain) (vía resumen). Guía de bridging: [CoinCodex](https://coincodex.com/article/87775/how-to-bridge-to-robinhood-chain/) (solo título). LayerZero figura como partner desde la testnet — [Arbitrum blog](https://blog.arbitrum.io/robinhood-chain-testnet/).
- Permisos — [TrustSwap](https://trustswap.com/robinhood/what-is-robinhood-chain); [QuickNode](https://www.quicknode.com/guides/robinhood/what-is-robinhood-chain) (vía resumen):
  - "Deploying a contract is a permissionless act"; el acceso de wallets también es permissionless;
  - el sequencer ordena las transacciones;
  - los cambios críticos los gobierna un Security Council de 8 miembros.
  - Hay un tutorial oficial de despliegue con Foundry: [Robinhood Chain Docs](https://docs.robinhood.com/chain/deploy-smart-contracts).
- Documentación oficial de stock tokens y lista de contratos: [Stock Tokens docs](https://docs.robinhood.com/chain/stock-tokens/), [Token Contracts docs](https://docs.robinhood.com/chain/contracts/), [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/).

**DEXs, launchpads y apps**
- Uniswap está live en la cadena — [Uniswap blog](https://blog.uniswap.org/robinhood-chain-is-live).
- **Pools.trade** (Uniswap) — [crypto.news](https://crypto.news/uniswap-launches-first-robinhood-chain-launchpad/); [Decrypt](https://decrypt.co/375031/morning-minute-uniswap-enters-the-launchpad-wars-on-robinhood-chain):
  - launchpad propio de Uniswap sobre v4;
  - dos modos: "instant launch" y "crowd launch", este último diseñado contra el bundling/sniping;
  - distribución desde el día 1 en la web app, wallet y trading API de Uniswap, y en Bitget, **Fomo**, GMGN y OKX Wallet.
  - Uniswap Labs compró PONS — [crypto.news](https://crypto.news/uniswap-labs-buys-pons-as-robinhood-chain-launchpad-fees-surge/) (título); [KuCoin blog](https://www.kucoin.com/blog/pons-500m-market-cap-robinhood-chain-token-burn).
- **Noxa** (noxa.fi / fun.noxa.fi): el primer launchpad dominante.
  - Mecánica — [Noxa docs](https://fun.noxa.fi/docs); [Bitrue guía Noxa](https://www.bitrue.com/blog/noxa-fun-robinhood-chain-guide) (vía resumen):
    - lanzamiento en una sola transacción y sin fee de lanzamiento;
    - las 1.000M unidades de supply van a una posición de liquidez single-sided en Uniswap V3 bloqueada para siempre;
    - en el bloque de lanzamiento solo puede comprar el creador, y el tamaño de compra está limitado durante la primera hora.
  - Lanzó más de 60.000 tokens (~75% de todos los de la cadena), CASHCAT incluido, y cobró ~US$12M en fees. El 11-jul dejó de aceptar lanzamientos y el 13-jul su web se cayó — [CoinDesk 15-jul-2026](https://www.coindesk.com/business/2026/07/15/the-launchpad-that-fueled-robinhood-chain-s-memecoin-boom-just-gave-away-all-its-revenue); [Tom Wan en X](https://x.com/tomwanhh/status/2076327451853050019); [NFT Plazas](https://nftplazas.com/noxa-robinhood-chain-launchpad-shuts-down-12m-fees/).
  - Justificó el cierre por los tokens de baja calidad que inundaban la plataforma.
  - Ojo: el titular de CoinDesk dice "made $12 million and disappeared" y el slug dice "just gave away all its revenue". Son dos lecturas distintas, quizá por un cambio de titular.
  - Existen "bundlers" comerciales para Noxa — [Smithii](https://smithii.io/en/noxa-bundler-robinhood-chain/) (solo título).
- **Pons** (pons.family / ponsfamily.com, @ponsdotfamily): hoy es el launchpad principal. Su ficha está en la sección 3.
- **Long.xyz** — [MEXC Learn](https://www.mexc.com/learn/article/what-is-long-xyz-how-stock-paired-memecoins-are-reshaping-robinhood-chain/1); [AirdropAlert](https://airdropalert.com/blogs/what-is-long-xyz/); [RobinHub en X](https://x.com/RobinHubHB/status/2081065819526828277); [KuCoin](https://www.kucoin.com/news/flash/long-xyz-adds-10-000-new-asset-issuance-projects-after-pre-ipo-feature-launch):
  - cada token que lanza cotiza contra un Robinhood Stock Token: NVDA, AAPL, MSFT, GOOGL, TSLA, MU o SPCX;
  - su fundador es "Nate" (@Natan_benish);
  - la feature "Pre-IPO" sumó 10.000 lanzamientos nuevos, y según el fundador la emisión diaria podría llegar a 100.000 si no se limita por código (preocupación por bots).
- **Memecoin.fun** levantó US$3,5M en una ronda liderada por Becker Ventures, con BitValue Capital, Mason Labs, Negentropy Capital y el angel Billy Wen — [Dealroom](https://app.dealroom.co/news/feed/robinhood-chain-launchpad-memecoin-fun-raises-3-5m-to-expand-cross-chain-meme-token-platform); [Bloomingbit](https://en.bloomingbit.io/feed/news/116953).
- Otros launchpads:
  - LaunchHood: listing instantáneo vía Uniswap — [launchhood.com](https://launchhood.com/);
  - Robinlaunch: bonding curve o Uniswap V3 instantáneo — [robinlaunch.fun](https://robinlaunch.fun/);
  - launchpad.meme — [launchpad.meme](https://launchpad.meme/robinhood-launchpad);
  - Openfair: fair launch con bonding curve o listing instantáneo en Uniswap V3 — [Bitcoin Foundation](https://bitcoinfoundation.org/news/blockchain-news/best-robinhood-chain-launchpads-2026/) (vía resumen);
  - listados comparativos: [Bitrue](https://www.bitrue.com/blog/best-robinhood-launchpads-2026), [AirdropAlert](https://airdropalert.com/blogs/robinhood-launchpads/).
- **Virtuals Protocol**:
  - Anunció infraestructura agéntica en la cadena "desde el día 1" (2-jul-2026) — [Virtuals en X](https://x.com/virtuals_io/status/2072716073703747991); [TradingView/CoinMarketCal](https://www.tradingview.com/news/coinmarketcal:ec2cea3c9094b:0-virtuals-protocol-robinhood-x-virtual-02-july-2026/).
  - En menos de 30 días se lanzaron más de 5.600 agentes de IA, con una "economía de agentes" de ~US$200M — [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-200m-robinhood-chain/).
  - El volumen de trading de agentes superó los US$100M — [Bitget News](https://www.bitget.com/news/detail/12560605508040) (título).
  - Tokenización de agentes — [Virtuals, guía en X](https://x.com/virtuals_io/article/2079962937566056563) (vía resumen):
    - bonding curve con fee del 1%;
    - graduación al acumular 42.000 VIRTUAL;
    - la liquidez pasa a un pool público de Uniswap en la cadena.
  - También lanzó un "índice tokenizado personalizable" en la cadena — [Pluang](https://pluang.com/en/news-feed/virtuals-protocol-luncurkan-indeks-tokenisasi-kustom-di-robinhood-chain) (solo título).
- **Bankr y Clanker** aparecen como launchpads compatibles en un listicle — [Bitrue](https://www.bitrue.com/blog/best-robinhood-launchpads-2026). Un resumen del buscador afirma que "Bankr deploys to Robinhood Chain by default"; no pude verificarlo en fuente primaria ([Bankr docs](https://docs.bankr.bot/token-launching/overview/)).
- **GMGN** (app de trading de memecoins):
  - Pons y GMGN aportaron ~US$2M de fees en el pico de la cadena — [CoinDesk 19-sep](https://www.coindesk.com/business/2026/09/19/robinhood-chain-fees-collapse-97-even-as-transactions-stay-near-record-highs).
  - GMGN, Pons y Uniswap sumaban ~93% del revenue medido de apps: Pons ~US$1,03M, GMGN ~US$1,11M y Uniswap US$327.707 (fecha no indicada) — [Santiment](https://app.santiment.net/insights/read/deep-dive-uniswap-ignites-robinhood-chain-s-new-launchpad-economy-11142) (vía resumen).
- **Bots de Telegram** — [Maestro](https://www.maestrobots.com/blog/robinhood-chain-trading-bot); [Publish0x/Cove](https://www.publish0x.com/on-chain-memecoins-trading/how-to-trade-robinhood-chain-tokens-in-telegram-cove-adds-da-xkdxwqx); [NockTerminal](https://nockterminal.com/); [TelegramTrading.net](https://telegramtrading.net/robinhood-trading-bot-review/):
  - Maestro;
  - Cove: primer bot con soporte desde el día 1 y saldo USDC unificado;
  - SUITE;
  - NockBot: 1% de fee por swap, sniping y copy trading.

**fomo.family y Robinhood Chain**
- "Robinhood chain, now live on fomo" — [fomo en X](https://x.com/fomo/status/2075294725528035631). La fecha es el 9-jul-2026 según el resumen, y Binance Square lo publicó el 10-jul-2026 — [Binance Square](https://www.binance.com/en/square/post/07-10-2026-fomo-now-supports-robinhood-chain-343072027528961); [Bitget News](https://www.bitget.com/news/detail/12560605498709); [WEEX](https://www.weex.com/news/detail/fomo-crypto-trading-app-adds-support-for-robinhood-chain-zjrr50oxajeo7f9x5huztfeh).
- fomo opera en seis cadenas (Solana, Base, BNB Chain, Monad, Ethereum y Robinhood Chain) desde una sola cuenta con un único saldo en cash, sin bridging ni cambio de red. También ofrece perps apalancados, no disponibles para personas de EE.UU. — [Medium/Coinmonks, ago-2026](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8); [Bitcoin Foundation](https://bitcoinfoundation.org/news/trading/what-is-the-fomo-app-how-it-works-and-how-to-use-it/) (vía resumen).
- Con Robinhood Chain, fomo metió stock tokens (AAPL, TSLA, NVDA) en el mismo feed que las memecoins — vía resumen; fuente probable [Toobit](https://www.toobit.com/en-US/news/fomo-expands-on-robinhood-chain-as-trading-rises) o [fomotrading.app](https://fomotrading.app/).
- Tracción de fomo — [Bitcoin.com News](https://news.bitcoin.com/finance/fomo-trading-app-top-5-us-finance-charts/):
  - más de 500.000 traders;
  - top 5 de apps de finanzas en EE.UU., por encima de Cash App y Kalshi;
  - 4,6–4,8 estrellas en la App Store con más de 14.000 reseñas;
  - más de 1M de instalaciones en Google Play.
- Fees y referidos: la fee estándar es 0,50% por trade; quien refiere cobra el 25% de las fees de sus referidos, y el referido paga 0,45% — [Medium/Coinmonks](https://medium.com/coinmonks/fomo-app-guide-social-trading-rewards-and-how-to-start-02b15b8d05a8) (vía resumen).
- "Only 229 users top $10,000 in profit" — [BigGo Finance](https://finance.biggo.com/news/852edb6d-5060-4cf3-8e2b-401dc1fdda1b) (solo título). "Robinhood Chain Launch Leaves Most Fomo Traders…" — [Binance Square](https://www.binance.com/en/square/post/364077150611017) (solo título).
- PONS se puede tradear en fomo, que ofrece social trading multichain y gasless — [Rates.my](https://rates.my/insights/robinhood-chain-fomo-pons-index-cashcat-2026).
- **Colisión de nombres**: "FOMO" es también el producto de FLock.io, FLock Open Model Offering ("FOMO IS NOW LIVE ON ROBINHOOD CHAIN… AI Model Tokens"). No tiene relación con fomo.family — [FLock en X](https://x.com/flock_io/status/2095807028023468536); [FLock blog](https://www.flock.io/blog/flock-open-model-offering-fomo-step-by-step-guide); [fomo.flock.io](https://fomo.flock.io/).
- Hay sitios de terceros que usan la marca y que no pude verificar como oficiales:
  - [fomo-family.app](https://fomo-family.app/);
  - [fomoradar.app](https://fomoradar.app/token/0xef06f1bdc11902bd46ee2f3627174c6741d0c8ff), que lista un token "FoMo" `0xef06f1bdc11902bd46ee2f3627174c6741d0c8ff`;
  - [fomopons.family](https://fomopons.family/) ("ponsfamily — Every token starts on @fomo").

**Métricas del ecosistema**
- A las pocas semanas, las memecoins generaban más del 80% del volumen. Un token de gato llegó a valer más que todos los stock tokens de la cadena juntos. A inicios de septiembre hubo US$1,49B de volumen DEX en 24h, +500% en 30 días — [CryptoTicker](https://cryptoticker.io/en/robinhood-chain-memecoins-explained/).
- 25-ago-2026: entre US$920M y US$944M de volumen DEX en un día — [Rates.my](https://rates.my/insights/robinhood-chain-fomo-pons-index-cashcat-2026). Récord de US$989M en un día — [BigGo](https://finance.biggo.com/news/047783c5-f0ee-44d9-85b4-2aa413ef5aac) (solo título).
- 31-ago-2026: la cadena supera a Ethereum en revenue diario — [CoinDesk](https://www.coindesk.com/markets/2026/08/31/robinhood-chain-beats-ethereum-in-daily-revenue-as-memecoin-trading-takes-over) (título).
- 2/3-sep-2026 — [CoinDesk 3-sep](https://www.coindesk.com/tech/2026/09/03/a-memecoin-making-app-becomes-crypto-s-top-fee-generators-as-robinhood-chain-activity-explodes); [CoinDesk en X](https://x.com/CoinDesk/status/2095526392926531642); [PYMNTS](https://www.pymnts.com/blockchain/2026/memecoin-app-pons-drives-record-fees-on-robinhoods-new-blockchain/):
  - Pons cobró ~US$5,95M en fees en 24h y quedó #4 en DefiLlama, detrás de Tether, Uniswap y Circle y por encima de Pump (US$4,64M);
  - ~25.000 tokens nuevos el 2-sep y US$544M de volumen en 24h;
  - desde julio, ~646.000 tokens creados por más de 167.000 direcciones;
  - la cadena cobró ~US$4M en un día, alrededor de 1/5 de todo lo cobrado desde julio.
- 13-sep: US$1,88B de volumen DEX en un día. TVL ~US$1,00B al 24-sep — [Bitrue](https://www.bitrue.com/blog/coins-on-robinhood-chain-skyrocket-in-september-2026).
- 19-sep: las fees de la red cayeron un 97% — [CoinDesk 19-sep](https://www.coindesk.com/business/2026/09/19/robinhood-chain-fees-collapse-97-even-as-transactions-stay-near-record-highs); [Crowdfund Insider](https://www.crowdfundinsider.com/2026/09/311510-robinhood-chain-fees-plunge-nearly-100-while-transactions-hold-near-all-time-highs/):
  - en el pico se cobraban ~US$8M al día con 13,1M de transacciones (~US$0,64 por tx);
  - el 16-sep fueron ~US$230K con 8,9M de transacciones (~US$0,026 por tx);
  - la actividad cayó solo un 32%;
  - los DEX movieron ~US$13B en los 7 días hasta el 16-sep (+5% semanal);
  - las apps cobraron ~US$8M en fees en 24h y retuvieron US$1,5M de revenue, frente a los US$230K de la red.
- Stock tokens:
  - market cap de los stock tokens de Robinhood: US$78M, frente a US$9,4M de Coinbase — [Crypto Briefing](https://cryptobriefing.com/robinhood-leads-stock-token-market-cap-78m/) (título);
  - la categoría "Robinhood Chain Stocks Ecosystem" de CoinGecko suma ~US$159M (fecha no indicada) — [CoinGecko](https://www.coingecko.com/en/categories/robinhood-chain-stocks-ecosystem);
  - las stablecoins en la cadena superan US$1B — [KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-stablecoin-market-cap-surpasses-1-billion) (título).
- El 23% del NVDA tokenizado está bloqueado en el pool de la meme AI — [KuCoin](https://www.kucoin.com/news/flash/23-of-tokenized-nvidia-stock-locked-in-meme-coin-ai-on-robinhood-chain) (título). Con Long.xyz, Robinhood Chain superó a Solana en trading de stock tokenizados — [crypto.news](https://crypto.news/tokenized-nvidia-found-its-first-real-market-memecoin-collateral/) (vía resumen). Long.xyz tiene ~US$12M de TVL en stock (~20% del total de la cadena) y más de US$425M de volumen en 24h — [The Merkle](https://themerkle.com/long-longxyz-review-the-launchpad-turning-robinhoods-stock-tokens-into-a-new-asset-class) / [RobinHub en X](https://x.com/RobinHubHB/status/2081065819526828277) (vía resumen; fecha no indicada).

### Inferences
- A septiembre de 2026 la cadena no es "demasiado nueva ni pequeña": es uno de los principales venues de memecoins de cripto. La banda de US$700K–US$10M es "small cap" frente a su top, que está entre US$250M y US$500M.
- El producto insignia, los stock tokens, terminó sirviendo más como *quote asset* o colateral de memecoins (Long.xyz, AI/NVDA) que como producto de inversión en sí mismo.
- Que las fees caigan un 97% mientras las transacciones solo caen un 32% apunta a que el frenesí especulativo tocó techo a inicios de septiembre. El uso sigue alto, pero ahora es más barato.
- fomo es un canal de distribución clave en la cadena: Pools.trade lo lista como venue desde el día 1 y PONS se puede tradear en fomo.

### Gaps
- **Metodología**:
  - WebFetch y curl están bloqueados en este entorno, así que todas las cifras salen de títulos, snippets y resúmenes del buscador y no se verificaron en vivo en DexScreener, GeckoTerminal o CoinGecko.
  - Cuando un resumen mezclaba varios enlaces, cito los más probables y lo marco como "vía resumen".
  - El presupuesto de búsquedas de la sesión (200/200) se agotó antes de cerrar algunos huecos.
- El anuncio de junio de 2025 no se verificó en esta sesión. Por conocimiento previo del modelo (**no verificado**), se anunció el 30-jun-2025 en el evento "To Catch a Token" en Cannes, junto con stock tokens en Arbitrum para la UE.
- No encontré detalles sobre Pleiades (AMM propietario).
- No verifiqué si existe un dominio oficial de explorer de mainnet además de robinhoodchain.blockscout.com.
- No verifiqué la disponibilidad geográfica (EE.UU. vs. resto) de la cadena y los stock tokens. Solo tengo el título de [TrustSwap](https://trustswap.com/robinhood/us-availability).
- No hay fuente primaria que confirme el soporte de Bankr y Clanker en Robinhood Chain.
- No pude confirmar si fomo.family y Pons comparten equipo. Hay indicios de marca ("*.family", el sitio "Every token starts on @fomo"), pero **no se afirma afiliación**.

## 2. ¿Qué tokens se han lanzado, en qué launchpads, y cuáles tocaron la banda de US$700K–US$10M?

### Takeaway
Se han lanzado cientos de miles de tokens: solo Pons llevaba ~646K al 3-sep. Los líderes están muy por encima de la banda: PONS ~US$430–500M, AI ~US$270–361M, CASHCAT ~US$254M, NET ~US$90–117M y STANDARD ~US$29–40M.

Criterio: "tocar la banda" = MC documentado, o derivado aritméticamente de cifras publicadas, dentro de US$700K–US$10M en alguna fecha. Con ese criterio:
- **Tech coins que tocaron la banda** (según evidencia indirecta): **The Index (INDEX)**, con ~US$6–7M en julio antes de su rally, y **PONS**, con ~US$2,4–3,3M en su mínimo del 17-jul.
- **Memes en banda**: **MONITOR** (~US$1,1M antes de su pump del 23-sep) y **LIGER** (US$1,34M en septiembre).
- **CRUMBS**, un proyecto de pagos, quedó por debajo de la banda (~US$52–75K).
- De Nock Finance y de los tokens de agentes de Virtuals (GTR, PRIZE) no encontré MC verificado.

### Cited Findings
**Tokens top (por encima de la banda)**
- **CASHCAT** (meme):
  - es el meme insignia y se lanzó vía Noxa — [Tom Wan en X](https://x.com/tomwanhh/status/2076327451853050019);
  - su nombre viene de la marca "CashCat" que Vlad Tenev y Baiju Bhatt descartaron antes de llamar Robinhood a la empresa — [Rates.my](https://rates.my/insights/robinhood-chain-fomo-pons-index-cashcat-2026);
  - está listado dentro de la app de Robinhood — [Robinhood](https://robinhood.com/us/en/crypto/CASHCAT/);
  - a inicios de septiembre valía ~US$254M, un nuevo ATH por encima del pico de julio — [CryptoTicker](https://cryptoticker.io/en/robinhood-chain-memecoins-explained/);
  - contrato, visto en la URL de OpenSea: `0x020bfc650a365f8bb26819deaabf3e21291018b4` — [OpenSea](https://opensea.io/token/robinhood/0x020bfc650a365f8bb26819deaabf3e21291018b4).
- **AI (Artificial Inu)** (meme):
  - se emitió en Long.xyz y está emparejado con NVDA tokenizado — [KuCoin](https://www.kucoin.com/news/flash/ai-artificial-inu-token-on-robinhood-chain-surpasses-200m-market-cap);
  - superó los US$272M el 11-sep, con +37% — [KuCoin](https://www.kucoin.com/news/flash/robinhood-meme-coin-ai-surpasses-270m-market-cap-24-hour-surge-exceeds-37);
  - llegó a US$361M con +31,68%, "about one week ago" respecto a la búsqueda — [KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-s-ai-token-surpasses-360m-market-cap-24h-surge-exceeds-30);
  - otras fuentes dan un ATH de US$325M — [KuCoin](https://www.kucoin.com/news/flash/long-xyz-founder-s-ai-meme-coin-investment-surpasses-758x-return) — o un pico de US$320M — [KuCoin overview](https://www.kucoin.com/news/flash/overview-of-popular-tokens-on-robinhood-chain-market-cap-and-narrative-analysis-of-pons-and-long-xyz-platform-projects). Las cifras no coinciden;
  - el fundador de Long.xyz compró por US$3.800 con un MC de ~US$219.800, y la posición llegó a ~US$2,92M (758x) — [KuCoin](https://www.kucoin.com/news/flash/long-xyz-founder-s-ai-meme-coin-investment-surpasses-758x-return).
- **PONS** (tech: token de launchpad): llegó a más de US$430M el 3-sep y a US$500M después. Detalle en la sección 3.
- **NET (NetNet Capital)** (tech/DeFi):
  - protocolo inspirado en OlympusDAO v1, con USDG en tesorería como respaldo;
  - ATH por encima de US$117M y retroceso a US$90,3M — [KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-ecosystem-tokens-pons-ai-and-net-hit-new-highs); [CoinEx](https://www.coinex.com/en/feed/news/6a93834e4c01086d04977300).
- **STANDARD (The Standard Reserve)** (tech/DeFi): US$40M a las 2 horas de lanzarse el 14-sep, luego US$28,91M — [KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-s-standard-token-hits-40m-market-cap-in-2-hours). Detalle en la sección 3.
- Otros nombres que aparecen:
  - MEME y BONER — [Bitget Academy](https://web3.bitget.com/en/academy/top-rohinhood-chain-memecoins);
  - SPACEHOOD (Long.xyz, emparejado con SpaceX tokenizado, SPCX) — [MEXC Learn](https://www.mexc.com/learn/article/what-is-long-xyz-how-stock-paired-memecoins-are-reshaping-robinhood-chain/1);
  - HMM, DELTA, microduck y YOLO — [KuCoin overview](https://www.kucoin.com/news/flash/overview-of-popular-tokens-on-robinhood-chain-market-cap-and-narrative-analysis-of-pons-and-long-xyz-platform-projects);
  - FOX y HOODIE — [CoinGape](https://coingape.com/markets/3-robinhood-chain-tokens-rallying-the-most-this-week-fox-cashcat-hoodie/) (título).
- **Conflicto de datos**: un blog de Bitrue de septiembre de 2026 da PONS en ~US$67,92M y AI en ~US$29M — [Bitrue](https://www.bitrue.com/blog/coins-on-robinhood-chain-skyrocket-in-september-2026). Esto contradice a Decrypt y KuCoin, que dan US$430–500M y US$270–361M. Probablemente es un dato viejo o un error.

**Tokens en la banda o que la tocaron**
- **The Index (INDEX)**:
  - "+150% en 24h, MC above $18 million" en julio de 2026 — [Coin Bureau en X](https://x.com/coinbureau/status/2077619235262742886); [CoinGape](https://coingape.com/robinhood-chains-index-150-rally-turns-trading-fees-into-real-stock-rewards/); [HokaNews (URL 2026/07)](https://www.hokanews.com/2026/07/robinhood-chain-token-index-surges-150.html);
  - otra versión: "+157%, MC tops $16 million" — [Cryip](https://cryip.co/robinhood-chain-index-token-jumps-157-percent-market-cap-16-million/).
- **MONITOR** (meme):
  - "MC surpassed $13 million, +1,070% en 24h" — [KuCoin](https://www.kucoin.com/news/flash/the-market-capitalization-of-robinhood-chain-coin-stock-meme-coin-monitor-has-surpassed-13-million-with-a-24-hour-increase-of-1070);
  - +600% después de que Joe Lonsdale se sumara, el 23-sep — [KuCoin](https://www.kucoin.com/news/flash/palantir-co-founder-joins-meme-coin-monitor-price-surges-600).
- **LIGER** (meme; producto no verificado): MC de US$1,34M, liquidez de US$135K y ~US$853K de volumen en 24h, en septiembre de 2026 — [Bitrue](https://www.bitrue.com/blog/coins-on-robinhood-chain-skyrocket-in-september-2026).
- **Vlad** (meme): token "de pocas horas" con picos de volumen de varios millones — [Bitrue](https://www.bitrue.com/blog/coins-on-robinhood-chain-skyrocket-in-september-2026). MC no verificado.
- **CRUMBS** (tech: pagos/recompensas): por debajo de la banda. MC de ~US$75.362 (precio ~US$0,00007539 y supply de 1.000M), US$52.124 según MEXC y US$52,94K según CMC — [CoinMarketCap](https://coinmarketcap.com/currencies/crumbs/); [MEXC](https://www.mexc.com/price/crumbs).
- **Nock Finance (NOCK en Robinhood Chain)** (tech: IA): precio de US$0,000007 y volumen 24h de US$138,47 (fecha no indicada) — [CoinMarketCap](https://coinmarketcap.com/currencies/nock-finance/). MC no verificado.
- **GTR y PRIZE** (tokens de agentes Virtuals en la cadena): MC no verificado — [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-200m-robinhood-chain/) (vía resumen).

### Inferences
- **INDEX**: si el MC superó US$18M tras subir un 150%, antes del rally rondaba US$18M / 2,5 ≈ **US$7,2M**. Con la otra versión (+157% hasta US$16M) serían ≈ **US$6,2M**. En ambos casos estaba dentro de la banda en julio de 2026, justo antes del rally. Por el ID del post de Coin Bureau (snowflake de X), el rally fue hacia el **15–16 de julio de 2026**; esto es una inferencia.
- **PONS**: el 17-jul tocó ~US$0,0033. El 3-sep, US$430M / US$0,5978 ≈ 719M tokens en circulación, lo que cuadra con un supply inicial de ~1.000M y ~27% quemado al 11-ago. Por tanto, el MC del 17-jul estaría entre **~US$2,4M y US$3,3M**, dentro de la banda. En agosto ya iba de US$20M a más de US$200M ([CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/pons/latest-updates/), vía resumen).
- **MONITOR**: US$13M / 11,7 (+1.070%) ≈ **US$1,1M** antes del pump del 23-sep. Si se usa el +600%, serían ≈ US$1,9M. En ambos casos, dentro de la banda.
- **AI**: pasó de ~US$219,8K a más de US$300M, así que atravesó la banda. Es un meme.
- **STANDARD**: llegó a US$40M en 2 horas, así que solo pudo pasar por la banda durante minutos. No se documenta que permaneciera en ella.

### Gaps
- No pude revisar los gráficos de DexScreener ni GeckoTerminal para confirmar ATH, mínimos y fechas exactas.
- No tengo fechas exactas de lanzamiento de INDEX, MONITOR y LIGER.
- No verifiqué el launchpad de INDEX. Un snippet dice "on 13 July the token lost over 30 percent after the Noxa launchpad ceased operations", pero no aclara si se refiere a INDEX o a otro token.
- No encontré MC de GTR, PRIZE, los Model Tokens de FLock ni Nock Finance.
- No sé si CRUMBS estuvo alguna vez en la banda (solo tengo cifras actuales).

## 3. Fichas de los tokens del ranking (tech coins primero) y menciones

### Takeaway
Ranking: **#1 The Index (INDEX)**, tokenized-stock tooling con fee que compra una canasta de 18 acciones; **#2 PONS**, token de infraestructura de launchpad que tocó la banda en julio y escaló a US$430–500M; **#3 MONITOR**, **meme** emparejado con acciones, incluido como mejor meme en banda con narrativa de stock token. Menciones: STANDARD y NET (DeFi, por encima de la banda), CRUMBS (pagos, por debajo), Nock Finance (IA con intents, MC no verificado), agentes de Virtuals y Model Tokens de FLock.

### Cited Findings
**#1 — The Index (INDEX)** (tech coin: rewards en stock tokens)
- Nombre y ticker: The Index / INDEX. Contrato, visto en URLs de OpenSea, Phantom y Bitget Wallet: `0x56910d4409f3a0c78c64dd8d0545ff0705389870` — [OpenSea](https://opensea.io/token/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870); [Phantom](https://phantom.com/tokens/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870); [Bitget Wallet](https://web3.bitget.com/en/swap/robinhood/0x56910D4409F3a0C78C64DD8D0545FF0705389870). Listado en [CoinMarketCap](https://coinmarketcap.com/currencies/the-index-finance/).
- Cuenta en X: [@TheIndexFi](https://x.com/theindexfi), creada en julio de 2026 (vía resumen).
- Mecanismo — [OpenSea](https://opensea.io/token/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870) / [Phantom](https://phantom.com/tokens/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870) (vía resumen):
  - cada trade de INDEX paga un 3% de fee en ETH;
  - con esa fee se compra una **canasta de 18 stock tokens** en Robinhood Chain;
  - las acciones se envían automáticamente a las wallets de los holders **cada 15 minutos**, sin claim ni staking.
- Otras descripciones:
  - "Trading fees buy tokenized NVDA and AAPL and stream them to holders" — [Rates.my](https://rates.my/insights/robinhood-chain-fomo-pons-index-cashcat-2026);
  - CoinGape habla de fees "across the chain" agrupadas para comprar NVDA, GOOG y AAPL. Parece una imprecisión: lo más probable es que se refiera a las fees del propio token — [CoinGape](https://coingape.com/robinhood-chains-index-150-rally-turns-trading-fees-into-real-stock-rewards/);
  - se presenta como "equity-backed yield" en lugar de rewards inflacionarios — [CoinGape](https://coingape.com/robinhood-chains-index-150-rally-turns-trading-fees-into-real-stock-rewards/).
- Market cap: +150% en 24h hasta más de US$18M en julio de 2026, impulsado por comentarios de Vlad Tenev invitando a los desarrolladores a integrar stock tokens y RWA — [Coin Bureau en X](https://x.com/coinbureau/status/2077619235262742886); [CoinGape](https://coingape.com/robinhood-chains-index-150-rally-turns-trading-fees-into-real-stock-rewards/). Otra versión: +157% hasta más de US$16M — [Cryip](https://cryip.co/robinhood-chain-index-token-jumps-157-percent-market-cap-16-million/).
- Datos de mercado sin fecha:
  - precio de US$0,03733 y volumen 24h de US$3,1M — [OpenSea](https://opensea.io/token/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870) (vía resumen);
  - volumen 24h de ~US$11,97M y liquidez on-chain de ~US$3,20M — [Phantom](https://phantom.com/tokens/robinhood/0x56910d4409f3a0c78c64dd8d0545ff0705389870) (vía resumen).
- No verificados: launchpad, fecha exacta de lanzamiento, equipo (no encontré doxx), auditoría, supply y MC actual.

**#2 — PONS (Pons / pons.family)** (tech coin: token de un launchpad con buyback-and-burn)
- Qué es — [Decrypt](https://decrypt.co/377349/pons-robinhood-chain-meme-coin-token-factory); [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/pons-robinhood-chain-meme-coin-204604745.html):
  - un "vending machine" de tokens: se elige nombre, ticker e imagen y se despliega un token de supply fijo de 1.000M directo a un pool, sin código, sin asignación al equipo y sin espera;
  - Pons nunca toca los fondos del usuario: cada lanzamiento y cada trade se hacen desde la wallet del creador;
  - funciona solo en Robinhood Chain.
- Contratos — [Datawallet](https://www.datawallet.com/crypto/pons-explained) (vía resumen); repositorio en [GitHub ponsdotdev/pons-labs](https://github.com/ponsdotdev/pons-labs):
  - V1: factory CREATE2 que mintea ERC-20 de supply fijo y abre posiciones en Uniswap V3;
  - V2: bonding curve que se gradúa a un pool bloqueado de Uniswap V4.
- Flujo de fees — [CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/pons/what-is/); [AirdropAlert](https://airdropalert.com/blogs/what-is-pons-token/) (vía resumen):
  - una fee de trading del 1% financia un buyback-and-burn automático de PONS;
  - al 11-ago se había quemado el 27% del supply total;
  - plan tras V2 (todavía **plan**, no ejecutado): recompensas en acciones para holders y rutas de trading agéntico en perps y spot.
- Tracción — [CoinDesk 3-sep](https://www.coindesk.com/tech/2026/09/03/a-memecoin-making-app-becomes-crypto-s-top-fee-generators-as-robinhood-chain-activity-explodes); [AirdropAlert launchpads](https://airdropalert.com/blogs/robinhood-launchpads/) (vía resumen); [KuCoin blog](https://www.kucoin.com/blog/pons-500m-market-cap-robinhood-chain-token-burn):
  - ~US$5,95M en fees en 24h el 3-sep (#4 en DefiLlama);
  - ~646.000 tokens creados por más de 167.000 direcciones desde julio;
  - más de US$4,5B de volumen acumulado en menos de dos meses;
  - "genera casi US$1M diario" para el token.
- Market cap:
  - mínimo de ~US$0,0033 el 17-jul — [Decrypt](https://decrypt.co/377349/pons-robinhood-chain-meme-coin-token-factory);
  - de US$20M a más de US$200M a lo largo de agosto — [CoinMarketCap AI](https://coinmarketcap.com/cmc-ai/pons/latest-updates/) (vía resumen);
  - US$0,5978 y más de US$430M el 3-sep (+31,82% en 24h), ~+18.000% desde julio — [Decrypt](https://decrypt.co/377349/pons-robinhood-chain-meme-coin-token-factory);
  - US$500M — [KuCoin blog](https://www.kucoin.com/blog/pons-500m-market-cap-robinhood-chain-token-burn).
- Equipo: fundador seudónimo — [Datawallet](https://www.datawallet.com/crypto/pons-explained) / [AirdropAlert](https://airdropalert.com/blogs/what-is-pons-token/) (vía resumen). Uniswap Labs compró PONS — [crypto.news](https://crypto.news/uniswap-labs-buys-pons-as-robinhood-chain-launchpad-fees-surge/) (título).
- Hay datos para indexar Pons en tiempo real: la [API de Bitquery para Robinhood Chain](https://docs.bitquery.io/docs/blockchain/robinhood/) incluye trades, el launchpad Pons y streams.
- Red flags:
  - Decrypt describe los tokens lanzados en Pons como monedas construidas "around a joke or internet trend rather than any real product" — [Decrypt](https://decrypt.co/377349/pons-robinhood-chain-meme-coin-token-factory);
  - la actividad depende del frenesí: las fees de la red cayeron un 97% a mediados de septiembre — [CoinDesk 19-sep](https://www.coindesk.com/business/2026/09/19/robinhood-chain-fees-collapse-97-even-as-transactions-stay-near-record-highs);
  - una wallet convirtió US$220K en US$4,7M con CASHCAT y PONS, lo que sugiere ganancias concentradas — [Bitcoin.com](https://news.bitcoin.com/crypto-news/wallet-cashcat-pons-robinhood-chain-4-7-million-profit/) (título).

**#3 — MONITOR** (**MEME** emparejado con acciones; no es tech coin)
- Se emitió en long.xyz y cotiza contra el stock token de Palantir — [KuCoin](https://www.kucoin.com/news/flash/palantir-co-founder-joins-meme-coin-monitor-price-surges-600); [Startup Fortune](https://startupfortune.com/joe-lonsdale-backs-robinhood-meme-coin-tied-to-palantir-stock-it-jumps-600/).
- El 23-sep (UTC+8), Joe Lonsdale, cofundador de Palantir, se sumó y siguió la cuenta. El volumen subió a US$4,1M y el precio +600% — [KuCoin](https://www.kucoin.com/news/flash/palantir-co-founder-joins-meme-coin-monitor-price-surges-600). Marc Andreessen también mostró interés — [KuCoin](https://www.kucoin.com/news/flash/palantir-co-founder-joins-a16z-s-marc-andreessen-in-backing-meme-coin-monitor-price-surges-6x). Según la instantánea, la subida en 24h fue de entre +600% y +1.070% — [Startup Fortune](https://startupfortune.com/joe-lonsdale-backs-robinhood-meme-coin-tied-to-palantir-stock-it-jumps-600/).
- MC por encima de US$13M tras +1.070% en 24h — [KuCoin](https://www.kucoin.com/news/flash/the-market-capitalization-of-robinhood-chain-coin-stock-meme-coin-monitor-has-surpassed-13-million-with-a-24-hour-increase-of-1070).
- No verificados: contrato, fecha de lanzamiento y equipo.

**Menciones (fuera del top 3)**
- **STANDARD (The Standard Reserve)** (tech/DeFi, por encima de la banda) — [KuCoin](https://www.kucoin.com/news/flash/the-standard-reserve-to-launch-on-september-14-positioning-as-olympus-dao-alternative); [Gate](https://www.gate.com/news/detail/the-standard-reserve-launches-on-robinhood-chain-on-september-14-with-1b-24184799); [Crypto Briefing](https://cryptobriefing.com/standard-reserve-robinhood-chain-liquidity-engine/); [OpenSea](https://opensea.io/token/robinhood/0x88ad8ddf1e3898412146a534538d418c6f8a9062); [0xSammy](https://www.0xsammy.com/p/theyve-built-a-reserve-bank-on-robinhood):
  - un "banco central on-chain" planteado como alternativa a Olympus DAO; el desarrollador es 0xBeans y se lanzó el 14-sep;
  - hard cap de 1.000M, con 100M minteados al inicio como liquidez;
  - si entra ETH neto al pool de Uniswap v4 sube la emisión; si sale, la reduce y recompra y quema tokens con el revenue;
  - planea usar ~US$14M de reservas para sembrar pools de stock tokens;
  - contrato, visto en la URL de OpenSea: `0x88ad8ddf1e3898412146a534538d418c6f8a9062`.
- **NET (NetNet Capital)** (tech/DeFi, fork conceptual de OHM, por encima de la banda): ATH por encima de US$117M — [KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-ecosystem-tokens-pons-ai-and-net-hit-new-highs).
- **CRUMBS** (pagos → stock tokens; por debajo de la banda) — [CoinGape](https://coingape.com/block-of-fame/pulse/crumbs-robinhood-chain-backed-startup-pushes-stock-tokenization-into-shopping-rewards/); [Foreign Policy Journal, 12-sep-2026](https://www.foreignpolicyjournal.com/2026/09/12/crumbs-startup-on-robinhood-chain-turns-shopping-receipts-into-tokenized-stock-rewards-for-nasdaq-cost-nasdaq-aapl-and-more/); [Blockscout](https://robinhoodchain.blockscout.com/token/0x80bAa4b3bfAC6f4978700dF824B1B3d98e889136); [frontrun.vc](https://www.frontrun.vc/c/crumbsfamily/):
  - convierte recibos de compras en hasta un 5% de recompensa en stock tokens (comprar en Costco da COST, en Apple AAPL, en Netflix NFLX);
  - la plataforma y el token están live en la cadena;
  - cuenta en X: @crumbsfamily; frontrun.vc la clasifica como "payments startup";
  - contrato: `0x80baa4b3bfac6f4978700df824b1b3d98e889136`;
  - MC de ~US$52–75K — [CMC](https://coinmarketcap.com/currencies/crumbs/); [MEXC](https://www.mexc.com/price/crumbs);
  - ojo con los homónimos: hay tokens "CRUMBS" en Solana — [Solana Compass](https://solanacompass.com/tokens/14TXbmxrgpVeDLB3ZbV6shJuiYtPbzWDz4ipLgysp42i); [Phantom](https://phantom.com/tokens/solana/BpzvZe2MREqJyN22UJetX5mfU1yMJ1hRb2NiCYYipump) — y un "CRUMBSFAMILY" con un solo holder en Robinhood Chain — [Blockscout](https://robinhoodchain.blockscout.com/token/0xc1a0668d306c83eed032931e418486bc197f1dba).
- **Nock Finance (NOCK)** (IA; MC no verificado) — [CoinMarketCap](https://coinmarketcap.com/currencies/nock-finance/); [nockfi.io](https://www.nockfi.io/); [nockagent.xyz](https://nockagent.xyz/):
  - protocolo de ejecución de *intents* con agentes de IA en la cadena: un agente de yield (lending y LP), uno de swap que enruta por todos los DEX, y otro que gestiona posiciones de equity tokenizado, incluso como colateral;
  - no custodial: el usuario aprueba las acciones que proponen los agentes;
  - $NOCK desbloquea capacidades avanzadas;
  - precio de US$0,000007 y volumen de US$138/día, así que es ilíquido;
  - no confundir con Nockchain, una L1 ZK-PoW de ~US$66–70M ([CoinGecko](https://www.coingecko.com/en/coins/nockchain)), ni con NockTerminal/NockBot ([NockTerminal](https://nockterminal.com/)).
- **Agentes de Virtuals en Robinhood Chain** (GTR y PRIZE): GTR habría llegado a Robinhood vía Virtuals como "multi-asset trading platform" — vía resumen, [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-200m-robinhood-chain/). MC no verificado.
- **FLock FOMO (Model Tokens)** (IA; MC no verificado) — [FLock blog](https://www.flock.io/blog/flock-open-model-offering-fomo-step-by-step-guide); [fomo.flock.io](https://fomo.flock.io/); [FLock en X](https://x.com/flock_io/status/2095807028023468536):
  - cada despliegue de modelo tiene su propio Model Token (MT), y $FLOCK refleja la demanda agregada;
  - un modelo solo se gradúa y se tokeniza si alcanza su umbral de financiación, con el principio de que "value only flows when real usage happens";
  - está live en Robinhood Chain.

### Inferences
- Por el ID del post de FLock (snowflake de X), FLock FOMO llegó a Robinhood Chain hacia el 3–4 de septiembre de 2026. Esto es una inferencia.
- INDEX es el caso más limpio de "tech coin en banda": tiene una mecánica concreta (fee → canasta de 18 acciones → distribución cada 15 min), estuvo en ~US$6–7M antes de su rally de julio y encaja directamente con Tricker.
- El recorrido de PONS muestra que en esta cadena el "token de infraestructura" (launchpad con buyback-burn) capturó mucho más valor que los tokens de producto de nicho.
- Nock Finance y CRUMBS se parecen mucho a Payence y Nomia en concepto, pero con tokens casi sin liquidez. En este ecosistema, la narrativa "agentes o pagos" por sí sola no generó MC.

### Gaps
- De INDEX faltan supply, equipo, auditoría, launchpad y MC actual.
- De MONITOR, LIGER, GTR y PRIZE no tengo contratos.
- No pude revisar el código de INDEX para comprobar que la distribución cada 15 min ocurre on-chain como se anuncia; la afirmación viene de su propia descripción en marketplaces.
- De ninguno de los tokens encontré métricas de holders ni de retención.

## 4. ¿Debería el usuario (2555raw/launch: Payence, Nomia, Tricker, Tricker Terminal) tomar inspiración de estos tokens?

### Takeaway
- **INDEX: sí**, como referencia para Tricker: bags de acciones y cripto con distribución automática y prueba on-chain.
- **PONS, Noxa y Pools.trade: sí**, para patrones de *launch site*: lanzamiento en una transacción, LP bloqueado, reglas anti-snipe, métricas públicas y burns visibles.
- **MONITOR: no** como producto, solo como lección de narrativa (emparejar con acciones reales, influencers).
- **Payence y Nomia**: la inspiración útil no es un token en banda, sino la infraestructura agéntica de la cadena (Agentic Trading vía MCP, Virtuals, Nock) y el caso CRUMBS, que es también una advertencia porque no tiene tracción de token.

### Cited Findings
- Patrones anti-snipe y de LP:
  - Noxa: solo el creador compra en el bloque de lanzamiento, compras limitadas durante la primera hora y LP bloqueado para siempre — [Noxa docs](https://fun.noxa.fi/docs);
  - Pools.trade: modo "crowd launch" contra el bundling — [crypto.news](https://crypto.news/uniswap-launches-first-robinhood-chain-launchpad/).
- Métricas públicas que la prensa amplifica (fees, tokens por día, creadores únicos, % quemado): [CoinDesk 3-sep](https://www.coindesk.com/tech/2026/09/03/a-memecoin-making-app-becomes-crypto-s-top-fee-generators-as-robinhood-chain-activity-explodes); [KuCoin blog](https://www.kucoin.com/blog/pons-500m-market-cap-robinhood-chain-token-burn).
- El riesgo de continuidad de un launchpad: Noxa cerró tras cobrar ~US$12M — [CoinDesk 15-jul](https://www.coindesk.com/business/2026/07/15/the-launchpad-that-fueled-robinhood-chain-s-memecoin-boom-just-gave-away-all-its-revenue).
- Distribución: Pools.trade entra desde el día 1 en Fomo, GMGN, Bitget y OKX Wallet — [crypto.news](https://crypto.news/uniswap-launches-first-robinhood-chain-launchpad/). fomo tiene más de 500K traders — [Bitcoin.com](https://news.bitcoin.com/finance/fomo-trading-app-top-5-us-finance-charts/).
- Ideas de datos para Tricker Terminal:
  - un bot de Telegram open-source vigila cada trade DEX de la chain 4663, aprende el volumen normal por minuto de cada token y avisa cuando se multiplica, con precio, MC, liquidez y holders — [GitHub robinhood-volume-alerts](https://github.com/nirholas/robinhood-volume-alerts);
  - la API de Bitquery tiene trades, Pons y streams en tiempo real — [Bitquery](https://docs.bitquery.io/docs/blockchain/robinhood/);
  - comparativa de 10 screeners de Robinhood Chain — [NockTerminal](https://nockterminal.com/best/robinhood-chain-token-screeners).
- Los stock tokens como quote assets o colateral: Long.xyz (NVDA, AAPL, MSFT, GOOGL, TSLA, MU, SPCX) — [MEXC Learn](https://www.mexc.com/learn/article/what-is-long-xyz-how-stock-paired-memecoins-are-reshaping-robinhood-chain/1); el 23% del NVDA tokenizado está en el pool de AI — [KuCoin](https://www.kucoin.com/news/flash/23-of-tokenized-nvidia-stock-locked-in-meme-coin-ai-on-robinhood-chain) (título).
- Agentes en la cadena:
  - Robinhood Agentic Trading (MCP) — [Genfinity](https://genfinity.io/2026/07/21/robinhood-agentic-trading-crypto-ai-agents/);
  - Virtuals: más de 5.600 agentes y ~US$200M — [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-200m-robinhood-chain/);
  - agentes no custodiales de Nock con aprobación del usuario — [CoinMarketCap](https://coinmarketcap.com/currencies/nock-finance/);
  - "AI Agent Wallets Are the Next Infrastructure Layer on Robinhood Chain" — [Substack](https://casatrick.substack.com/p/ai-agent-wallet-robinhood-chain) (solo título).
- CRUMBS (pagos → recompensas en stock tokens) tiene un MC de ~US$52–75K — [CMC](https://coinmarketcap.com/currencies/crumbs/).

### Inferences
- **Tricker (bags de 3–5 activos) ← INDEX**:
  - *Copiar*:
    - explicar el producto en una frase ("cada trade compra acciones y te las manda");
    - mostrar la canasta con sus componentes y pesos;
    - poner un contador en vivo de acciones distribuidas y la cadencia ("cada 15 min");
    - enlazar a Blockscout las transacciones de compra y distribución como prueba;
    - que no haga falta claim ni staking.
  - *Evitar*:
    - un impuesto del 3% por trade, que es fricción y ahuyenta a los market makers;
    - vender "equity-backed yield" como rendimiento: además del riesgo regulatorio de que se considere un valor, hay que revisar las restricciones de elegibilidad de los stock tokens, que no verifiqué aquí;
    - un equipo anónimo sin auditoría;
    - depender de pools de stock tokens poco líquidos.
  - *Oportunidad*: un bag de Tricker podría usar stock tokens de Robinhood Chain como componentes, y la vista de "posición única" es justo lo que INDEX no ofrece (INDEX reparte muchas acciones pequeñas).
- **Launch sites (en general) ← PONS / Noxa / Pools.trade**:
  - *Copiar*:
    - lanzamiento en una transacción con LP bloqueado;
    - reglas anti-snipe visibles en la landing;
    - dashboard público de fees, % quemado y tokens lanzados;
    - contratos open-source (GitHub de Pons);
    - integración con los venues de distribución (fomo, GMGN, Uniswap).
  - *Evitar*:
    - depender solo del frenesí de memecoins (las fees de la red cayeron un 97%);
    - fundadores anónimos sin plan de continuidad (el cierre de Noxa);
    - emisión masiva que atrae bots (Long.xyz habla de hasta 100K tokens al día).
- **MONITOR (meme)**: la lección es que emparejar con una acción real y conocida (PLTR) crea narrativa inmediata, y que un seguimiento de una figura del sector (Lonsdale) puede multiplicar por 6–11 el precio. **No** conviene imitarlo como producto: no hay tecnología detrás.
- **Payence / Nomia**: la cadena ya tiene agentes que operan (Virtuals, Nock) y un canal de agentes regulado (Robinhood Agentic Trading vía MCP). Posicionar Payence y Nomia como "la capa de pagos y políticas de gasto para agentes que operan en Robinhood Chain" encaja con la narrativa. Las políticas de gasto y las aprobaciones de Nock se parecen a los spend policies de Payence. Aun así, CRUMBS y NOCK muestran que un token de "pagos o agentes" sin distribución ni liquidez no llega a la banda. La inspiración está en el producto y la narrativa, no en su tokenomics.
- **Tricker Terminal**: añadir cobertura de la chain 4663 con alertas de volumen anómalo, métricas de launchpads, flujos de stock tokens hacia pools de memes y la vista combinada "stock tokens + memecoins" que fomo ya populariza.

### Gaps
- No hay datos de retención ni de ingresos sostenibles por token que permitan juzgar si estos modelos aguantan fuera del frenesí.
- No verifiqué el marco regulatorio de los stock tokens (quién puede tenerlos y desde qué país).

## 5. Alternativas fuera de Robinhood Chain (etiquetadas) y tamaño del ecosistema

### Takeaway
El ecosistema no es demasiado pequeño y hay tokens en banda dentro de Robinhood Chain, así que las alternativas son opcionales. Las más relevantes fuera de la cadena (**NO están en Robinhood Chain**) quedan todas por encima de la banda: STONK (StonkFun, Solana, ~US$140M), VIRTUAL (~US$421M) y FLOCK (FLock.io).

### Cited Findings
- **STONK (StonkFun)**, **en Solana, no en Robinhood Chain** — [The Block, 6-sep-2026](https://www.theblock.co/news/defi/2026-09-06-stonk-surges-250-to-140-million-market-cap-as-stock-paired-solana-launchpad-stonkfun-pulls-volume-to-raydium-and-jupiter-413621); [AirdropAlert](https://airdropalert.com/blogs/what-is-stonkfun/):
  - launchpad de tokens emparejados con acciones y ETFs tokenizados;
  - el 6-sep-2026 subió +250% hasta ~US$140M de MC tras integrarse con Raydium LaunchLab;
  - el propio STONK está emparejado con SPYx (Backed).
- **VIRTUAL** (Virtuals Protocol, fuera de Robinhood Chain): ~US$421,19M de MC a US$0,6405 — [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-200m-robinhood-chain/) (vía resumen). Subió un 5,87% con el lanzamiento de Robinhood Chain — [CoinMarketCap](https://coinmarketcap.com/top-stories/6a57e815ffa05f4bda2cfb1e/) (título).
- **FLOCK** (FLock.io; la URL de Coinbase indica que está en Base): precio de US$0,08239 (fecha no indicada) — [Coinbase](https://www.coinbase.com/price/base-flock); [CoinGecko](https://www.coingecko.com/en/coins/flock-2) (vía resumen).
- Categorías de CoinGecko para seguir el ecosistema: [Robinhood Ecosystem](https://www.coingecko.com/en/categories/robinhood-ecosystem); [Robinhood Chain Stocks Ecosystem](https://www.coingecko.com/en/categories/robinhood-chain-stocks-ecosystem).

### Inferences
- El modelo "stock-paired launchpad" se está copiando entre cadenas (Long.xyz en Robinhood Chain, StonkFun en Solana). Es una narrativa trasladable a los productos del usuario, sobre todo Tricker.
- Ninguna de estas alternativas cae dentro de la banda; sirven como referencias de narrativa y de producto, no como comparables de MC.

### Gaps
- No se buscaron sistemáticamente tokens de la narrativa Robinhood Chain o stock tokens en Base o Ethereum que estén en la banda, porque se agotó el presupuesto de búsquedas.
- No tengo MC de FLOCK ni fechas de algunos precios.
