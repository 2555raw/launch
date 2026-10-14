# Tricker Launchpad — lanzamientos pareados a restaurantes

Un launchpad donde cada lanzamiento va **pareado a una cadena de restaurantes o a un sitio
donde pedir comida, y a la acción de su matriz**: TACO/YUM, BK/QSR, MCD/MCD, EATS/UBER. Sólo
entran marcas que cotizan, porque sin acción no hay par; Subway, Chick-fil-A o Dunkin' no
están por eso.

Funciona de verdad: hay servidor, API, estado persistente, identidad por wallet y cotizaciones
reales. Lo que **no** hace es mover dinero: una aportación es un compromiso registrado a nombre
de una cartera, y la página lo dice. La liquidación on-chain no está conectada.

Sin paso de compilación en el cliente: HTML, CSS y JS a secas. El servidor es Node con una
dependencia (`@solana/web3.js`, para hablar con la cadena y verificar firmas).

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

## Sol Bite (dapp en Solana)

`dapp/index.html` es la interfaz principal: un launchpad de coins en **Solana** donde cada
coin se crea **pareada a la acción tokenizada de un restaurante**, más una tienda de tarjetas
de regalo. Página estática (HTML, CSS y JS con `@solana/web3.js` desde jsDelivr) que habla
con el programa a través de la wallet del usuario (Phantom, Solflare o Backpack) y con el
servidor para indexar, construir instrucciones y hacer de proxy RPC.

**Qué significa pareada.** La recaudación de cada coin se paga en el token que representa la
acción del restaurante en Solana (McDonald's = MCDx, Starbucks = SBUXx, Chipotle = CMGx,
Uber = UBERon…), y al graduarse abre un pool COIN/ACCIÓN dentro del propio programa con la
liquidez bloqueada. `contracts/pairs.solana.json` lista los 17 pares verificados en cadena
(mints Token-2022 con su extensión de metadatos: nombre, símbolo, decimales, supply) el 14 de
octubre de 2026, con emisor (xStocks de Backed, Ondo Global Markets) y mint. Wendy's queda
fuera porque bStocks sólo existe en BNB Chain. En devnet no hay acciones, así que las coins
se pagan en SOL.

**Programa** (`contracts/solana`, Rust nativo sin Anchor, sin auditar; id
`GuN42keYrbBSgthwZJgw8oEEc4QCzzCnaSQdsQZut2Ub`):

- `InitConfig(feeTo)` (una vez, el que lo llama es el admin) y `SetFeeTo`.
- `Create(name, symbol, restaurant, target, duration)`: crea el mint de la coin (1.000.000.000,
  6 decimales, autoridad = la PDA de la recaudación) y la cuenta `Raise` pagada en SOL o en
  el mint de la acción (Token o Token-2022, vía `TransferChecked`).
- `Buy(amount)`: tope por cartera = objetivo/10; al llegar al objetivo la ventana cierra; el
  exceso se recorta. Cada compra deja un log `bought <cantidad> total <recaudado>` que el
  servidor indexa.
- `Finalize`: si se alcanzó el mínimo (objetivo/3), el 1 % va a `feeTo` y el 20 % del supply
  más el resto de lo recaudado forman el pool de producto constante del propio programa
  (no hay LP tokens: la liquidez no se puede retirar). Si no, `Refund` devuelve el 100 %.
  `Claim` reparte el 80 % restante en proporción a lo aportado.
- `Swap(amountIn, minOut, coinToPay)`: cambia contra el pool con un 1 % de comisión que se
  queda en el pool.

`chain/solbite.js` es el espejo en JavaScript (layouts, PDAs, constructores de instrucciones,
cotización del swap) que usan el servidor y las pruebas. `npm run test:program` compila las
dos variantes (`fast` baja la duración mínima a 3 s para probar plazos), arranca
`solana-test-validator` y recorre 34 comprobaciones: config, recaudación en Token-2022,
recorte por tope, cierre anticipado, graduación con comisión y pool, claim, swap en los dos
sentidos, recaudación en SOL, devolución por no llegar al mínimo y graduación al vencer.

**Desplegar y conectar**

```bash
cd contracts/solana
cargo-build-sbf                                   # target/deploy/sol_bite.so
solana config set --url devnet && solana airdrop 2
solana program deploy target/deploy/sol_bite.so --program-id target/deploy/sol_bite-keypair.json
```

