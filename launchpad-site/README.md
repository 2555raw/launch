# Tricker Launchpad — lanzamientos pareados a restaurantes

Un launchpad donde cada lanzamiento va **pareado a una cadena de restaurantes o a un sitio
donde pedir comida, y a la acción de su matriz**: TACO/YUM, BK/QSR, MCD/MCD, EATS/UBER. Sólo
entran marcas que cotizan, porque sin acción no hay par; Subway, Chick-fil-A o Dunkin' no
están por eso.

Funciona de verdad: hay servidor, API, estado persistente, identidad por wallet y cotizaciones
reales. Lo que **no** hace es mover dinero: una aportación es un compromiso registrado a nombre
de una cartera, y la página lo dice. La liquidación on-chain no está conectada.

Sin paso de compilación en el cliente: HTML, CSS y JS a secas. El servidor es Node con una
dependencia (`ethers`, para hablar con BNB Chain y verificar firmas).

## Arrancar

```bash
npm install
npm start                 # http://localhost:8080
SEED_DEMO=1 npm start     # con aportaciones de demostración, marcadas como tal
npm test                  # pruebas de la API
```

Variables de entorno:

| Variable | Qué hace | Por defecto |
| --- | --- | --- |
| `PORT` | puerto de escucha (Railway lo pone) | `8080` |
| `DATA_DIR` | carpeta del fichero de estado `launchpad.json` (en Railway: un volumen montado en `/data`) | `./data` |
| `SEED_DEMO` | siembra aportaciones de demostración la primera vez | apagado |
| `RATE_LIMIT` | escrituras por minuto y por IP | `30` |

En Railway: servicio con *root directory* `launchpad-site`, un volumen montado en `/data` y
`DATA_DIR=/data`. Con eso el estado sobrevive a los despliegues.

## Cómo funciona

1. **Se parea.** Cada lanzamiento del catálogo (`launches.js`) lleva marca, dominio oficial,
   ticker de la matriz, categoría, cadena, precio, emisión, objetivo, mínimo, tope por cartera
   y ventana. Las ventanas se siembran relativas al primer arranque (`openIn`/`closeIn`, en
   horas) y quedan fijas en el fichero de datos.
2. **Se recauda.** El cliente entra con una wallet EVM: pide un nonce, firma un mensaje
   (EIP-191, sin gas) y el servidor recupera la dirección de la firma. Con la sesión, un
   `POST /api/launches/:id/contribute` registra la aportación si la ventana está abierta, la
   cantidad es válida, no supera el tope por cartera y cabe antes del objetivo. Al llegar al
   objetivo la ventana cierra en ese instante.
3. **Sale a mercado.** Al cerrar, si se alcanzó el mínimo el lanzamiento queda "cerrado ·
   objetivo"; si no, "cerrado · sin mínimo" y las aportaciones se marcan como devueltas.

## API

| Ruta | Qué devuelve |
| --- | --- |
| `GET /api/launches` | la mesa: fase, recaudado, carteras, progreso, resultado, calculados ahora |
| `GET /api/launches/:id` | un lanzamiento |
| `GET /api/quotes` | cotización real de cada matriz (caché de 60 s), o `available: false` |
| `POST /api/auth/nonce` `{ address }` | el mensaje a firmar |
| `POST /api/auth/verify` `{ address, signature }` | `token` de sesión (7 días) |
| `GET /api/me` (Bearer) | la cartera y sus aportaciones |
| `POST /api/launches/:id/contribute` (Bearer) `{ amount }` | la aportación y el lanzamiento actualizado |

## Reglas que gobiernan el proyecto

**Nada se inventa.** Recaudación, carteras y fases salen del servidor; la cotización, del
mercado (Yahoo Finance, con retraso); si no hay dato, la interfaz dice "no disponible". Lo
único escrito a mano es el catálogo. Las aportaciones de demostración, si se siembran, van
marcadas `demo` en el fichero, en la API y en la mesa.

