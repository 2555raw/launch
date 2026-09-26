# Ethereum mainnet (L1): "tech coins" que tocaron un market cap de US$700K–10M (2025–2026)

## 1. Ranking de candidatos: identidad, venue, fecha y market cap tocado (pico / actual / estado)

### Takeaway
En Ethereum L1, el meta small-cap "tech" mejor documentado y verificable dentro de la banda fue el de los **strategy tokens de TokenWorks (NFTStrategy)**. Son ERC-20 cuyo hook de Uniswap v4 convierte cada trade en compras de NFTs y en buyback-and-burn. Ranking: **#1 ToadzStrategy (TOADSTR)**, **#2 VibeStrategy (VIBESTR)**, **#3 MeebitStrategy (MEEBSTR)**, **#4 ChimpStrategy (CHMPSTR)**.

- Los cuatro tocaron la banda entre sept. y oct. de 2025.
- TOADSTR y MEEBSTR colapsaron luego a ~US$0,2–0,3M.
- VIBESTR y CHMPSTR seguían en ~US$2,6–2,7M en un snapshot posterior sin fecha.

No encontré tokens de AI-agents, x402, privacidad o bots de Telegram en L1 con un MC verificable dentro de la banda. **Nota de método:** WebFetch y curl estaban bloqueados y el presupuesto de WebSearch de la sesión (200) se agotó. Todas las cifras salen de snippets/resúmenes de búsqueda y de archivos públicos de GitHub; ninguna se pudo comprobar en vivo en DexScreener, GeckoTerminal o CoinGecko.

**Procedencia a revisar.** Todo lo citado con links a `github.com` se obtuvo con la búsqueda de código del GitHub MCP sobre repos fuera de 2555raw/launch. Esto pasó antes de recibir la regla del coordinador que lo prohíbe. Incluye:
- el registro `Uniswap/hooklist`: mecánica de los hooks, conteo de 41 hooks "Strategy" y hooks "AI", honeypot y CCA;
- los mirrors de CoinGecko en `tuanhoang95/currency-crawler`: fechas de lanzamiento, snapshots de TOADSTR/VIBESTR/CHMPSTR y los contratos de esos tres;
- `Xellar-Protocol/xellar-assets`: contratos y MC actuales del cohort;
- `rfrm-dao/Top500CG`: volumen de ~US$70/día.

Si el coordinador decide descartar esos datos, lo que queda con fuente web es:
- TOADSTR US$3,7M y APESTR US$8,3M ([The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap));
- los ATH de TOADSTR y MEEBSTR (CoinGecko/CryptoRank/MEXC/Coinbase/3Commas);
- los MC actuales de TOADSTR, MEEBSTR y SQUIGSTR en la categoría de CoinGecko;
- la mecánica descrita por Bankless, Bitrue y Onchainatlas;
- IMF y x402, con sus respectivas fuentes.

En ese caso, VIBESTR y CHMPSTR quedarían **sin verificar** y el ranking se reduciría a TOADSTR y MEEBSTR.

### Cited Findings

