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
| `DATA_DIR` | carpeta del fichero de estado `launchpad.json` | `./data` |
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

## Bento Launch (dapp en BNB Chain)

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

```bash
npm install
npm run compile                                  # contracts/build/*.json
PRIVATE_KEY=0x... npm run deploy -- testnet      # registra todos los restaurantes en tBNB
PRIVATE_KEY=0x... npm run deploy -- mainnet      # registra los 18 pares de pairs.json
```

Pega la dirección de `BentoFactory` en `NETWORKS[97].factory` (o `[56]`) de `dapp/index.html`
y sirve la carpeta `dapp/` desde cualquier host estático. `#mainnet` en la URL cambia a la red
principal. Dentro de claude.ai (iframe aislado) la wallet puede no inyectarse: entonces hay que
abrir la página desde su propio dominio. En testnet los tokens de acciones no existen, así que
las coins se pagan en tBNB (o en un ERC20 de prueba con `STOCK_TEST=0x...`).

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
- Las fotos de los restaurantes no se pueden obtener legalmente de forma automática: la página
  usa los logotipos oficiales y, si quieres fotos reales, hay que aportarlas y colocarlas en
  `dapp/logos/<id>.png`.

**Pruebas**

```bash
npm run test:contracts   # 28 comprobaciones de los contratos en una EVM en proceso
```

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
6. Desplegar en mainnet, pegar la dirección de la factory en `NETWORKS[56].factory`, servir
   `dapp/` desde un dominio propio (dentro de claude.ai la wallet no se inyecta) y
   verificar el código fuente de la factory en BscScan.