**Siempre el logo oficial, nunca uno dibujado.** Cada marca lleva su dominio oficial y el logo
se resuelve de él en tiempo de ejecución (logo.dev si hay `window.TRICKER_CONFIG.logoToken`,
si no el favicon en alta resolución de Google y, de reserva, el de DuckDuckGo). Si nada
resuelve, un monograma neutro.

**Las marcas no participan.** Los nombres y logos identifican a qué va pareado cada
lanzamiento. Ninguna marca patrocina, avala ni emite nada aquí.

## Estructura

```
index.html    la página: cinta, hero con el destacado, cifras, la mesa, cómo funciona,
              calculadora, calendario, reglas, FAQ, cierre
styles.css    el sistema de diseño: el suelo casi negro de Tricker, tipografía pesada, y un
              solo acento (naranja) para "en vivo" y las barras de progreso
app.js        el cliente: carga la API, pinta todo, wallet, aportar, contadores, tema
server.js     el servidor: estáticos, API, fichero de estado, firmas, cotizaciones
launches.js   el catálogo de lanzamientos
test.js       pruebas de la API (node:test)
```

## kuai (dapp en BNB Chain)

`dapp/index.html` es la interfaz principal: un launchpad de coins en **BNB Chain** donde cada
coin se crea **pareada a la acción tokenizada de un restaurante**, más una tienda de tarjetas
de regalo. Página estática (HTML, CSS y JS con ethers.js desde cdnjs) que habla con los
contratos a través de la wallet del usuario (MetaMask o cualquier wallet inyectada) y con el
servidor para indexar, preparar las llamadas y hacer de proxy RPC. Se construye desde una
plantilla con `tools/build.py` (catálogo, pares, créditos y traducciones se inyectan).