**Contexto del meta (necesario para entender a los 4 candidatos)**
- TokenWorks lanzó PunkStrategy (PNKSTR) en septiembre de 2025: un protocolo automatizado exclusivo para CryptoPunks. NFTStrategy es la versión generalizada, que extiende la mecánica a cualquier colección ERC-721 ("programmable buy pressure") — [DappRadar](https://dappradar.com/blog/ultimate-guide-to-nft-strategy-tokens-punkstrategy-and-top-alternatives-for-2025); [MEXC – What is ToadzStrategy](https://www.mexc.com/price/toadzstrategy/info); [OKX Learn](https://www.okx.com/en-us/learn/pnkstr-token-dollar-nft-economy)
- En el pico inicial el ecosistema NFTStrategy sumaba US$202M de MC y US$10,7M de volumen diario. Detalle: PNKSTR US$152M (+37% 24h), PUDGYSTR US$11,25M (+45%), APESTR US$8,3M (+29%) y TOADSTR US$3,7M (+20%). Los ocho tokens NFTStrategy se listaron en OpenSea el 30-sep-2025, así que el artículo es de ~30-sep/1-oct-2025 (fecha exacta no verificada) — [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap); [crypto.news](https://crypto.news/all-nft-strategy-tokens-go-live-on-opensea/); [Bitget News](https://www.bitget.com/news/detail/12560604994513)
- PNKSTR (US$152M) queda muy por encima de la banda, y PUDGYSTR (US$11,25M) también la supera — [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap)

**#1 ToadzStrategy (TOADSTR): strategy token de la colección CrypToadz**
- Datos del token:
  - Contrato en Ethereum: `0x92cedfdbce6e87b595e4a529afa2905480368af4`, 18 decimales.
  - Homepage: `https://www.nftstrategy.fun/strategies/0x92cedfdbce6e87b595e4a529afa2905480368af4`.
  - Único mercado listado: "Uniswap V4 (Ethereum)", par contra ETH nativo.
  - Categorías en CoinGecko: NFT, NFTFi y NFTStrategy Ecosystem.
  - Fuentes: [mirror GitHub de CoinGecko, snapshot 2025-09-28](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/toadzstrategy.json); [Xellar assets](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/toadzstrategy_ethereum/info.json)
- Lanzamiento: ~27-sep-2025. Proxy: el ATL quedó registrado el 2025-09-27 a las 15:05 UTC y el logo se subió a CoinGecko con timestamp 1758982583, que corresponde al 27-sep-2025 a las 14:16 UTC — [mirror CoinGecko](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/toadzstrategy.json)
- Snapshot del 28-sep-2025 a las 03:10 UTC — [mirror CoinGecko](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/toadzstrategy.json):
  - MC: US$1.807.844.
  - Volumen 24h: US$3.854.063.
  - Supply: 991.743.305 (máximo 1.000.000.000).
  - ATH hasta ese momento: US$0,00236668.
  - CoinGecko marcaba el ticker como `is_anomaly: true`.
- ~30-sep/1-oct-2025: MC de US$3,7M — [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap)
- ATH, con discrepancia entre trackers: US$0,00455 el 2-oct-2025 según una fuente y US$0,00603 el 5-oct-2025 según otra — [CoinGecko](https://www.coingecko.com/en/coins/toadzstrategy); [CryptoRank](https://cryptorank.io/price/toadzstrategy); [MEXC](https://www.mexc.com/price/toadzstrategy/info)
- Estado posterior (snapshots sin fecha):
  - MC de US$213,11K a un precio de US$0,00022933 — [CoinGecko NFTStrategy category](https://www.coingecko.com/en/categories/nftstrategy-ecosystem)
  - MC de US$227.842 — [Xellar](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/toadzstrategy_ethereum/info.json)
  - MC de US$215.935 con **volumen 24h de US$73,63**; en la misma lista, SquiggleStrategy marca US$215.670 de MC y US$68,26 de volumen — [rfrm-dao CoinGeckoTop5000.csv](https://github.com/rfrm-dao/Top500CG/blob/69a04e54509cd8ee2b823cd72eb5b4a529162b2b/CoinGeckoTop5000.csv)

**#2 VibeStrategy (VIBESTR)**
- Datos del token:
  - Contrato: `0xd0cc2b0efb168bfe1f94a948d8df70fa10257196`.
  - Cuenta de X vinculada en CoinGecko: `token_works` (TokenWorks).
  - Homepage: `nftstrategy.fun/strategies/0xd0cc…7196`.
  - Categorías: "NFTStrategy Ecosystem" y "NFT Strategy Flywheel".
  - Mercado: Uniswap V4 (Ethereum), con trust score "green".
  - Fuente: [mirror CoinGecko, snapshot 2025-10-10](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/vibestrategy.json)
- Lanzamiento: ~9-oct-2025. Proxy: ATL el 2025-10-09 a las 18:09 UTC y logo subido con timestamp 1760032757, que es el 9-oct-2025 a las ~17:59 UTC — [mirror CoinGecko](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/vibestrategy.json)
- Snapshot del 10-oct-2025 a las 03:05 UTC — [mirror CoinGecko](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/vibestrategy.json):
  - **MC: US$7.813.102.**
  - Volumen 24h: US$8.431.196.
  - ATH hasta ese momento: US$0,00812257, el 2025-10-10 a las 02:37 UTC.
  - Supply: 996.975.340.
- Snapshot posterior sin fecha: **MC de US$2.595.026** — [Xellar](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/vibestrategy_ethereum/info.json)

**#3 MeebitStrategy (MEEBSTR): strategy token de Meebits**
- Contrato: `0xc9b2c00f31b210fcea1242d91307a5b1e3b2be68`. Homepage: `nftstrategy.fun/strategies/0xc9b2…be68` — [Xellar](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/meebitstrategy_ethereum/info.json)
- ATH, con discrepancia: US$0,0056 el 2-oct-2025 según Coinbase y US$0,007406 el 4-oct-2025 según 3Commas y MEXC — [Coinbase](https://www.coinbase.com/price/meebitstrategy); [3Commas](https://3commas.io/coin-price-chart/meebitstrategy); [MEXC](https://www.mexc.com/price/meebitstrategy/info)
- Estado posterior (sin fecha):
  - MC de US$255,96K a un precio de US$0,00027745 — [CoinGecko NFTStrategy category](https://www.coingecko.com/en/categories/nftstrategy-ecosystem)
  - MC de US$265.763 — [Xellar](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/meebitstrategy_ethereum/info.json)
  - Precio de US$0,0005373 — [CoinStats](https://coinstats.app/coins/meebitstrategy/)

**#4 ChimpStrategy (CHMPSTR)**
- Contrato: `0x3ca20831ebea5c99aa6e574d83f0a7c733f7e4d0`. Homepage: `nftstrategy.fun/strategies/0x3ca2…e4d0`. Mercado: Uniswap V4 (Ethereum) — [mirror CoinGecko, snapshot 2025-10-19](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/chimpstrategy.json)
- Lanzamiento: ~18-oct-2025. Proxy: ATL el 2025-10-18 a las 09:20 UTC y logo con timestamp 1760778945, que es el 18-oct-2025 a las ~09:15 UTC.
- Snapshot del 19-oct-2025 a las 03:14 UTC: **MC de US$2.458.839**, volumen 24h de US$568.855, ATH hasta ese momento de US$0,00274265 y supply de 978.813.908 — [mirror CoinGecko](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/chimpstrategy.json)
- Snapshot posterior sin fecha: **MC de US$2.740.932** — [Xellar](https://github.com/Xellar-Protocol/xellar-assets/blob/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets/chimpstrategy_ethereum/info.json)

**Resto del cohort NFTStrategy (contrato y MC en un snapshot de Xellar sin fecha)** — [Xellar-Protocol/xellar-assets, carpeta assets/*_ethereum](https://github.com/Xellar-Protocol/xellar-assets/tree/0ca3b38b705c4a9f88d5505f4eacf22c0470e60a/assets)

| Token | Ticker | Contrato | MC (Xellar, sin fecha) | Notas |
|---|---|---|---|---|
| ApeStrategy | APESTR | `0x9ebf91b8d6ff68aa05545301a3d0984eaee54a03` | US$952.661 | Tocó US$8,3M ~1-oct-2025 según [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap); ATH no verificado, podría superar los US$10M |
| PudgyStrategy | PUDGYSTR | `0xb3d6e9e142a785ea8a4f0050fee73bcc3438c5c5` | US$1.215.668 | US$11,25M en su pico, sobre la banda |
| PainStrategy (XCOPY Max Pain) | PAINSTR | `0xdfc3af477979912ec90b138d3e5552d5304c5663` | US$369.422 | "La más nueva" de TokenWorks al 7-oct-2025 según [Bankless](https://www.bankless.com/read/remixing-the-nftstrategy-playbook) |
| BirbStrategy (Moonbirds) | BIRBSTR | `0x6bcba7cd81a5f12c10ca1bf9b36761cc382658e8` | US$344.529 | Volumen 24h de US$202,31 según [CoinGecko](https://www.coingecko.com/en/coins/birbstrategy) (sin fecha) |
| Nakamigo | MEEGSTR | `0x72e36d22717e7bd70ac1a148f578b78e05dace73` | US$306.300 | |
| NakamotoStrategy | NAKASTR | `0xd3d3f901b2d9c587988333f00b154d57fce9dd07` | US$294.025 | |
| OtherdeedStrategy | DEEDSTR | `0xe8cbeccf2140238c5358e60c69203303f3a91732` | US$292.975 | |
| DickStrategy | DICKSTR | `0x8680acfacb3fed5408764343fc7e8358e8c85a4c` | US$261.396 | |
| CheckStrategy | CHKSTR | `0x2090dc81f42f6ddd8deace0d3c3339017417b0dc` | US$249.580 | |
| SquiggleStrategy | SQUIGSTR | `0x742fd09cbbeb1ec4e3d6404dfc959a324deb50e6` | US$206.379 | |
| RektStrategy | REKTSTR | `0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e` | US$202.410 | |
| GobStrategy | GOBSTR | `0x5d855d8a3090243fed9bf73999eedfbc2d1dcf21` | US$189.936 | |
| GLHFStrategy | GLHFSTR | `0xae52e336f1cc779c2e647b82994e4d29ed4e0286` | US$158.908 | |
| Fwogs Strategy | FWOGSTR | `0xa27a2c21a9d468634107b38d9fffb42ad09b204f` | US$89.511 | |

**Descartados o no verificados como in-band**
- El "x402" ERC-20 en mainnet (`0x6921e6f029B5859FE3f95556E65911ACAA8684a3`) tiene supply de 1B, 10 transacciones y 3 holders, así que no es candidato. x402 es un protocolo de Coinbase (mayo-2025) sin token oficial, y las guías advierten que los tokens "x402" probablemente son scams — [Ethplorer](https://ethplorer.io/address/0x6921e6f029b5859fe3f95556e65911acaa8684a3); [Trust Wallet](https://trustwallet.com/blog/cryptocurrency/what-is-x402-and-ping); [Ledger](https://www.ledger.com/academy/topics/economics-and-regulation/what-is-x402)
- International Meme Fund (IMF): MC de US$314.033, rank #3634 y volumen 24h de US$38,31 en el par IMF/WETH de Uniswap V3 (CoinGecko, sin fecha) — [CoinGecko](https://www.coingecko.com/en/coins/international-meme-fund). Hay dos contratos distintos según la fuente, `0x05be1d4c307c19450a6fd7ce7307ce72a3829a60` ([OpenSea](https://opensea.io/token/ethereum/0x05be1d4c307c19450a6fd7ce7307ce72a3829a60)) y `0x86218A5E151f04Fc175e5f781A2C7C6c8d0797d0` ([Ethplorer](https://ethplorer.io/address/0x86218a5e151f04fc175e5f781a2c7c6c8d0797d0)). No pude verificar cuál es el canónico.

### Inferences
- **MC pico implícito** (cálculo propio: precio ATH × supply ~0,98–1,0B; es FDV = MC porque `market_cap_fdv_ratio` = 1.0 en el mirror):

| Token | MC pico implícito | Base del cálculo |
|---|---|---|
| TOADSTR | ≈ US$4,5M a ≈ US$6,0M | ATH 0,00455 / 0,00603 × 0,99B |
| MEEBSTR | ≈ US$5,6M a US$7,4M | Suponiendo ~1B de supply |
| VIBESTR | ≈ US$8,1M | ATH al 10-oct-2025; no sé si subió más tarde, podría haber pasado los US$10M |
| CHMPSTR | ≈ US$2,7M | Al 19-oct-2025 |

- **Por qué este ranking:**
  - **TOADSTR (#1):** es el caso más completo y el que mejor encaja con el criterio "ATH dentro de la banda". Tiene lanzamiento, run-up, pico de US$4,5–6M y decay de −95%, todo con datos fechados y la mecánica documentada en fuente primaria.
  - **VIBESTR (#2):** muestra el pico in-band más alto (≥US$7,8M) y la mejor retención (~US$2,6M después).
  - **MEEBSTR (#3):** es un caso gemelo de TOADSTR.
  - **CHMPSTR (#4):** muestra que la cohorte tardía (oct-2025) se estabilizó dentro de la banda.
  - Para el informe final, los "mejores 2" serían TOADSTR (ciclo completo) + VIBESTR (retención).
- **Ciclo de la primera ola:** TOADSTR, MEEBSTR, SQUIGSTR y BIRBSTR perdieron ~90–95% desde sus picos. Volúmenes de ~US$70/día implican que el flywheel de fees está prácticamente detenido: sin volumen no hay fees, y sin fees no hay compras ni burns.
- **Limitación de diversidad:** los 4 candidatos son de la misma familia. En L1, lo verificable en esta banda durante 2025–26 se concentró en este meta.

### Gaps
- No se pudo verificar en vivo el MC actual a sept-2026 (WebFetch y curl bloqueados; presupuesto de WebSearch agotado). Tampoco hay fecha para los snapshots de Xellar y de rfrm-dao.
- Las fechas de lanzamiento son proxies (primer ATL o logo en CoinGecko), no el bloque de deploy en Etherscan.
- No identifiqué la colección subyacente de VIBESTR ni verifiqué la de CHMPSTR.
- No verifiqué ATH posteriores a oct-2025 para VIBESTR, CHMPSTR y APESTR.
- No encontré evidencia de rug en ninguno de los 4, pero tampoco pude revisar holders ni liquidez en Etherscan.
- IMF: no verifiqué fecha de lanzamiento ni pico de MC. No se sabe si alguna vez estuvo en la banda.

## 2. Producto y mecánica: cómo funciona y cómo fluye el valor al token

### Takeaway
El "producto" es un loop on-chain: un hook de Uniswap v4 cobra una comisión en cada swap. Arranca en 95–99% para bloquear snipers y decae hasta un piso de 10%. Ese ETH va 80% al contrato "strategy", que compra NFTs floor y los relista a 1,2×; cuando se venden, todo el ETH se usa para recomprar y quemar el token. En la versión NFTStrategy, ~10% de las fees va a buyback-and-burn de PNKSTR y ~10% a una dirección de fees. En diciembre de 2025 TokenStrategy generalizó el modelo a ERC-20, ERC-1155 y a estrategias "recursivas" que son solo auto-burn. Las IndexStrategies (AB500STR) rotan entre colecciones.

### Cited Findings
- **Loop de PunkStrategy ("Yoyo"):** las fees se acumulan, el protocolo compra un Punk floor y lo relista a 1,2× el precio de compra; al venderse, usa todo el ETH para recomprar y quemar PNKSTR. Fee mínima de 10%, repartida 80% al protocolo y 20% al equipo — [Bankless – Beginner's guide](https://www.bankless.com/read/beginners-guide-punkstrategy-pnkstr); [Bitrue](https://www.bitrue.com/blog/what-is-punkstrategy-fun); [Gate](https://www.gate.com/blog/a-beginners-guide-to-punkstrategy-and-pnkstr) (resumen de búsqueda); [Bankless – Remixing (7-oct-2025)](https://www.bankless.com/read/remixing-the-nftstrategy-playbook)
- **NFTStrategyHook**, fuente primaria en el registro oficial de hooks de Uniswap:
  - Comisión de compra que parte en 99% y baja 100 bps cada 5 bloques hasta 10%; venta fija en 10%.
  - Reparto del ETH cobrado: 80% a la colección NFTStrategy, 10% a buy-and-burn de PNKSTR y 10% a una dirección de fees configurable.
  - **Se bloquean los swaps exact-output**, y las operaciones de liquidez quedan restringidas a `NFTStrategyFactory`.
  - Fuentes: [hooklist 0xdadaaa95…2444](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xdadaaa9591d6f4d68748898fbacc99dc69012444.json); variantes con el mismo 80/10/10 en [0xfdfa1dfa…6444](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xfdfa1dfab150fe6b2fdfdd609f37b2459c7b6444.json) y [0x8fb66c6e…6444](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x8fb66c6e0f3cbb25001e0f1c0352cc888cff6444.json) (esta última decae 100 bps por minuto); otra con 95%→10% y reparto 80/20 en [0x07b62d57…68c4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x07b62d57d9c5c9197a3791084561b6b634b968c4.json)
- **Versiones "TokenWorks Hook":**
  - v2: decay de 99% a 10% y venta fija en 10% — [v2](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xbd15e4d324f8d02479a5ff53b52ef4048a79e444.json)
  - v3: reparte fees a protocolo, stakers y dueños de colección — [v3](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xd6a45df0c82c9a686ab1e58fb28d8fc0cf106444.json)
  - v4: fee por defecto de 10% con 95% inicial; reparte a dueño de colección, protocolo y holders de PNKSTR — [v4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xe3c63a9813ac03be0e8618b627cb8170cfa468c4.json)
  - v5: pools de liquidez en rango respaldados por una colección NFT, con fee dinámica — [v5](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x5d8a61fa2ced43eeabffc00c85f705e3e08c28c4.json)
- **TokenStrategy de TokenWorks (lanzado el 2-dic-2025):**
  - Launchpad permissionless y no-code que soporta ERC-721, ERC-1155, ERC-20 y "Recursive Strategies" — [Bankless – What TokenWorks is building next](https://www.bankless.com/read/tokenworks-building-next); [Coindar](https://coindar.org/en/event/punkstrategy-to-release-tokenstrategy-on-december-2nd-138080)
  - Cada release sale con 1B de supply y una fee de compra inicial de 99% que decae a 10% "para bloquear snipers"; "1%" va a buy-and-burn de PNKSTR, el token del ecosistema — [Bankless – The Strategy Meta Goes Permissionless](https://www.bankless.com/read/the-strategy-meta-tokenstrategy); [Onchainatlas](https://www.onchainatlas.org/tokenstrategy/)
  - Las **Recursive Strategies** no tienen activo subyacente: usan todas las fees para recomprarse y quemarse a sí mismas **cada 30 minutos** ("self-compressing asset") — [Bankless](https://www.bankless.com/read/the-strategy-meta-tokenstrategy)
  - El sitio se titula "TokenStrategy – On-chain Perpetual Machines" — [nftstrategy.fun](https://www.nftstrategy.fun/)
- **RecursiveStrategyHook (TokenWorks):** compra de 99%→10% (100 bps por minuto) y venta fija de 10%. Reparto: 80% a la colección NFT strategy, ~8% a PunkStrategy para buy-and-burn, ~2% a TokenWorks y el resto a una dirección que define el deployer — [hooklist 0x5e8a308b…e444](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x5e8a308b07194d115bcf78dac9a426c7b46ae444.json)
- **ERC20StrategyHook:** compra de 99%→10% (1% por minuto). Reparto: 80% al contrato strategy, 10% al token PunkStrategy y 10% al protocolo. Creación de pools y liquidez restringidas a `ERC20StrategyFactory` — [hooklist 0x9f8f375b…a444](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x9f8f375b2d246da6be816b453f13d43d8240a444.json)
- **IndexStrategies:** la primera es $AB500STR. Acumula obras de las 500 releases oficiales de Art Blocks rotando por colecciones, empezando por Chromie Squiggles. Cada colección tiene una ventana de compra de 3 días y los royalties se reparten entre los más de 300 artistas de AB500 — [Bankless](https://www.bankless.com/read/tokenworks-building-next)
- **"TokenStrategy" de Gami (colisión de nombre con el de TokenWorks):** es una factory sobre ERC-6551 para colecciones NFT donde **cada NFT es una canasta fija de tokens**. Se mintea depositando la "receta" de tokens y se quema para redimir la canasta desde su token-bound account (ej. un "TeslaStrategy" on-chain). Iba a lanzarse en la plataforma International Meme Fund — [Bankless – Remixing (7-oct-2025)](https://www.bankless.com/read/remixing-the-nftstrategy-playbook); [RootData](https://www.rootdata.com/Projects/detail/TokenStrategy?k=MjE4MDA%3D)
- **IMF (International Meme Fund):** protocolo de crédito en Ethereum que acepta memecoins como colateral en vaults aislados sobre Morpho. Emite la stablecoin $MONEY con soft-peg a US$6,90, y $IMF es el token de gobernanza — [CoinGecko](https://www.coingecko.com/en/coins/international-meme-fund)
- **Variantes de terceros (hooklist, Ethereum):**
  - MiladyStrategy (MLDYSTR): fee fija de 20%, 80% al contrato MiladyStrategy para compras de NFT y 20% al protocolo — [0x4efc4997…a044](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x4efc4997b4882b8a7bf696597347facdd221a044.json). Otra versión decae de 99% a 20% en 8 horas (10 pp por hora) — [0x5163571d…e044](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x5163571d7f39bfc551509abfed57ceca21f7e044.json)
  - "999WHL Hook": 10% en compra y venta para comprar NFTs ENS de dígitos, "mismo flywheel que NFTStrategy" — [0xA312884b…A8C4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xA312884b73862377317f0071eC6eB5404025A8C4.json)
  - Hook "ETF strategy": 10% en todos los swaps. El 90% va a un treasury automatizado que invierte en "ETF-candidate tokens" y el 10% a desarrollo; hace toma de ganancias automática al +10% con buyback-and-burn. Su auditUrl apunta a `github.com/ETFStrategy/etf-strategy-uniswap-v4` — [0xC804Af6E…4044](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xC804Af6EaA8269C71848e114571f2Dd5314C4044.json)
  - TTTStrategyHook: 5% solo en ventas, con 4% a buyback-and-burn y 1% a dev — [0x19c6b653…2844](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x19c6b653c6bcb4b9150e57489a90fa7dc8a62844.json)
  - YoYoStrategyHook: el launchpad "YoYo Pad" de NFT strategies, con fee de compra inicial de 50% que decae y reparto entre strategy, creador y protocolo — [0x87853b09…a8c4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x87853b0979c0d45ceac57675c4254f054a77a8c4.json)
  - Otros clones con reparto 80/20 o similar: Dood, Bored, MoonCats, Aeon, MEMS, Hystrategy (HYSTR) y SPCXSTR — [búsqueda en hooklist](https://github.com/Uniswap/hooklist/tree/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum)

### Inferences
- El "1%" a PNKSTR que menciona Bankless y el "10% de las fees" del hooklist son compatibles: 10% de una fee de 10% equivale al 1% del valor del trade. El ~8% del RecursiveStrategyHook indica que el reparto cambió según la versión del hook.
- El valor para el holder depende 100% de que haya volumen sostenido (fee de ~10% en compra y en venta, es decir ~20% por ida y vuelta). El burn "grande" solo ocurre cuando el NFT relistado a 1,2× se vende, así que también depende de la liquidez del mercado NFT subyacente.
- Arquitectónicamente es simple y replicable: 1 ERC-20 + 1 hook v4 (`afterSwapReturnsDelta` + swap anidado para convertir la fee a ETH) + 1 contrato "strategy" que compra, vende y quema. Eso explica la proliferación de clones.
- Para un "bag"/índice (Tricker) hay tres plantillas ya probadas en L1:
  1. **IndexStrategy** rotativa (AB500STR).
  2. **Treasury de canasta** financiado por fees con toma de ganancias (hook ETF strategy).
  3. **NFT-canasta ERC-6551** redimible (Gami).

### Gaps
- No leí el código fuente de los contratos. El hooklist marca `verifiedSource: true`, pero `auditUrl` está vacío en los hooks de TokenWorks.
- No pude mapear qué dirección de hook usa cada token (TOADSTR, VIBESTR, etc.).
- No verifiqué cuántos NFTs compró o vendió cada strategy ni cuánto supply se quemó (solo las diferencias de supply en los snapshots: TOADSTR 991,7M y CHMPSTR 978,8M sobre 1B).
- Sin datos sobre si AB500STR llegó a lanzarse ni sobre su MC.
- No pude leer el repo ETFStrategy: no está permitido en esta sesión y la búsqueda de código no devolvió resultados.

## 3. Links, equipo, tracción y red flags

### Takeaway
Son productos sin repos públicos vinculados, de un equipo (TokenWorks) cuyo nivel de doxxing no pude verificar. Tuvieron tracción explosiva de días a semanas: US$3,9–8,4M de volumen diario por token en la primera semana. Los red flags principales:
- Fees altas y persistentes.
- 20% del flujo al equipo en varias versiones.
- Hooks sin auditoría listada.
- Colapso de volumen.
- Clones con controles del owner, e incluso un patrón tipo honeypot en otro hook de mainnet.

### Cited Findings
- **Links:** homepages en `https://www.nftstrategy.fun/strategies/<contrato>`, X `token_works` y Etherscan (ej. `https://etherscan.io/token/0x92ceDfDbCE6E87b595e4a529aFA2905480368AF4`). **No hay repos de GitHub vinculados**: `repos_url.github` está vacío y los contadores de developer_data en 0 — [mirror CoinGecko TOADSTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/toadzstrategy.json); [VIBESTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/vibestrategy.json); [CHMPSTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/chimpstrategy.json)
- **Tracción en la primera semana:**

| Token | Volumen 24h | Fecha | Usuarios en watchlist de CoinGecko |
|---|---|---|---|
| TOADSTR | US$3,85M | 28-sep-2025 | 74 |
| VIBESTR | US$8,43M | 10-oct-2025 | 63 |
| CHMPSTR | US$0,57M | 19-oct-2025 | 33 |

  Fuentes: mirrors de CoinGecko de [TOADSTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/toadzstrategy.json), [VIBESTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/vibestrategy.json) y [CHMPSTR](https://github.com/tuanhoang95/currency-crawler/blob/209472674a22448b11279ec2e2e0f75cc81c8b48/coin/detail/chimpstrategy.json).
- **Tracción del ecosistema:** US$202M de MC y US$10,7M de volumen diario en el pico — [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap). Cobertura sostenida en Bankless: guía PNKSTR, NFTStrategy, Remixing (7-oct-2025), TokenStrategy (dic-2025) e IndexStrategies — [Bankless](https://www.bankless.com/read/nftstrategy-extending-punkstrategy); [Bankless](https://www.bankless.com/read/tokenworks-tokenstrategy)
- **Actividad posterior:** TOADSTR y SQUIGSTR con ~US$70 de volumen 24h (sin fecha) — [rfrm-dao CoinGeckoTop5000.csv](https://github.com/rfrm-dao/Top500CG/blob/69a04e54509cd8ee2b823cd72eb5b4a529162b2b/CoinGeckoTop5000.csv)
- **Red flag: fee al equipo.** Hooks StrategyPunk/NFTStrategy con reparto 80/20 a una "fee address" — [0xf6f49a81…28c4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xf6f49a81308d90f560b8201e90792394f5fa28c4.json); [0x07b62d57…68c4](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x07b62d57d9c5c9197a3791084561b6b634b968c4.json). En PunkStrategy, 20% de la fee va al equipo — [Bitrue](https://www.bitrue.com/blog/what-is-punkstrategy-fun)
- **Red flag: controles del owner en clones.** BoredStrategyHook permite que el owner ajuste la tasa y el reparto (equipo / "spotlight") — [0xaaec563c…2844](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xaaec563cca40018cc7351d81267154857140ecc4.json). AgentOrchestrationHook (ORCH) aplica un tax de 3% en WETH hacia "AgentStaking" y un **límite de venta por transacción configurable por un governor** — [0x350987b5…80cc](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x350987b5cf1ef5a34c5a87d955d042b5a60280cc.json)
- **Red flag: patrón honeypot.** Un "UniswapV4Hook" en mainnet permite que cualquiera bloquee las ventas llamando a `claw()`; después, solo direcciones de una allowlist del owner pueden vender — [0x7f4a7ad7…a840](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x7f4a7ad76746434e9a90059e9549cc4f3682a840.json)
- **Red flag: impostores.** Hay ERC-20 "x402" en mainnet sin relación con el protocolo — [Ethplorer](https://ethplorer.io/address/0x6921e6f029b5859fe3f95556e65911acaa8684a3); [Trust Wallet](https://trustwallet.com/blog/cryptocurrency/what-is-x402-and-ping)

### Inferences
- En el propio hook se ven tanto el diseño "fair" (anti-sniper con decay, liquidez controlada por la factory, fees on-chain y transparentes) como el riesgo: una tasa de ~10% por lado le da una fuente de ingreso al equipo que no depende de que el holder gane.
- Bloquear los swaps exact-output puede romper algunas rutas de aggregators y wallets. Es una fricción de UX que el landing debería explicar.
- El patrón `claw()` y los governors que cambian límites de venta son exactamente lo que un launch site "tech" debe declarar que NO hace. Publicar la ficha del hook en el hooklist oficial con `verifiedSource` sirve como señal de confianza.

### Gaps
- No verifiqué quiénes son los fundadores de TokenWorks ni su nivel de doxxing.
- Sin métricas de usuarios únicos, holders ni revenue acumulado por strategy (no pude acceder a Dune, Etherscan ni DexScreener).
- No se pudo confirmar si algún token del cohort fue abandonado formalmente o migrado.

## 4. ¿Por qué interesa y conviene inspirarse? Veredicto para Payence, Nomia, Tricker y Tricker Terminal

### Takeaway
**Sí conviene inspirarse, pero en el producto y la presentación, no en la tokenómica.** Lo valioso de este meta es que el token *es* un producto legible: la "máquina perpetua" con reglas en un hook verificable y un loop visible de compra → relist → burn. Lo más transferible es para **Tricker**, gracias a las plantillas de IndexStrategy, treasury de canasta y NFT-canasta ERC-6551. Para **Payence/Nomia**, la lección en L1 es integrar estándares como ERC-8004 en el producto y no lanzar un "AI tax token". Hay que evitar las fees perpetuas altas, el skim opaco al equipo y los controles del owner.

### Cited Findings
- El pitch del sitio de TokenWorks es "On-chain Perpetual Machines" — [nftstrategy.fun](https://www.nftstrategy.fun/)
- TokenStrategy convirtió el modelo en un **launchpad no-code permissionless** para cualquier creador o colectivo, con categorías nuevas y la expectativa de "new chains" — [Bankless](https://www.bankless.com/read/tokenworks-building-next); [Bankless](https://www.bankless.com/read/tokenworks-tokenstrategy)
- La IndexStrategy AB500STR rota compras entre colecciones con ventanas de 3 días y reparte royalties entre más de 300 artistas — [Bankless](https://www.bankless.com/read/tokenworks-building-next)
- El hook "ETF strategy" hace que el 90% de las fees financie un treasury que compra "ETF-candidate tokens", con toma de ganancias al +10% y buyback-and-burn — [hooklist](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xC804Af6EaA8269C71848e114571f2Dd5314C4044.json)
- El TokenStrategy de Gami convierte cada NFT en una canasta fija de tokens (ERC-6551), que se mintea depositando la receta y se quema para redimirla — [RootData](https://www.rootdata.com/Projects/detail/TokenStrategy?k=MjE4MDA%3D); [Bankless](https://www.bankless.com/read/remixing-the-nftstrategy-playbook)
- **ERC-8004 en mainnet desde el 29-ene-2026.** Crea registros de identidad (cada agente es un NFT ERC-721 con metadata de capacidades, endpoints y credenciales), reputación y validación para agentes de IA. Según los resúmenes de búsqueda hubo más de 10k agentes registrados en testnet antes de mainnet — [Forbes](https://www.forbes.com/sites/digital-assets/2026/02/05/ai-agents-gain-trust-via-ethereum-erc-8004-on-mainnet/); [CoinDesk](https://www.coindesk.com/tech/2026/01/28/the-protocol-ethereum-to-roll-out-new-ai-agents-standard-soon); [Yellow](https://yellow.com/news/ethereum-launches-erc-8004-token-standard-to-give-ai-agents-on-chain-identity); [CCN](https://www.ccn.com/news/crypto/erc-8004-agents-standard-nears-mainnet-as-ethereum-teases-rollout/)
- La categoría x402 suma ~US$9,6B de MC según CoinGecko (sept-2026), pero x402 no tiene token oficial, y los ERC-20 "x402" en mainnet son impostores — [CoinGecko x402](https://www.coingecko.com/en/categories/x402-ecosystem); [Ledger](https://www.ledger.com/academy/topics/economics-and-regulation/what-is-x402); [Ethplorer](https://ethplorer.io/address/0x6921e6f029b5859fe3f95556e65911acaa8684a3)
- Los hooks "AI" de mainnet son taxes con reparto a wallets o registros privilegiados:
  - NRC20Hook: "cognition tax" de 0,2% que un registry privilegiado distribuye a "AI agents registrados" — [0x5ff06f30…0044](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x5ff06f30fbfd1bfe4f62eb3d39b6767e00e80044.json)
  - UniagentHook: fee de 1%, repartida 50% a un reward vault, 30% a una "AI funding wallet" y 20% a dev — [0xa5db9bd1…00cc](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xa5db9bd1eac09894c680fe56bc5db26078c800cc.json)

### Inferences

**Veredicto por candidato**
- **TOADSTR (#1): inspirarse sí, como caso de estudio del ciclo completo.** Copiar la claridad del loop y el anti-sniper con decay. Evitar depender de una fee perpetua de ~10% por lado: cuando el volumen cae a ~US$70/día la "máquina" se apaga y el token pierde ~95%.
- **VIBESTR (#2): inspirarse sí.** Es la prueba de que el modelo puede lanzar un token al rango de US$8M en ~1 día y retener ~US$2,6M después. Útil como benchmark de "lo que logra un launch tech bien empaquetado en L1". No se sabe el subyacente, así que no conviene citarlo como modelo de narrativa.
- **MEEBSTR (#3): gemelo de TOADSTR.** Refuerza la lección del decay. Inspiración neutra.
- **CHMPSTR (#4): demuestra que la cohorte tardía se sostuvo en la banda.** Sugiere que lanzar dentro de un meta ya validado, con la misma infraestructura (factory + hook), reduce el riesgo del día 1.

**Qué copiar para el launch site y los productos**
1. **"El token es una máquina" como narrativa y UI.** La landing debería mostrar el estado de la máquina en vivo: fees acumuladas, próxima compra o acción, burns e historial, todo con links a transacciones. Aplica a Tricker ("este bag compra X cuando…") y a Nomia/Payence ("x% de los fees de settlement → acción on-chain verificable").
2. **Reglas en un hook v4 verificado y registrado en el hooklist oficial**, con el reparto en porcentajes publicado. Es una señal de confianza barata frente a los clones.
3. **Anti-sniper con decay** (99%→10% en minutos o bloques) solo en la ventana de lanzamiento, explicado en la landing.
4. **Para Tricker:**
   - (a) una "IndexStrategy" o "BagStrategy" cuyo treasury compre una canasta de 3–5 activos con reglas de rotación o rebalanceo;
   - (b) bags como NFTs ERC-6551 redimibles (depositar la receta para mintear, quemar para redimir), al estilo Gami;
   - (c) toma de ganancias y buyback reglados, como el hook ETF strategy.
5. **Para Tricker Terminal:** la tesis es que los "machine tokens" crean demanda de analítica (fees, compras pendientes, burns, holdings del treasury). El hooklist oficial, con descripciones verificadas por dirección, sirve como dataset para indexar hooks y señalar red flags (owner-adjustable, `claw()`, governors).
6. **Para Nomia/Payence:** integrar ERC-8004 (identidad y reputación del agente) como feature en L1, y dejar el settlement barato en L2 (x402 vive en Base/Solana). No lanzar un token cuyo único "producto" sea un tax con etiqueta "AI".

**Qué evitar**
- Fees perpetuas de ~10% por lado como único motor de valor.
- Un 20% al equipo sin disclosure claro.
- Owner o governor capaz de cambiar taxes o límites de venta.
- Bloquear ventas (`claw()`).
- Nombres que suenen a protocolos sin token ("x402").
- Bloquear exact-output sin avisar a los usuarios.
- Clonar un meta saturado: en el registro ya hay 41 hooks "Strategy" en mainnet.

### Gaps
- No tengo métricas de conversión ni de retención de los sitios de TokenWorks (UI, dashboards) porque no pude abrir las páginas. Las recomendaciones de UI son inferencias, no observaciones.
- No encontré en L1 un token de pagos para agentes (tipo Payence/Nomia) con MC in-band verificable que sirva de comparable directo.

## 5. Narrativas small-cap tech vivas en Ethereum mainnet 2025–2026

### Takeaway
Hubo cuatro narrativas relevantes en L1:
1. El **strategy meta** (sept-2025 → 2026): PunkStrategy → NFTStrategy → forks → TokenStrategy permissionless → IndexStrategies.
2. **Hooks de Uniswap v4 como capa de lanzamiento y tax**, tanto genéricos como con etiqueta "AI agent".
3. **Lanzamientos por subasta** (CCA/LBPStrategy de Uniswap), usados por proyectos grandes.
4. **Infra de agentes (ERC-8004)**, sin token propio.

x402, los bots de Telegram, ERC-404 y los tokens de privacidad no produjeron candidatos in-band verificables en L1.

### Cited Findings
- **Uniswap v4 como base:**
  - v4 salió a mainnet el 31-ene-2025. A mediados de 2026 procesaba ~30% del volumen de swaps de Uniswap, con cientos de hooks desplegados en 10 redes — [Ryder](https://ryder.id/blogs/post/uniswap-v4-hooks-in-2026-what-they-mean-for-signers); [Datawallet](https://www.datawallet.com/crypto/uniswap-v4-explained)
  - La búsqueda de código "Strategy" en `hooks/ethereum` del hooklist oficial devuelve **41 entradas** — [Uniswap/hooklist](https://github.com/Uniswap/hooklist/tree/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum)
- **Strategy meta:**
  - NFTStrategy llegó a US$202M de MC en el pico; los ocho tokens se listaron en OpenSea el 30-sep-2025 — [The Defiant](https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap)
  - Remixes: el TokenStrategy de Gami (ERC-6551), Milady Rescue y PainStrategy — [Bankless, 7-oct-2025](https://www.bankless.com/read/remixing-the-nftstrategy-playbook)
  - TokenStrategy permissionless (2-dic-2025), con estrategias recursivas que se queman cada 30 minutos — [Bankless](https://www.bankless.com/read/the-strategy-meta-tokenstrategy)
  - IndexStrategy AB500STR — [Bankless](https://www.bankless.com/read/tokenworks-building-next)
  - CoinGecko abrió categorías "NFTStrategy Ecosystem" y "NFT Strategy Flywheel" — [CoinGecko](https://www.coingecko.com/en/categories/nftstrategy-ecosystem); [MEXC](https://www.mexc.com/price/category/nft-strategy-flywheel)
- **Hooks genéricos de launch/tax en mainnet** (PRs del bot hooklist-generator; según el resumen de búsqueda se mergearon en sept-2026, fecha no verificada):
  - LauncherHook: pools ETH/token de un solo lado — [PR #7475](https://github.com/Uniswap/hooklist/pull/7475)
  - LaunchTokenV4: taxes de hasta 10% por lado en ETH más límites anti-whale — [PR #7339](https://github.com/Uniswap/hooklist/pull/7339)
  - V4LaunchHook: fees de hasta 30% hacia una wallet de marketing, más auto-venta de una reserva de marketing mediante swaps anidados en `beforeSwap` — [PR #7467](https://github.com/Uniswap/hooklist/pull/7467)
- **Hooks con etiqueta "AI agent" en mainnet:** ORCH (AgentStaking, tax de 3% y sell-cap gobernable), NRC20 ("cognition tax" de 0,2%) y UniagentHook (1%, con 30% a una "AI funding wallet") — [ORCH](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x350987b5cf1ef5a34c5a87d955d042b5a60280cc.json); [NRC20](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x5ff06f30fbfd1bfe4f62eb3d39b6767e00e80044.json); [Uniagent](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xa5db9bd1eac09894c680fe56bc5db26078c800cc.json)
- **Subastas CCA/LBPStrategy de Uniswap en mainnet:**
  - LBPStrategy (versiones 3.0.0 y 3.1.0) crea una subasta de price discovery y abre el pool v4 al precio de clearing — [v3.0.0](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xb98766a35cdc28415be0767d4ea41e39fba3e000.json); [v3.1.0](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x49380c4efab1b491006af7fabab8b3459f0e6000.json)
  - Casos: Aztec (CCA de noviembre de 2025), Octra (wOCT, abril de 2026) y Strato (STRATO, junio de 2026) — [Aztec](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0xd53006d1e3110fd319a79aeec4c527a0d265e080.json); [Octra](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x890681cff5ad2069f020027f41f5f68f6a292000.json); [Strato](https://github.com/Uniswap/hooklist/blob/1d2f09b1665138a4b452becce32cfbcf4e2482b7/hooks/ethereum/0x358ac5a3fa0d5a80d78013dbe6a4f290438ca000.json)
- **Infra de agentes:** ERC-8004 en mainnet desde el 29-ene-2026 — [Forbes](https://www.forbes.com/sites/digital-assets/2026/02/05/ai-agents-gain-trust-via-ethereum-erc-8004-on-mainnet/). Las búsquedas de "AI agent microcap Ethereum 2026" devolvieron sobre todo contenido promocional de presales (p. ej. MemeToro, SUBBD) — [Bitget News](https://www.bitget.com/news/detail/12560605498186); [Changelly](https://changelly.com/blog/best-ai-agent-crypto-coins-to-buy/)
- **x402:** es un protocolo de Coinbase (mayo-2025) sin token oficial; su categoría suma ~US$9,6B de MC (sept-2026) en tokens de otras chains — [CoinGecko](https://www.coingecko.com/en/categories/x402-ecosystem); [Ledger](https://www.ledger.com/academy/topics/economics-and-regulation/what-is-x402)
- **DeFi sobre memecoins:** IMF (préstamos con colateral meme vía Morpho y $MONEY a US$6,90), hoy en US$314K de MC y casi sin volumen — [CoinGecko](https://www.coingecko.com/en/coins/international-meme-fund)
- **Bots de Telegram (dato de 2023, antiguo):** Banana Gun, lanzado en 2023, acumula US$16,09B de volumen, 25,3M de trades y 1,3M de usuarios a marzo de 2026; según el resumen de búsqueda, BANANA reparte 40% de las fees a holders. No aparece ningún token nuevo de bot en L1 dentro de la banda — [Nerdbot (16-mar-2026)](https://nerdbot.com/2026/03/16/16-billion-through-a-telegram-chat-inside-the-trading-bot-retail-crypto-cant-quit/); [CoinGecko Learn](https://www.coingecko.com/learn/top-telegram-trading-bots)
- **ERC-404 / DN-404 (narrativa de 2024, antigua):** DN-404 se lanzó el 12 de febrero (de 2024) como alternativa a ERC-404 que ahorra gas; no encontré experimentos in-band en L1 en 2025–26 — [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/new-dn-404-token-standard-released-claims-to-make-erc-404-more-efficient)

### Inferences
- En 2025–26, el "tech coin" small-cap que funcionó en L1 fue un **token con mecanismo on-chain autoejecutable** (hook + contrato) atado a un activo nativo de Ethereum (NFTs blue-chip). No fueron apps off-chain ni agentes de IA. El alto costo de gas en L1 favorece loops con pocas acciones grandes (comprar un Punk, quemar) frente a micro-acciones de agentes.
- Para 2026, la señal en L1 es la **"hookificación" de los taxes de lanzamiento**: los hooks genéricos de tax/launch y los "AI" tax hooks recrean los tax-tokens de 2023 con otra piel. Además, los proyectos serios migran a subastas CCA/LBP para su lanzamiento.
- Para el usuario, el hueco de mercado en L1 es un **launch "tech" con mecanismo transparente y fees moderadas**, más un dashboard de estado. Ese diferencial se ve con claridad frente a la saturación de clones de 80/20.

### Gaps
- **Privacidad, EIP-7702 y dev-tools:** no alcancé a buscarlos (presupuesto de WebSearch agotado), así que no hay datos. Queda pendiente si hubo tokens in-band en L1.
- **Hooks "AI" (ORCH, NRC20, Uniagent), 999WHL, ETF strategy, MiladyStrategy, HYSTR, SPCXSTR y MEMS:** sin MC, fecha de lanzamiento ni contrato del token (solo la dirección del hook).
- **Milady Rescue:** Bankless la menciona, pero no encontré detalles de su mecánica ni de si tiene token.
- **Hooks genéricos de sept-2026:** la fecha de merge viene del resumen de búsqueda y no pude verificarla en los PRs.