Después `PROGRAM_ID_DEVNET=…` (o `PROGRAM_ID` para mainnet) en el entorno, o pegar el id en
`/admin` → **Launchpad**, que lo guarda en el almacén y la página lo usa al momento. La
config del programa (destino de la comisión) se inicializa una vez con
`node contracts/solana/init.js --cluster devnet --fee-to <wallet>` usando la clave de
`~/.config/solana/id.json` (o `--keypair`). `CLUSTER` fuerza la red por defecto (`devnet` o
`mainnet-beta`); si no, es mainnet cuando hay `PROGRAM_ID` y devnet en caso contrario.
`#devnet` o `#mainnet` en la URL cambian de red. `RPC_URL` y `RPC_URL_DEVNET` apuntan a tu
nodo (por defecto los públicos de Solana, con límite de peticiones). Dentro de claude.ai
(iframe aislado) la wallet puede no inyectarse: entonces hay que abrir la página desde su
propio dominio.

**Lo que sirve el servidor para la página**

- `POST /api/rpc?cluster=` proxy JSON-RPC con lista blanca de métodos (saldos, cuentas,
  blockhash, estado de firmas, envío de transacciones), para que la página no dependa de un
  nodo público desde el navegador.
- `GET /api/coins`, `/api/coins/:raise?buyer=`, `/api/coins/:raise/buys`, `/api/feed`,
  `/api/buys?wallet=`: índice de las cuentas `Raise` del programa (`getProgramAccounts`
  con caché) y de las compras (firmas de cada recaudación, logs del programa).
- `GET /api/coins/ix/(create|buy|finalize|claim|refund|swap)?wallet=…`: devuelve la
  instrucción lista para firmar (claves y datos en base64); la página la mete en una
  transacción, la firma con la wallet y espera la confirmación consultando el estado de la
  firma (sin websocket).
- `GET /api/prices` y `GET /api/chart?cg=<id>&days=1|7|30`: CoinGecko con caché.
- `GET /api/pool?raise=`: precio, liquidez y capitalización del pool de una coin graduada,
  muestreado para el gráfico.
- Rutas con metadatos propios: `/`, `/gifts`, `/coins`, `/launch`, `/docs`, `/pairs`,
  `/account`, `/r/<id>`, `/gift/<id>`, `/coin/<cluster>/<raise>`, `/u/<wallet>` sirven la
  misma página con su `<title>`, descripción, Open Graph y canonical; `/sitemap.xml`,
  `/robots.txt`, `/manifest.webmanifest`, `/sw.js` (PWA). Todo con gzip.

**Qué hace la página además de comprar**

- Precio en USD junto a cada cantidad (SOL y acciones por CoinGecko, caché de 2 minutos).
- Página por coin con enlace compartible (`#coin/devnet/<raise>`, `#r/mcdonalds` para un
  restaurante), gráfico de la recaudación, lista de compras con enlace a Solscan, swap
  contra el pool una vez graduada, comentarios, alertas por email e imagen para compartir.
- Cinta de compras en vivo en la portada, ranking, calendario, perfil por wallet.
- Buscador que acepta una dirección base58 o un enlace de Solscan y abre esa coin o ese token.
- Inicio de sesión firmando un mensaje con la wallet (ed25519, sin gas).
- Fotos reales de Wikimedia Commons (licencias CC, créditos en la página) y logotipos
  oficiales en `dapp/logos/<id>.png`; desde `/admin` se pueden subir fotos propias.

**Tienda de tarjetas de regalo (compra dentro de la web)**

`gifts.js` + `services/` convierten la web en una tienda: el visitante elige marca y valor,
pone el email del destinatario y un mensaje, elige cómo pagar, y recibe el código en la
página, por email y en su cuenta. Nada se simula: sin proveedor configurado las tarjetas
aparecen como «no disponibles» y enlazan a Bitrefill.

Flujo: `POST /api/gifts/checkout` crea el pedido (`pending`) → el pago se confirma en el
servidor (transacción en Solana verificada por RPC, IPN firmado de NOWPayments o webhook
firmado de Stripe) → `paid` → se compra la tarjeta por API de Bitrefill con el saldo de la
cuenta (`processing`) → `delivered` con el código, o `failed` (el admin puede reintentar o
marcar `refunded`). Estados: pending, paid, processing, delivered, failed, expired, refunded.

