# Tricker Launchpad — lanzamientos pareados a restaurantes

Un launchpad donde cada lanzamiento va **pareado a una cadena de restaurantes o a un sitio
donde pedir comida, y a la acción de su matriz**: TACO/YUM, BK/QSR, MCD/MCD, EATS/UBER. Sólo
entran marcas que cotizan, porque sin acción no hay par; Subway, Chick-fil-A o Dunkin' no
están por eso.

Funciona de verdad: hay servidor, API, estado persistente, identidad por wallet y cotizaciones
reales. Lo que **no** hace es mover dinero: una aportación es un compromiso registrado a nombre
de una cartera, y la página lo dice. La liquidación on-chain no está conectada.

Sin paso de compilación en el cliente: HTML, CSS y JS a secas. El servidor es Node con una
dependencia (`ethers`, para verificar firmas).

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

## BNB Bite (dapp en BNB Chain)

`dapp/index.html` es una segunda interfaz, independiente del servidor de arriba: un launchpad
de coins en BNB Chain donde cada coin se crea **pareada a la acción tokenizada de un
restaurante**. Página estática (HTML, CSS y JS con ethers.js desde cdnjs) que habla con los
contratos a través de la wallet del usuario (MetaMask o cualquier wallet inyectada).

**Qué significa pareada.** El contrato de recaudación de cada coin se paga en el token que
representa la acción del restaurante en BNB Chain (McDonald's = MCDx, Starbucks = SBUXx,
Meituan = MEITx, Wendy's = WENB…), y al graduarse crea un pool COIN/ACCIÓN en PancakeSwap v2.
`contracts/pairs.json` lista los 18 pares verificados en cadena (nombre, símbolo, supply) el
12 de octubre de 2026, con emisor (xStocks de Backed, bStocks de Binance, Ondo Stocks) y
dirección. Los restaurantes sin acción tokenizada en BNB Chain (Luckin, Chagee, Guming, Yum
China, Chipotle sólo tiene CMGx…) no se pueden parear todavía.

**Contratos** (`contracts/BentoLaunch.sol`, sin auditar):

- `BentoFactory.setStocks(ids, tokens)` (sólo el dueño) registra el token de cada restaurante;
  `address(0)` significa pagar en BNB.
- `BentoFactory.createCoin(name, symbol, restaurantId, target, duration)` despliega un
  `BentoToken` (1.000.000.000 de supply) y un `BentoRaise` pagado en el token registrado.
- `BentoRaise.buyWith(amount)` (tras `approve`) o `buy()` en BNB; tope por cartera =
  objetivo/10; al llegar al objetivo la ventana cierra; el exceso se devuelve.
- `finalize()`: si se alcanzó el mínimo (objetivo/3), el 99 % de lo recaudado y el 20 % del
  supply van a un pool COIN/ACCIÓN (o COIN/BNB) y se queman los LP; el 1 % es la comisión
  (`feeTo`). Si no, `refund()` devuelve el 100 %. `claim()` reparte el 80 % restante.

**Desplegar y conectar**

La página pide al servidor `GET /api/config` (dirección de la factory por cadena, red por
defecto, enlaces sociales) y enruta por path (`/gifts`, `/coins`, `/r/mcdonalds`…), así que
no hay que reconstruir nada al desplegar la factory. Dos caminos:

- Desde `/admin` → **Launchpad**: con `DEPLOYER_KEY` en el servidor (una clave con tBNB del
  faucet para testnet), el panel enseña la dirección y el saldo del desplegador y un botón
  «Deploy factory» que despliega `BentoFactory`, registra los 18 restaurantes y guarda la
  dirección en el almacén. La página la usa al momento.
- Por línea de comandos:

```bash
npm install
npm run compile                                  # contracts/build/*.json
PRIVATE_KEY=0x... npm run deploy -- testnet      # registra todos los restaurantes en tBNB
PRIVATE_KEY=0x... npm run deploy -- mainnet      # registra los 18 pares de pairs.json
```

y luego `FACTORY_97=0x…` (o `FACTORY_56`) en el entorno. `DEFAULT_CHAIN` fuerza la red por
defecto; si no, es la primera que tenga factory. `#mainnet` o `#testnet` en la URL cambian de
red. Dentro de claude.ai (iframe aislado) la wallet puede no inyectarse: entonces hay que
abrir la página desde su propio dominio. En testnet los tokens de acciones no existen, así que
las coins se pagan en tBNB (o en un ERC20 de prueba con `STOCK_TEST=0x...`).

**Lo que sirve el servidor para la página**

- `GET /api/prices` y `GET /api/chart?cg=<id>&days=1|7|30`: CoinGecko con caché en el
  servidor (una petición por minuto para todos; con `COINGECKO_API_KEY` se usa la clave demo).
  La página prueba primero el servidor y, si no hay, va directa a CoinGecko y a Chainlink.
- Rutas con metadatos propios: `/`, `/gifts`, `/coins`, `/launch`, `/docs`, `/pairs`,
  `/account`, `/r/<id>`, `/gift/<id>`, `/coin/<chain>/<addr>` sirven la misma página con su
  `<title>`, descripción, Open Graph (foto del restaurante) y canonical; `/sitemap.xml` y
  `/robots.txt`. Todo con gzip. `X_URL` pone tu perfil de X en los enlaces.
- Fotos en WebP (`dapp/photos/*.webp`, créditos en `photos/credits.json`).

**Qué hace la página además de comprar**

- Precio en USD junto a cada cantidad (CoinGecko, caché de 2 minutos en el navegador; si la
  API falla se oculta y el BNB/USD sale del feed de Chainlink).
- Página por coin con enlace compartible (`#coin/56/0x…`, `#r/mcdonalds` para un restaurante),
  botón de copiar enlace, gráfico de la recaudación y lista de compras leídas de los eventos
  `Bought` del contrato (por rangos de 5000 bloques).
- Cinta de compras en vivo en la portada (eventos de los últimos 5000 bloques).
- Buscador que acepta una dirección `0x…` o un enlace de BscScan y abre esa coin o ese token.
- Iconos propios de categoría, marca propia, barra inferior en móvil, números en 万/亿 y
  textos de 打新 en chino.
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
| `MERCHANT_ADDRESS` | pago con wallet en BNB Chain (BNB o USDT) a tu dirección |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | pago con cualquier cripto (300+ monedas); `NOWPAYMENTS_SANDBOX=1` para el sandbox |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | pago con tarjeta (Stripe Checkout alojado; claves `sk_test_` para pruebas) |
| `RESEND_API_KEY`, `MAIL_FROM` | envío del código por email (Resend) |
| `ADMIN_KEY` | panel `/admin` y API `/api/admin/*` (cabecera `x-admin-key`, comparación en tiempo constante) |
| `SITE_URL`, `BRAND_NAME`, `GIFT_MARGIN`, `GIFT_TEST`, `BSC_RPC` | URL pública (callbacks), marca, margen (0.04 = 4 %), producto de prueba de Bitrefill, nodo |
| `GIFT_WALLET_DISCOUNT`, `GIFT_REF_SHARE`, `SUPPORT_EMAIL`, `X_URL` | descuento al pagar con wallet (0.02), parte del margen para referidos (0.25), buzón de soporte, perfil de X |
| `DEPLOYER_KEY`, `FACTORY_56`, `FACTORY_97`, `DEFAULT_CHAIN`, `COINGECKO_API_KEY` | clave para desplegar la factory desde /admin, direcciones de factory, red por defecto, clave demo de CoinGecko |

Webhooks a registrar en cada proveedor: `POST /api/webhooks/nowpayments` y
`POST /api/webhooks/stripe`. Rutas públicas: `GET /api/gifts/catalog`, `GET /api/gifts/currencies`,
`POST /api/gifts/checkout`, `GET /api/gifts/orders/:id`, `POST /api/gifts/orders/:id/tx`,
`POST /api/gifts/orders/:id/claim`, `GET /api/me/orders` (login por firma de wallet),
`GET /api/catalog`. Admin: resumen, pedidos, reintento de emisión, cambio de estado con nota,
reenvío de email, overrides del catálogo (nombre, foto subida, categoría, descripción,
ocultar) y registro de actividad.

`npm run test:gifts` recorre todo contra RPC, Bitrefill, NOWPayments, Stripe y Resend
simulados (44 comprobaciones: firmas de webhooks, entrega programada, descuento, referidos,
comentarios, alertas, newsletter, soporte y estado).

**Lo que hace además (todo probado)**

- Tienda: selector de país, entrega programada (el email sale a la hora elegida; el job de
  cada minuto lo envía), vista previa del email (`/api/gifts/preview`), descuento al pagar con
  wallet (`GIFT_WALLET_DISCOUNT`, 2 % por defecto), «guardar en mi cuenta» sin email,
  referidos (`?ref=0x…`, `GIFT_REF_SHARE` = 25 % del margen, `/api/me/referrals`, pagos
  anotados desde `/admin` → Community).
- Launchpad: perfil público por wallet (`/u/0x…`), ranking (`/leaderboard`), calendario de
  cierres (`/calendar`), simulador de tokens en la ficha, imagen para compartir (Web Share o
  descarga), precio en PancakeSwap tras graduar (`/api/pool`, con histórico), comentarios por
  coin firmados con la wallet (`/api/comments/:addr`), alertas por email (`/api/alerts`: al
  graduar, al abrir reembolsos y 2 h antes de cerrar; un job cada 2 min lee la cadena y
  envía con Resend), titulares de prensa por restaurante (`/api/news`, Google News RSS).
- Contenido: guías (`/guides/...`: comprar cripto, tarjeta con USDT, acciones tokenizadas,
  recaudación emparejada), estado público (`/status`, `/api/status`), ayuda con formulario
  (`/api/support`, reenviado a `SUPPORT_EMAIL`), newsletter (`/api/newsletter`, CSV en admin).
- App instalable (PWA): `manifest.webmanifest`, `sw.js` (página network-first, fotos en
  caché), iconos en `dapp/icons/`.
- Idiomas: inglés, español y chino, con las mismas 470 claves cada uno.

**Lo que falta para operar de verdad** (todo está programado; sólo faltan las credenciales):
1. Cuenta Bitrefill con API y saldo cargado.
2. Cuenta NOWPayments (API key + IPN secret) y/o Stripe (clave secreta + webhook).
3. Dominio verificado en Resend para los emails.
4. Factory del launchpad desplegada (testnet primero): enviar ~0,05 tBNB al desplegador que
   enseña `/admin` → Launchpad y pulsar «Deploy factory».
5. Dominio propio (`SITE_URL`) y perfil de X (`X_URL`).
6. Auditoría del contrato antes de mainnet.

**Pruebas**

```bash
npm test                 # API del servidor
npm run test:gifts       # tienda y comunidad: 44 comprobaciones con proveedores simulados
npm run test:contracts   # 28 comprobaciones de los contratos en una EVM en proceso
npm run test:dapp        # la página en Chromium contra una wallet y una tienda simuladas
```

`.github/workflows/launchpad.yml` ejecuta los cuatro en cada push. El harness del navegador
(`tools/dapp-harness.js`) necesita Playwright (`npx playwright install chromium`).

`contracts/test/run.js` compila `BentoLaunch.sol` y los mocks (`contracts/test/Mocks.sol`:
un token de acción y un router de PancakeSwap) y ejecuta en `@ethereumjs/vm` el ciclo
completo: restaurante no registrado, raise pagado en MCDx (tope por cartera, recorte,
cierre por debajo del mínimo y reembolso), raise que llega al objetivo y gradúa (99 % al
pool, 1 % de comisión, par COIN/MCDx, claim del 80 %), y raise pagado en BNB.

La página se probó en navegador contra una wallet simulada que responde a los mismos ABIs:
conectar, crear, aprobar MCDx, comprar, recorte por tope, finalizar, reclamar, eventos de
compra (gráfico, cinta en vivo), enlaces profundos, búsqueda por dirección, chino y móvil.

**Antes de mainnet (lista)**

1. `npm run test:contracts` en verde.
2. Desplegar en BNB Testnet (`npm run deploy -- testnet`) y recorrer en la página con una
   wallet real: crear, comprar hasta el tope, finalizar por debajo del mínimo y reembolsar;
   crear otra, llenar el objetivo con varias wallets, finalizar, comprobar el pool en
   PancakeSwap testnet y reclamar.
3. Repetir el flujo de token ERC20 con `STOCK_TEST=0x…` (un token de prueba) para cubrir
   `buyWith` y `addLiquidity`.
4. Auditoría externa de `BentoLaunch.sol`: nadie la ha hecho y el contrato custodia dinero
   real. Hasta entonces la página lo avisa en la barra inferior.
5. Decidir `FEE_TO` (la comisión del 1 %) y quién es dueño del registro de restaurantes.
6. Desplegar en mainnet desde `/admin` (o `FACTORY_56` en el entorno), servir desde un
   dominio propio (dentro de claude.ai la wallet no se inyecta) y verificar el código fuente
   de la factory en BscScan.
