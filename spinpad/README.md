# spinpad — launchpad con ruleta obligatoria

Launchpad donde **nadie elige a que activo lanza: lo elige la ruleta**. Rellenas los datos de la
coin, giras una vez, y el color que sale decide el activo subyacente al que queda atada:

| Color | Activo | Ticker |
| --- | --- | --- |
| azul | Meta | `META` |
| rojo | Tesla | `TSLA` |
| verde | Nvidia | `NVDA` |
| amarillo | Amazon | `AMZN` |

Un giro por lanzamiento. No se repite, no se edita despues.

Sin build, sin dependencias. HTML, CSS y JS a pelo.

## Estructura

```
index.html   la pagina entera: barra superior, cinta de ultimos lanzamientos, rey de la colina,
             tablero de coins, reglas, dudas, pie y el modal de creacion (formulario + ruleta + acta)
styles.css   el sistema de diseno (mat blanco, los cuatro colores, tipografia) y el responsive
app.js       la ruleta, la maquina de estados de los tres pasos, el tablero y el almacenamiento
```

## Abrirlo

Abre `index.html` directamente, o sirve la carpeta:

```bash
python3 -m http.server 8000     # y entra en http://localhost:8000
```

Se despliega soltando la carpeta en cualquier hosting estatico (Netlify, Vercel, GitHub Pages, S3,
Cloudflare Pages).

## La regla, y donde esta metida

Que no se pueda lanzar sin girar no es un aviso en la interfaz: esta comprobado en tres sitios
distintos de `app.js`, a proposito.

1. **El boton nace apagado.** `#launch` sale con `disabled` en el HTML.
2. **La maquina de estados no llega al paso 3 sin giro.** `setStep(n)` recalcula que se puede tocar
   en cada paso: en el 1 solo el formulario, en el 2 solo el boton de girar, y `#launch` solo se
   enciende con `n === 3 && flow.spin`.
3. **`launch()` lo vuelve a mirar antes de escribir nada.** Si falta el giro, el borrador o el paso,
   escupe el mensaje, vuelve a sincronizar los botones y se va. Forzar `disabled = false` desde la
   consola y pulsar no lanza nada — esta probado.

Lo mismo con el segundo giro: `doSpin()` sale por la puerta si ya hay `flow.spin`, asi que llamarlo
a mano desde la consola tampoco cambia el color que toco.

**Descartar no es volver a girar.** `descartar` tira el borrador entero (nombre, ticker, suministro,
descripcion y el giro) y te devuelve a la casilla uno. Volver a editar solo existe *antes* de girar:
en cuanto la aguja arranca, ese boton desaparece.

## La ruleta

Dieciseis sectores de 22,5 grados: cuatro cuadrantes (mano derecha, pie derecho, pie izquierdo,
mano izquierda, en sentido horario desde las doce) con cuatro colores dentro de cada uno. El orden
de colores rota un puesto por cuadrante para que dos cuadrantes vecinos no empiecen igual.

- **El color manda**: decide el activo, y eso es lo unico que cambia la coin.
- **El cuadrante es la postura**: va en el acta como firma del giro y no toca ningun numero.

El sector sale de `crypto.getRandomValues` y no de `Math.random`. Se toma el modulo 16 de un
`Uint32`, y como 2^32 es multiplo de 16 el reparto queda plano sin sesgo de modulo: cada color
ocupa cuatro sectores exactos, el 25%. Medido con 80.000 tiradas: verde 24,68%, amarillo 25,34%,
azul 25,20%, rojo 24,77%.

La aguja gira de 5 a 7 vueltas mas lo que falte para caer en el centro del sector elegido, con un
margen aleatorio dentro del sector para que no se pare siempre en el mismo punto. El resultado se
resuelve en `transitionend`, con un `setTimeout` de respaldo: si cambias de pestana a mitad del
giro la transicion nunca termina y sin ese respaldo el giro se quedaria colgado.

## Diseno

El tablero es el mat: fondo blanco y cuatro columnas de puntos gordos —verde, amarillo, azul,
rojo— repetidas por detras de todo, al 17% de opacidad para que el texto siga leyendose. Es un
`body::before` fijo, cuatro capas de `radial-gradient` con el radio en pixeles; con el radio en
porcentaje el circulo se mide contra el tile entero y los puntos se convierten en franjas.

**Los cuatro colores estan reservados: solo significan los cuatro activos.** Por eso todo el
cromado —botones, chips, filtros, enlaces, numeros destacados— es negro tinta. En cuanto un boton
se pone rojo parece una coin de Tesla, y el codigo de color deja de querer decir nada.

Cada color lleva dos tokens, `--c` (el color) y `--on` (lo que se lee encima). El amarillo
`#FDD208` con texto blanco no llega ni a 1,6:1, asi que sobre amarillo el texto baja a tinta y
sobre los otros tres sube a blanco.

Tipografia: **Inter** para todo y **JetBrains Mono** para tickers, cifras, etiquetas y botones.

## Los datos

- **Todos los numeros son inventados.** La capitalizacion, las respuestas, el progreso de la curva
  y el saldo `0 SOL` de la barra son de adorno; el tablero y el pie lo dicen.
- Las coins viven en `localStorage` bajo `spinpad.coins.v1`, con tope de 60. Lectura y escritura
  van envueltas en `try/catch`: un navegador que bloquee el almacenamiento sigue funcionando, solo
  que en memoria.
- Las cinco primeras coins son de ejemplo y salen marcadas con la etiqueta `demo`. Se siembran una
  sola vez, cuando la clave no existe: si vacias el tablero, se queda vacio.
- El tablero se vuelve a pintar cada minuto para que los "hace 3 min" no se queden congelados.

## Antes de poner esto en serio

- **No hay cadena, ni contrato, ni dinero.** Es un simulacro completo de la mecanica, no un
  launchpad. El sitio por donde entraria un backend de verdad es `launch()`: hoy construye el
  objeto de la coin y lo mete en el array; ahi es donde iria la llamada que despliega, y el acta
  del giro (color, cuadrante, hora, id) es justo lo que habria que firmar y guardar junto al
  token para que la regla sea auditable y no solo una promesa de la interfaz.
- Meta, Tesla, Nvidia y Amazon se usan aqui como etiquetas de una demo. Atar un token al precio de
  una accion real tiene consecuencias regulatorias serias en casi cualquier pais: eso hay que
  mirarlo antes de lanzar nada, no despues.
- La mecanica es un homenaje al juego de la ruleta de colores. **Twister es una marca de Hasbro** y
  este proyecto no esta asociado a ella; por eso el producto se llama spinpad y en ninguna parte de
  la interfaz aparece la marca.
