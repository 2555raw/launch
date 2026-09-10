# Warp

Mercado de perpetuos de indices. Agrupas de tres a cinco activos —acciones,
metales, criptomonedas o ETFs— en un cesto de peso fijo, lo listas como indice
con su simbolo, y cualquiera puede ponerse largo o corto sobre el con hasta 5x,
liquidado en USDG. Quien lista un indice se queda el 30 % de las comisiones que
pague cada operacion abierta sobre el.

Sin paso de compilacion: HTML, CSS y modulos ES nativos, igual que el resto del
repositorio.

## La regla que gobierna el proyecto

**Ningun precio de esta aplicacion es real, y la aplicacion lo dice en voz alta.**

Warp es un mercado de practica. El precio de cada activo lo produce el simulador
de `js/market.js`, no un proveedor de mercado. Por eso el aviso esta en la
cabecera de todas las pantallas y en el pie de todas, y no en la letra pequena:
un numero que parece una cotizacion y no lo es hace mas dano que un hueco vacio.

La distincion que se mantiene en todo el codigo es esta:

- **Simulado**: precio, variacion, volumen y profundidad. Son cifras del
  simulador. La interfaz las marca como `sim.` donde caben en una columna.
- **Real, dentro de los limites de la aplicacion**: tus posiciones, tu saldo, las
  comisiones que has pagado, las que has generado como creador y los indices que
  has listado. Eso ha ocurrido porque lo has hecho tu, asi que persiste en el
  navegador y se puede auditar.

Nada de esto es asesoramiento de inversion.

## Arrancar

```bash
python3 -m http.server 8000      # y abrir http://localhost:8000/warp-app/
```

No hay clave que configurar ni cuenta que crear. Arranca con 10 000 USDG de
practica y nueve indices ya listados por la cuenta demo de la casa. El boton
**Reiniciar cuenta** de la barra lateral lo devuelve todo al estado inicial.

## Probar

```bash
node warp-app/test/engine.test.mjs
```

Comprueba lo que no puede estar mal sin navegador: que el cesto arranque en su
base, que las aportaciones de las patas sumen la variacion del indice, que el
saldo cuadre despues de abrir, cerrar y cobrar, y que cada limite (patas,
apalancamiento, margen minimo, saldo, simbolo repetido) rechace lo que tiene que
rechazar.

## Las marcas: el logo real y el color real

Regla: **siempre la marca real de la entidad, nunca una dibujada, generada o
aproximada.**

Una empresa, un ETF o una criptomoneda tienen logo propio. Cada fila del registro
lleva su dominio oficial (`nvidia.com`, `lvmh.com`, `ethereum.org`) y
`js/logos.js` resuelve el logo de ese dominio en tiempo de ejecucion contra una
cadena de resolutores. No hay copias de logos en el repositorio, asi que no pueden
quedarse obsoletas ni divergir entre pantallas.

Un metal no tiene logo porque no es una empresa. Su marca es **su simbolo quimico
oficial escrito en el color real del metal**: Au en oro, Cu en cobre, Li en el gris
del litio. Eso no es un dibujo, es la notacion que usa la propia industria. Su
ficha nombra ademas el mercado que fija su precio (LBMA, LME, LPPM), que si tiene
logo propio.

Cada activo lleva tambien **su color de marca real**, el que usa la entidad. Ese
color no es decoracion: es lo que identifica su tramo en la barra de composicion
de un cesto, su porcion en la rueda de pesos, su linea en un grafico y su
pastilla de simbolo. Por eso el fondo de la aplicacion es blanco y se queda
blanco: sobre el blanco, el unico color con peso es el de las marcas.

Todas las pantallas construyen la marca llamando a `markEl()`, y solo a esa
funcion. Por eso un activo no puede aparecer con una marca en el buscador y otra
en el cesto.

El monograma se pinta desde el primer fotograma y el logo se carga encima, asi
que el hueco nunca esta en blanco mientras responde la red. Si ningun resolutor
responde, lo que queda es el monograma en el color de marca. Nunca el logo de
otra entidad, nunca un emoji.

Con `logoToken` configurado se usa el proveedor de logos de pago, que tiene mejor
cobertura y resolucion. Sin token se usan los de reserva, que resuelven por
dominio sin clave.

El icono de X de la barra lateral es cromo de interfaz, no la marca de un activo:
**todavia no tiene enlace**, asi que no es un enlace. Es un boton que dice que aun
no hay destino, en lugar de un ancla que no lleva a ninguna parte.

## Como funciona un indice

Un indice es un cesto de **peso fijo**. Al listarlo se congela el precio de cada
pata como referencia y el cesto arranca en base 100. Desde ese momento vale:

```
V(t) = 100 · Σᵢ wᵢ · Pᵢ(t) / Pᵢ(t₀)
```