**Qué significa pareada.** La recaudación de cada coin se paga en el token que representa la
acción del restaurante en BNB Chain (McDonald's = MCDx, Starbucks = SBUXx, Meituan = MEITx,
Wendy's = WENB…), y al graduarse crea un pool COIN/ACCIÓN en PancakeSwap v2 con los LP
quemados. `contracts/pairs.json` lista los 18 pares verificados en cadena (nombre, símbolo,
decimales, supply) con emisor (xStocks de Backed, bStocks de Binance, Ondo) y dirección. Los
restaurantes sin acción tokenizada en BNB Chain no se pueden parear todavía. En testnet los
tokens de acciones no existen, así que las coins se pagan en tBNB (o en un BEP-20 de prueba
con `STOCK_TEST=0x...`).

**Contratos** (`contracts/KuaiLaunch.sol`, Solidity 0.8.28, sin auditar):

- `KuaiFactory.setStocks(ids, tokens)` (sólo el dueño) registra el token de cada restaurante;
  `address(0)` significa pagar en BNB. `setFeeTo` cambia el destino de la comisión.
- `KuaiFactory.createCoin(name, symbol, restaurantId, target, duration)` despliega un
  `KuaiToken` (1.000.000.000 de supply, 18 decimales) y un `KuaiRaise` pagado en el token
  registrado.
- `KuaiRaise.buyWith(amount)` (tras `approve`) o `buy()` en BNB; tope por cartera =
  objetivo/10; al llegar al objetivo la ventana cierra; el exceso se devuelve.
- `finalize()`: si se alcanzó el mínimo (objetivo/3), el 1 % va a `feeTo` y el 99 % restante
  más el 20 % del supply forman el pool COIN/ACCIÓN (o COIN/BNB) en PancakeSwap v2; los LP
  se queman, así que la liquidez no se puede retirar. Si no, `refund()` devuelve el 100 %.
  `claim()` reparte el 80 % restante en proporción a lo aportado.
- El swap tras graduar se hace contra el router de PancakeSwap (`/api/coins/ix/swap` prepara
  `approve` + `swapExactTokensForTokens` con el deslizamiento pedido).

`contracts/compile.js` compila con solc a `contracts/build/*.json` (ABI y bytecode, que el
servidor usa para desplegar). `npm run test:contracts` ejecuta los contratos en un EVM en
proceso (`@ethereumjs/vm`, con un router de PancakeSwap simulado en `contracts/test/Mocks.sol`)
y recorre 28 comprobaciones: registro de pares, recaudación en token y en BNB, tope por
cartera, cierre anticipado, graduación con comisión y pool, claim, reembolso por no llegar al
mínimo y graduación al vencer.

**Staking del token de la casa ($KUAI)** (`KuaiStaking`, en el mismo fichero): la comisión del
1 % de cada graduación va a `feeTo` de la factory, que el dueño cambia con `setFeeTo`. Si apunta
a `KuaiStaking`, el 70 % de cada comisión se paga en BNB a quien tenga $KUAI en staking (en
proporción, reclamable cuando quiera, sin bloqueo) y el 30 % va a un fondo de recompra que
compra $KUAI en PancakeSwap y lo manda a la dirección muerta. Antes de fijar el token de la casa
todo va a la recompra; si nadie hace staking, el 70 % espera a los primeros. Las comisiones en
acciones (MCDx…) se convierten a BNB con `harvest`; `harvest` y `buyback` sólo las puede lanzar
el dueño (llevan un mínimo de salida contra sandwiches) y el panel `/admin` → Launchpad las
ejecuta con `DEPLOYER_KEY`. Desde ahí también se despliega el contrato (y se apunta `feeTo` a él)
y se fija el token de la casa una sola vez. `STAKING_56` / `STAKING_97` sirven como alternativa.

**Desplegar y conectar**

La página pide al servidor `GET /api/config` (dirección de la factory por cadena, red por
defecto, enlaces sociales) y enruta por path (`/gifts`, `/coins`, `/r/mcdonalds`…), así que
no hay que reconstruir nada al desplegar la factory. Dos caminos:

- Desde `/admin` → **Launchpad**: con `DEPLOYER_KEY` en el servidor (una clave con tBNB del
  faucet para testnet), el panel enseña la dirección y el saldo del desplegador y un botón
  «Deploy factory» que despliega `KuaiFactory`, registra los 18 restaurantes y guarda la
  dirección en el almacén. La página la usa al momento.
- Por línea de comandos:

```bash
npm install
npm run compile                                  # contracts/build/*.json
PRIVATE_KEY=0x... npm run deploy -- testnet      # registra todos los restaurantes en tBNB
PRIVATE_KEY=0x... npm run deploy -- mainnet      # registra los 18 pares de pairs.json
```

y luego `FACTORY_97=0x…` (o `FACTORY_56`) en el entorno, o pegar la dirección en `/admin` →
Launchpad. `DEFAULT_CHAIN` (`56` o `97`) fuerza la red por defecto; si no, es mainnet cuando
hay factory en 56 y testnet en caso contrario. `#mainnet` o `#testnet` en la URL cambian de
red. `BSC_RPC` y `BSC_TESTNET_RPC` apuntan a tu nodo (por defecto los públicos). Dentro de
claude.ai (iframe aislado) la wallet puede no inyectarse: entonces hay que abrir la página
desde su propio dominio.

**Lo que sirve el servidor para la página**

- `POST /api/rpc?cluster=` proxy JSON-RPC con lista blanca de métodos (saldos, bloques,
  `eth_call`, recibos, envío de transacciones firmadas), para que la página no dependa de un
  nodo público desde el navegador.
- `GET /api/coins`, `/api/coins/:raise?buyer=`, `/api/coins/:raise/buys`, `/api/feed`,
  `/api/buys?wallet=`: índice de las recaudaciones de la factory (`info()` de cada
  `KuaiRaise`, con caché) y de las compras (eventos `Bought`, leídos por ventanas de bloques).
- `GET /api/coins/ix/(create|approve|buy|finalize|claim|refund|swap)?wallet=…`: devuelve la
  lista de llamadas `{to, data, value}` lista para firmar; la página las envía una tras otra
  con la wallet y espera el recibo de cada una.
- `GET /api/prices` y `GET /api/chart?cg=<id>&days=1|7|30`: CoinGecko con caché.
- `GET /api/pool?raise=`: precio, liquidez y capitalización del par en PancakeSwap de una
  coin graduada, muestreado para el gráfico.
- Rutas con metadatos propios: `/`, `/explore`, `/gifts`, `/coins`, `/launch`, `/docs`,
  `/pairs`, `/account`, `/r/<id>`, `/gift/<id>`, `/coin/<chain>/<raise>`, `/u/<wallet>` sirven
  la misma página con su `<title>`, descripción, Open Graph y canonical; `/sitemap.xml`,
  `/robots.txt`, `/manifest.webmanifest`, `/sw.js` (PWA). Todo con gzip.

**Secciones al estilo Seam**

- `/dashboard`: portada con foto, fondo de staking, coins en vivo y próximo cierre; una tarjeta por
  restaurante con precio de la acción, coins en vivo, recaudado y botón para comprar la coin en vivo
  (aprobación incluida si se paga en acción) o lanzar una.
- `/analytics`: totales leídos de los contratos (recaudado, graduadas, compradores, comisiones,
  pagado a stakers, $KUAI quemado), recaudado en el tiempo, reparto por restaurante, actividad
  (compras, lanzamientos, graduaciones), mejores compradores y últimas coins.
- `/terminal`: tabla de todas las coins (recaudado, objetivo, progreso, compradores, cierre, precio
  del pool) y de los restaurantes, calculadora con las reglas del contrato y el reparto de fondos.
- `/stake`: staking de $KUAI (stake, unstake, MAX, reclamar BNB) y resumen del contrato.
- `/profile`: con la wallet firmada, nombre, avatar (se recorta a 160 px en el navegador, máximo
  120 KB, se comprueba el tipo real), tesis y actualizaciones; P/L de sus compras con las coins
  graduadas valoradas al precio del pool. `/u/<wallet>` es la versión pública. Los nombres salen
  en el tablero. API: `GET /api/profile/:addr`, `GET /api/profiles`, `POST /api/me/profile`,
  `POST /api/me/updates`, `POST /api/admin/profiles/:addr/reset`; staking: `GET /api/stake`,
  `GET /api/stake/ix/(approve|stake|unstake|claim)`, `GET|POST /api/admin/staking`.

**Docs y páginas legales**: `/docs` sigue el formato de la documentación de Seam (índice, una
tarjeta por tema, tabla de comisiones, «qué puede y qué no puede pasar» y direcciones de los
contratos de la red activa). `/terms`, `/privacy`, `/risk`, `/refund` y `/cookies` son páginas
propias con fecha de actualización. Tipografía Inter con los tamaños y pesos de Seam, sus
animaciones de entrada y la barra inferior fina con el precio de cada acción. Las imágenes de
portada (`dapp/photos/hero-market.webp`, `hero-temple.webp`) son ilustraciones propias dibujadas
en SVG (mercado nocturno y pagoda con farolillos), no fotos de terceros.

**Qué hace la página además de comprar**

- Portada cinematográfica y tablero (`/explore`) con las coins, los pares y los lanzadores,
  ranking lateral por movimiento de la acción y cinta de precios.
- Precio en USD junto a cada cantidad (BNB y acciones por CoinGecko, caché de 2 minutos).
- Página por coin con enlace compartible (`#coin/97/<raise>`, `#r/mcdonalds` para un
  restaurante), gráfico de la recaudación, lista de compras con enlace a BscScan, swap en
  PancakeSwap una vez graduada, comentarios, alertas por email e imagen para compartir.
- Cinta de compras en vivo, ranking, calendario, perfil por wallet.
- Buscador que acepta una dirección 0x o un enlace de BscScan y abre esa coin o ese token.
- Inicio de sesión firmando un mensaje con la wallet (`personal_sign`, sin gas).
- Fotos reales de Wikimedia Commons (licencias CC, créditos en la página) y logotipos
  oficiales en `dapp/logos/<id>.png`; desde `/admin` se pueden subir fotos propias.

**Tienda de tarjetas de regalo (compra dentro de la web)**

`gifts.js` + `services/` convierten la web en una tienda: el visitante elige marca y valor,
pone el email del destinatario y un mensaje, elige cómo pagar, y recibe el código en la
página, por email y en su cuenta. Nada se simula: sin proveedor configurado las tarjetas
aparecen como «no disponibles» y enlazan a Bitrefill.

Flujo: `POST /api/gifts/checkout` crea el pedido (`pending`) → el pago se confirma en el
servidor (transacción en BNB Chain verificada por RPC, IPN firmado de NOWPayments o webhook
firmado de Stripe) → `paid` → se compra la tarjeta por API de Bitrefill con el saldo de la
cuenta (`processing`) → `delivered` con el código, o `failed` (el admin puede reintentar o
marcar `refunded`). Estados: pending, paid, processing, delivered, failed, expired, refunded.

| Variable | Qué activa |
| --- | --- |
| `BITREFILL_API_KEY` (o `_ID` + `_SECRET`) | suministro: compra real de tarjetas con el saldo de tu cuenta Bitrefill |
| `MERCHANT_ADDRESS` | pago con wallet en BNB Chain (BNB o USDT, enlace EIP-681 con QR) a tu dirección |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | pago con cualquier cripto (300+ monedas); `NOWPAYMENTS_SANDBOX=1` para el sandbox |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | pago con tarjeta (Stripe Checkout alojado; claves `sk_test_` para pruebas) |
| `RESEND_API_KEY`, `MAIL_FROM` | envío del código por email (Resend) |
| `ADMIN_KEY` | panel `/admin` y API `/api/admin/*` (cabecera `x-admin-key`, comparación en tiempo constante) |
| `SITE_URL`, `BRAND_NAME`, `GIFT_MARGIN`, `GIFT_TEST` | URL pública (callbacks), marca, margen (0.04 = 4 %), producto de prueba de Bitrefill |
| `GIFT_WALLET_DISCOUNT`, `GIFT_REF_SHARE`, `SUPPORT_EMAIL`, `X_URL` | descuento al pagar con wallet (0.02), parte del margen para referidos (0.25), buzón de soporte, perfil de X |
| `FACTORY_56`, `FACTORY_97`, `DEFAULT_CHAIN`, `BSC_RPC`, `BSC_TESTNET_RPC`, `COINGECKO_API_KEY` | factory por red, red por defecto, nodos RPC, clave demo de CoinGecko |
| `STAKING_56`, `STAKING_97` | dirección de KuaiStaking por red (si no se despliega desde `/admin`) |
| `DEPLOYER_KEY`, `FEE_TO`, `STOCK_TEST` | clave que despliega la factory desde `/admin`, destino de la comisión del 1 %, BEP-20 de prueba para testnet |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | bot de X: publica cada coin nueva y cada graduación (OAuth 1.0a, app con lectura y escritura) |

Webhooks a registrar en cada proveedor: `POST /api/webhooks/nowpayments` y
`POST /api/webhooks/stripe`. Rutas públicas: `GET /api/gifts/catalog`, `GET /api/gifts/currencies`,
`POST /api/gifts/checkout`, `GET /api/gifts/orders/:id`, `POST /api/gifts/orders/:id/tx`,
`POST /api/gifts/orders/:id/claim`, `GET /api/me/orders` (login por firma de wallet),
`GET /api/catalog`. Admin: resumen, pedidos, reintento de emisión, cambio de estado con nota,
reenvío de email, overrides del catálogo (nombre, foto subida, categoría, descripción,
ocultar), launchpad (desplegar factory, dirección por red) y registro de actividad.

`npm run test:gifts` recorre todo contra RPC, Bitrefill, NOWPayments, Stripe y Resend
simulados (47 comprobaciones: firmas de webhooks, entrega programada, descuento, referidos,
comentarios, alertas, newsletter, soporte y estado).

**Lo que hace además (todo probado)**

- Tienda: selector de país, entrega programada (el email sale a la hora elegida; el job de
  cada minuto lo envía), vista previa del email (`/api/gifts/preview`), descuento al pagar con
  wallet (`GIFT_WALLET_DISCOUNT`, 2 % por defecto), «guardar en mi cuenta» sin email,
  referidos (`?ref=<wallet>`, `GIFT_REF_SHARE` = 25 % del margen, `/api/me/referrals`, pagos
  anotados desde `/admin` → Community).
- Launchpad: perfil público por wallet (`/u/<wallet>`), ranking (`/leaderboard`), calendario de
  cierres (`/calendar`), simulador de tokens en la ficha, imagen para compartir (Web Share o
  descarga), precio del pool tras graduar (`/api/pool`, con histórico), swap en PancakeSwap,
  comentarios por coin firmados con la wallet (`/api/comments/:addr`), alertas por email
  (`/api/alerts`: al graduar, al abrir reembolsos y 2 h antes de cerrar; un job cada 2 min
  lee la cadena y envía con Resend), titulares de prensa por restaurante (`/api/news`,
  Google News RSS).
- Contenido: guías (`/guides/...`: comprar cripto, tarjeta con USDT, acciones tokenizadas,
  recaudación emparejada), estado público (`/status`, `/api/status`), ayuda con formulario
  (`/api/support`, reenviado a `SUPPORT_EMAIL`), newsletter (`/api/newsletter`, CSV en admin).
- App instalable (PWA): `manifest.webmanifest`, `sw.js` (página network-first, fotos en
  caché), iconos en `dapp/icons/`.
- Idiomas: inglés y chino, con las mismas claves cada uno.

**Lo que falta para operar de verdad** (todo está programado; sólo faltan las credenciales):
1. Cuenta Bitrefill con API y saldo cargado.
2. Cuenta NOWPayments (API key + IPN secret) y/o Stripe (clave secreta + webhook).
3. Dominio verificado en Resend para los emails.
4. Factory desplegada en testnet primero (`/admin` → Launchpad con `DEPLOYER_KEY` cargada de
   tBNB, o `npm run deploy -- testnet`).
5. Dominio propio (`SITE_URL`) y perfil de X (`X_URL`; claves `X_*` para el bot).
6. Auditoría de los contratos antes de mainnet.

**Pruebas**

```bash
npm test                 # API del servidor
npm run test:gifts       # tienda, comunidad y perfiles: 66 comprobaciones con proveedores simulados
npm run test:contracts   # 46 comprobaciones de contratos (staking incluido) y 6 del servidor contra KuaiStaking
npm run test:dapp        # la página en Chromium contra una wallet y una tienda simuladas
```

`.github/workflows/launchpad.yml` ejecuta los cuatro en cada push. El harness del navegador
(`tools/dapp-harness.js`) necesita Playwright (`npx playwright install chromium`).

La página se probó en Chromium contra una wallet MetaMask simulada y un servidor que imita
la factory: conectar, crear, comprar, recorte por tope, finalizar, reclamar, swap, cinta en
vivo, tablero, ranking, perfil, enlaces profundos, búsqueda por dirección y por enlace de
BscScan, logos de cada restaurante, tarjeta de regalo pagada en BNB, cualquier cripto,
inicio de sesión, comentarios, chino y móvil.

**Antes de mainnet (lista)**

1. `npm run test:contracts` en verde.
2. Desplegar en testnet y recorrer en la página con una wallet real: crear, comprar hasta el
   tope, finalizar por debajo del mínimo y reembolsar; crear otra, llenar el objetivo con
   varias wallets, finalizar, cambiar en PancakeSwap y reclamar.
3. Probar una recaudación pagada en un BEP-20 de prueba en testnet (`STOCK_TEST=0x...`) para
   cubrir `buyWith` y el pool en token.
4. Auditoría externa de los contratos: nadie la ha hecho y custodian dinero real. Hasta
   entonces la página lo avisa en la barra inferior.
5. Decidir `feeTo` (la comisión del 1 %) y quién guarda la clave del dueño de la factory.
6. Desplegar en mainnet (`FACTORY_56` o `/admin`), servir desde un dominio propio (dentro de
   claude.ai la wallet no se inyecta) y verificar el código de los contratos en BscScan.
