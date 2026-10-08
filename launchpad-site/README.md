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
