# BTC Bot: Binance contra Polymarket (simulación)

Un bot que hace lo que contaba el post viral, pero en serio y **sin dinero real**:

1. Recibe el precio de BTC/USDT de Binance en tiempo real por WebSocket (varias veces por segundo).
2. Encuentra todos los mercados de BTC abiertos en Polymarket (más de 100 en las próximas 6 horas).
3. Calcula la probabilidad justa de cada uno a partir del precio actual y la volatilidad.
4. Cuando alguien vende más barato de lo que vale (después de comisiones), **simula** la compra.
5. Al cerrar el mercado, liquida la posición con el resultado oficial de Polymarket y apunta ganancias y pérdidas.
6. Lo enseña todo en un panel web que puedes abrir en el iPad.

> **Es paper trading.** El bot no tiene claves, no firma órdenes y no puede mover dinero. Ver "Antes de pensar en dinero real" abajo.

## Arrancarlo

Necesitas Node.js 22 o más nuevo. No hay dependencias que instalar.

```bash
cd btc-bot
npm start
```

Abre http://localhost:3000. Para usar el iPad como segunda pantalla, conéctalo al mismo wifi y abre `http://<IP-de-tu-ordenador>:3000`.

Otros comandos:

```bash
npm test                  # tests del modelo
npm run backtest          # contrasta el modelo con las últimas 12 h de mercados ya resueltos
node src/backtest.mjs 24  # ... o las últimas 24 h
```

La cuenta simulada se guarda en `data/state.json`. Bórralo para empezar de cero.

## Tenerlo funcionando 24/7 en Railway

`railway.json` ya trae el comando de arranque, el healthcheck (`/health`) y el reinicio automático. En Railway:

1. Crea un servicio desde el repo `2555raw/launch` y pon como **Root Directory** `/btc-bot`.
2. Añade un **volumen** montado en `/data` y la variable `STATE_FILE=/data/state.json`, para que la cuenta simulada no se borre en cada despliegue.
3. Región: Europa (`europe-west4`). Los servidores de Polymarket están en Londres, así que cuanto más cerca, menos retraso.
4. Genera un dominio y ábrelo desde el iPad o el móvil.

## Qué mercados entiende

| Tipo | Ejemplo | Cómo se resuelve | Modelo |
|---|---|---|---|
| `5m` / `15m` / `4h` | "Bitcoin Up or Down, 12:30-12:45 ET" | TWAP de 60 s de Chainlink al final ≥ TWAP de 60 s al inicio | media de un paseo aleatorio |
| `1h` | "Bitcoin Up or Down, 1PM ET" | cierre de la vela de 1 h de Binance ≥ apertura | precio en un instante |
| `encima` | "Bitcoin above 83,800 at 1PM ET?" | cierre de la vela de 1 h de Binance > precio fijado | precio en un instante |

La interpretación de los mercados TWAP la comprobé con 120 mercados ya resueltos (80 de 5 minutos y 40 de 15) usando datos de Binance: **coincidió en los 120**.

## Cómo decide

Para cada mercado activo, cada segundo:

- **Probabilidad justa**: precio actual frente al de referencia, la volatilidad de las últimas 3 horas (velas de 1 minuto) y el tiempo que queda. En los TWAP también cuenta la parte de la media que ya se ha formado.
- **Ventaja** = probabilidad − precio de compra − comisión. La comisión se lee de cada mercado (`feeSchedule`) y se calcula con la fórmula más cara de las dos posibles.
- **Compra** si la ventaja es de al menos 4 céntimos por acción (`MIN_EDGE`), el precio está entre 5 y 95 céntimos, quedan al menos 20 segundos y aún no tiene ese mercado.
- **No compra** si la ventaja pasa de 25 céntimos (`MAX_EDGE`). Una "oportunidad" tan grande casi siempre es un dato malo o un fallo del modelo.
- **Tamaño**: el 5% del efectivo, con un máximo de $25 por operación. Recorre el libro de órdenes nivel por nivel mientras la ventaja se mantenga.

Todo se ajusta con variables de entorno (ver `src/config.mjs`):

```bash
MIN_EDGE=0.06 STAKE_PCT=0.02 START_BANKROLL=500 npm start
```

## Lo que el backtest dice, y lo que no

Con las últimas 12 horas (188 mercados de 5 y 15 minutos), el modelo predijo mejor que el precio de Polymarket (Brier 0,134 frente a 0,142) y operar sus diferencias habría dado un +19%.

**No te lo creas todavía**. El backtest es optimista a propósito:

- Usa el precio medio histórico de Polymarket, guardado una vez por minuto, que puede ir retrasado. El libro de órdenes real se mueve en milisegundos.
- Supone que te llenan al precio que ves. En la realidad compites con bots en servidores al lado del exchange, y las ofertas buenas desaparecen antes de que llegues.
- 12 horas son muy poco. Un mercado tranquilo y uno nervioso dan resultados muy distintos.

Ajustar el modelo también sirvió para algo: subir la volatilidad un 25% "por prudencia" hacía que el bot comprara apuestas baratas que valían menos de lo que pagaba, y se comía casi toda la ventaja. Por eso el modelo usa ahora la volatilidad medida tal cual.

La prueba de verdad es dejar el bot en simulación **varios días** con libros de órdenes reales y ver si `P&L` sigue a `P&L esperado`. Si la ganancia real queda muy por debajo de la esperada, la ventaja no existe.

## Antes de pensar en dinero real

- **Que sea legal donde vives.** Polymarket bloquea varios países (`restricted: true` en sus mercados), y Binance bloquea otros. Mira las condiciones de tu país.
- **Semanas de simulación con beneficio estable**, no un buen día.
- **Velocidad.** Esto consulta el libro cada 1,5 segundos por HTTP. Para competir en serio harían falta el WebSocket de Polymarket y un servidor cerca de sus servidores.
- **Que nadie te venda "el setup exacto".** Si un post te ofrece un bot gratis a cambio de seguirle o escribirle por DM, lo normal es que el código robe tus claves o tu wallet. No pegues nunca una clave privada ni una API key con permiso de retirada en código que no hayas leído.

Nadie convierte $68 en $750.000 con esto. Si hay ventaja, es de pocos céntimos por operación y desaparece en cuanto la descubren otros.
