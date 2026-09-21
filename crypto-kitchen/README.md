# Crypto Kitchen — el juego

Un juego de cocina estilo **Cooking Fever / Cooking Festival** en el que los clientes pagan en
crypto. Entran con un pedido, tú cocinas en las estaciones, emplatas en el pase y sirves; cada
pedido completo se cobra en la moneda que lleva el cliente (USDC, DOGE, SOL, ETH o BTC) al precio
del mercado del juego, más propina si has sido rápido.

Sin build ni dependencias: HTML, CSS y JS vanilla. Abre `index.html` o sirve la carpeta:

```bash
python3 -m http.server 8000     # y abre http://localhost:8000
```

## Cómo se juega

1. **Bandeja** — toca el botón de una estación (o pulsa `1`–`5`) para poner un plato a cocinar en
   un hueco libre. Cada estación hace un plato: parrilla → 🍔, freidora → 🍟, bebidas → 🥤,
   sartén → 🥩, horno → 🍕.
2. **Emplatar** — cuando el hueco brilla en verde, tócalo y el plato pasa al **pase**. Si lo dejas,
   se quema (la barra se pone roja antes) y hay que tocarlo para tirarlo. Los refrescos no se
   queman.
3. **Servir** — toca al cliente (o la barra espaciadora) y recibe todo lo que le falte que haya en
   el pase; o toca un plato del pase y va al primer cliente que lo pidió. Los platos que alguien
   quiere y los clientes a los que ya puedes servir brillan en verde.
4. **Cobrar** — con el pedido completo, el cliente paga: suma de precios × multiplicador de la
   moneda (USDC ×1 … BTC ×1.6, las ballenas 🐋) × 2 si esa moneda está *pumpeando*, más propina
   (30% si le queda más del 60% de paciencia, 15% si más del 30%). Si la paciencia llega a cero se
   va sin pagar.

Cada nivel tiene un **objetivo en dólares** y un reloj: 1 estrella al llegar, 2 con ×1.3 y 3 con
×1.6. `Esc` o `P` pausan; al ocultar la pestaña se pausa solo.

## Estructura

```
index.html   las pantallas: título, mapa de niveles, juego (HUD, mercado, sala, pase,
             cocina, overlay), tienda y cartera
styles.css   el escenario escalado, la paleta y todo el chrome (paneles, botones,
             monedas, estaciones, clientes) más la variante vertical
game.js      datos (monedas, platos, estaciones, mejoras, niveles), guardado, sonido,
             mercado, el bucle del juego, la tienda y la cartera
```

## El escenario

Todo el juego vive en un `.stage` de tamaño fijo — **960×640** en horizontal, **480×820** en
vertical (`fit()` en `game.js` elige según el viewport) — que se escala con `transform` para
encajar en la pantalla. Así la disposición es idéntica en todos los dispositivos y los toques
funcionan igual. En vertical las estaciones pasan a dos columnas (la parrilla ocupa la fila) y
`data-n` en `.kitchen` agranda los huecos cuando hay pocas estaciones abiertas.

## Datos (`game.js`)

- `COINS` — precio base, volatilidad, multiplicador de pago y color. El mercado hace un paseo
  aleatorio cada 2 s y cada 18–30 s una moneda *pumpea* 9 s (×2 al cobrar en ella).
- `DISHES` / `STATIONS` — emoji, precio, estación; huecos, tiempo de cocción y tiempo hasta
  quemarse.
- `UPGRADES` — mejoras permanentes de la tienda (huecos, velocidad, pase, paciencia, propina);
  `applyUpgrades()` recalcula los valores efectivos en `U`.
- `LEVELS` — objetivo, tiempo, carta, tamaño máximo de pedido, cadencia de llegada, paciencia
  y las monedas (repetir una la hace más frecuente). Diez niveles.

El guardado (`ck-game` en `localStorage`, con `try/catch`) tiene caja en dólares, cartera por
moneda, estrellas por nivel, mejoras compradas y estadísticas. La comida es emoji a propósito:
se ve en todas partes sin carpeta de assets. El sonido son blips de `AudioContext`, con
interruptor en el HUD.

Nada va a una cadena real: la "crypto" es del juego y vive en el navegador.