| Variable | Qué activa |
| --- | --- |
| `BITREFILL_API_KEY` (o `_ID` + `_SECRET`) | suministro: compra real de tarjetas con el saldo de tu cuenta Bitrefill |
| `MERCHANT_ADDRESS` | pago con wallet en Solana (SOL o USDC, con referencia de Solana Pay) a tu dirección |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | pago con cualquier cripto (300+ monedas); `NOWPAYMENTS_SANDBOX=1` para el sandbox |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | pago con tarjeta (Stripe Checkout alojado; claves `sk_test_` para pruebas) |
| `RESEND_API_KEY`, `MAIL_FROM` | envío del código por email (Resend) |
| `ADMIN_KEY` | panel `/admin` y API `/api/admin/*` (cabecera `x-admin-key`, comparación en tiempo constante) |
| `SITE_URL`, `BRAND_NAME`, `GIFT_MARGIN`, `GIFT_TEST` | URL pública (callbacks), marca, margen (0.04 = 4 %), producto de prueba de Bitrefill |
| `GIFT_WALLET_DISCOUNT`, `GIFT_REF_SHARE`, `SUPPORT_EMAIL`, `X_URL` | descuento al pagar con wallet (0.02), parte del margen para referidos (0.25), buzón de soporte, perfil de X |
| `PROGRAM_ID`, `PROGRAM_ID_DEVNET`, `CLUSTER`, `RPC_URL`, `RPC_URL_DEVNET`, `COINGECKO_API_KEY` | id del programa por red, red por defecto, nodos RPC, clave demo de CoinGecko |

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
  referidos (`?ref=<wallet>`, `GIFT_REF_SHARE` = 25 % del margen, `/api/me/referrals`, pagos
  anotados desde `/admin` → Community).
- Launchpad: perfil público por wallet (`/u/<wallet>`), ranking (`/leaderboard`), calendario de
  cierres (`/calendar`), simulador de tokens en la ficha, imagen para compartir (Web Share o
  descarga), precio del pool tras graduar (`/api/pool`, con histórico), swap contra el pool, comentarios por
  coin firmados con la wallet (`/api/comments/:addr`), alertas por email (`/api/alerts`: al
  graduar, al abrir reembolsos y 2 h antes de cerrar; un job cada 2 min lee la cadena y
  envía con Resend), titulares de prensa por restaurante (`/api/news`, Google News RSS).
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
4. Programa desplegado en devnet primero (`solana program deploy`), config inicializada
   (`node contracts/solana/init.js`) y su id en `/admin` → Launchpad o en `PROGRAM_ID_DEVNET`.
5. Dominio propio (`SITE_URL`) y perfil de X (`X_URL`).
6. Auditoría del programa antes de mainnet.

**Pruebas**

```bash
npm test                 # API del servidor
npm run test:gifts       # tienda y comunidad: 47 comprobaciones con proveedores simulados
npm run test:program     # 34 comprobaciones del programa en un solana-test-validator local
npm run test:dapp        # la página en Chromium contra una wallet y una tienda simuladas
```

`.github/workflows/launchpad.yml` ejecuta los cuatro en cada push (el del programa instala la
CLI de Solana en el runner). El harness del navegador
(`tools/dapp-harness.js`) necesita Playwright (`npx playwright install chromium`).

`contracts/solana/test.js` y `test-deadline.js` recorren el programa en un validador local:
config, recaudación pagada en un mint Token-2022 (tope por cartera, recorte, cierre
anticipado al llegar al objetivo), graduación (1 % de comisión, pool de producto constante),
claim del 80 %, swap en los dos sentidos con comprobación de la cotización, recaudación en
SOL, cierre por debajo del mínimo con reembolso y graduación al vencer el plazo.

La página se probó en Chromium contra una wallet Phantom simulada y un servidor que imita
el programa: conectar, crear, comprar, recorte por tope, finalizar, reclamar, swap, cinta
en vivo, ranking, perfil, enlaces profundos, búsqueda por dirección y por enlace de Solscan,
tarjeta de regalo pagada en SOL, cualquier cripto, inicio de sesión, comentarios, chino y
móvil.

**Antes de mainnet (lista)**

1. `npm run test:program` en verde.
2. Desplegar en devnet y recorrer en la página con una wallet real: crear, comprar hasta el
   tope, finalizar por debajo del mínimo y reembolsar; crear otra, llenar el objetivo con
   varias wallets, finalizar, cambiar contra el pool y reclamar.
3. Probar una recaudación pagada en un mint Token-2022 de prueba en devnet (crear uno con
   `spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) para
   cubrir `TransferChecked` y el pool en token.
4. Auditoría externa del programa: nadie la ha hecho y custodia dinero real. Hasta entonces
   la página lo avisa en la barra inferior.
5. Decidir `feeTo` (la comisión del 1 %) con `InitConfig` y quién guarda la clave admin.
6. Desplegar en mainnet (`PROGRAM_ID` o `/admin`), servir desde un dominio propio (dentro de
   claude.ai la wallet no se inyecta) y publicar el código verificable del programa.