No se rebalancea, asi que el cesto de hoy es exactamente el que se listo, y el
grafico mide exactamente lo que ha hecho desde entonces. La columna
**aportacion** de su ficha descompone esa variacion pata por pata: el movimiento
de cada una multiplicado por su peso, de modo que las aportaciones suman la
variacion del indice.

Las referencias viven en el propio indice (`refs`), no en el feed. Por eso listar
un indice nuevo no reescribe la historia de ninguno existente.

## Como funciona una posicion

Las reglas viven en `VENUE` (`js/config.js`), en un solo sitio, para que lo que
promete el panel de trading y lo que aplica el motor sean la misma regla:

| Regla | Valor |
| --- | --- |
| Patas por indice | 3 a 5 |
| Apalancamiento | 1x a 5x |
| Comision | 0,05 % del nocional, al abrir y al cerrar |
| Al creador del indice | 30 % de esa comision |
| Margen de mantenimiento | 0,5 % |
| Financiacion | 0,01 % base cada 8 h, escalada por el desequilibrio entre largos y cortos, topada en 0,075 % |

El precio de liquidacion sale de `liquidationPrice()`, y de esa misma funcion sale
el aviso del formulario y la liquidacion real: no pueden discrepar. La
financiacion se devenga con el tiempo al tipo vigente y ya va descontada del
resultado que muestra cada posicion.

Una posicion sin margen se liquida por la regla, no porque alguien mire la
pantalla: el latido de `js/app.js` pasa `liquidationSweep()` cada cinco segundos.
En una liquidacion se pierde el margen y no se cobra comision de cierre.

## Arquitectura

```
index.html              el armazon: barra lateral, buscador, aviso de simulacion, vistas
styles.css              sistema de diseno (tokens en :root, fondo blanco, componentes)
js/registry.js          IDENTIDAD: simbolo, nombre, clase, sector, color de marca y dominio
js/config.js            VENUE (las reglas del mercado) y la cadena de resolutores de logos
js/logos.js             el sistema de marcas descrito arriba
js/market.js            el simulador de precios y las matematicas del cesto
js/store.js             cartera, indices listados, posiciones e historial; una clave, un evento
js/engine.js            listar, validar, abrir, cerrar, financiar, liquidar y cobrar comisiones
js/format.js            formato y el centinela NA, para que "sin dato" nunca parezca un cero
js/chart.js             graficos en canvas: serie con cruz, linea minima y rueda de pesos
js/search.js            buscador tolerante a erratas, acentos y nombre comercial
js/ui/components.js     piezas reutilizables (identidad, tarjetas, tablas, cifras, avisos)
js/views.js             las pantallas
js/app.js               enrutado, buscador, reloj y el latido que liquida
test/engine.test.mjs    las reglas del mercado, comprobadas sin navegador
```

### Por que el simulador es una suma de ondas y no un paseo aleatorio

El precio de un activo en un instante es una suma de ondas de distinta escala,
con fase y amplitud sembradas a partir de su simbolo. Eso da tres propiedades que
un paseo aleatorio no da:

- **es reproducible**: la misma semilla da el mismo mercado en cada recarga y en
  cada pestana, asi que una posicion abierta ayer sigue teniendo sentido hoy;
- **es continuo**: no hay saltos entre recargas;
- **se evalua en cualquier instante en tiempo constante**, asi que el historico de
  un grafico no hay que guardarlo: se calcula.

La semilla se cambia en `config.seed`.

### Enchufar un proveedor real

`js/market.js` termina en `setFeed()`. La aplicacion nunca llama al simulador
directamente: llama a `spot`, `changePct`, `series` y `volume24h` a traves de
`feed`. Un proveedor real se enchufa sustituyendolas y poniendo
`isSimulated: false`, y entonces el aviso de la cabecera y el del pie dejan de
decir que el precio es simulado, porque ya no lo sera. Nada mas de la aplicacion
cambia.

### Anadir un activo

Una fila en `js/registry.js` con simbolo, nombre legal, nombre corto, clase,
sector, color de marca real y dominio oficial (o, si es un metal, su simbolo
quimico y su mercado). Un nivel de referencia en `REF` de `js/market.js`, que es
donde vive el precio. Aparece solo en el buscador, en su pestana de activos, en
el constructor de cestos y con su marca en todas las pantallas.

## Que falta

- Ordenes limitadas y stop: hoy solo hay orden a mercado.
- Cerrar parte de una posicion: hoy el cierre es entero.
- Rebalanceo opcional de un cesto: hoy el peso fijo es la unica modalidad, que es
  la que hace que el indice sea auditable sin guardar historia.
- El historial guarda las ultimas doscientas operaciones cerradas y descarta las
  anteriores.
