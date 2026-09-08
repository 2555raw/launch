# Tricker Terminal

Plataforma de análisis de mercados: acciones, ETFs, índices, criptomonedas, materias
primas y divisas. Sin paso de compilación: HTML, CSS y módulos ES nativos, igual que
el resto del repositorio.

## Regla que gobierna el proyecto

**Ningún dato se inventa.** Si el proveedor no devuelve un campo, la interfaz muestra
`Datos no disponibles`. No hay valores de relleno, ni estimaciones disfrazadas de dato,
ni cifras de ejemplo. Por eso la aplicación arranca vacía hasta que se configura una
fuente: es el comportamiento correcto, no un fallo.

El análisis está siempre separado del dato y etiquetado como interpretación. Nunca
afirma que algo subirá o bajará: plantea escenario base, positivo y negativo, y nombra
los factores a vigilar.

## Arrancar

```bash
python3 -m http.server 8000      # y abrir http://localhost:8000/terminal/
```

Luego, botón **Fuente de datos** en la barra lateral: elegir proveedor y pegar la clave.
La clave se guarda solo en el navegador (`localStorage`), nunca en el repositorio.

Para inyectarla desde el servidor en lugar de a mano, define antes de cargar `app.js`:

```html
<script>window.TRICKER_CONFIG = { provider: 'fmp', apiKey: '…', logoToken: '…' };</script>
```

## Logos

Regla: **siempre el logo oficial de la entidad, nunca uno dibujado, generado o aproximado.**

Cada entidad del registro lleva su dominio oficial (`nvidia.com`, `youtube.com`,
`amazon.com`). `js/logos.js` resuelve el logo en tiempo de ejecución a partir de ese
dominio contra el proveedor configurado, con un segundo resolutor de reserva. No hay
copias de logos en el repositorio, así que no pueden quedarse obsoletas ni divergir
entre pantallas.

Todas las pantallas construyen el logo llamando a `logoEl()`, y solo a esa función. Por
eso una empresa no puede aparecer con un logo en el buscador y otro en el comparador.

Si ningún resolutor responde, la reserva es un monograma neutro con las iniciales de la
entidad. Nunca el logo de otra empresa, nunca un emoji.

Con `logoToken` configurado se usa el proveedor de logos de pago (mejor cobertura y
resolución). Sin token se usa el de reserva, que resuelve por dominio sin clave.

## Arquitectura

```
index.html            el armazón: barra lateral, buscador global, contenedor de vistas
styles.css            sistema de diseño (tokens, componentes, tema claro y oscuro)
js/registry.js        IDENTIDAD: nombre, ticker, mercado, sector, país y dominio oficial
js/config.js          proveedor y claves, leídos del host o del navegador
js/http.js            una sola puerta de salida: timeout, caché y errores con nombre
js/logos.js           el sistema de logos descrito arriba
js/format.js          formato y el centinela NA, para que "sin dato" nunca parezca un cero
js/providers/model.js la forma interna que todo proveedor normaliza
js/providers/fmp.js   adaptador de Financial Modeling Prep
js/providers/finnhub.js adaptador de Finnhub
js/analysis.js        el analista: resumen, finanzas, valoración, crecimiento, riesgos,
                      catalizadores y conclusión por escenarios
js/chart.js           gráfico en canvas con rangos, volumen y crosshair
js/search.js          buscador global tolerante a erratas, tickers y marcas comerciales
js/ui/components.js   piezas reutilizables (cabecera, métricas, tablas, noticias, análisis)
js/app.js             enrutado y páginas
```

### Añadir un proveedor

Crear `js/providers/<nombre>.js` exportando `id`, `label`, `site` y las funciones
`quote`, `profile`, `fundamentals`, `history`, `news` y `peers`, cada una devolviendo la
forma de `providers/model.js`. Registrarlo en `js/providers/index.js`. Nada más de la
aplicación necesita cambiar: la interfaz solo conoce el modelo interno.

### Añadir un activo

Una fila en `js/registry.js` con nombre legal, nombre corto, ticker, mercado, sector,
país, moneda, dominio oficial y alias de búsqueda. Aparece automáticamente en el
buscador, en su listado de mercado, en sectores y con su logo oficial.

Las marcas que no cotizan por separado (YouTube, Instagram, Zara) van en `BRANDS`, con
su propio dominio para su propio logo y el ticker de la matriz.

## Qué falta

- Flujo global de noticias e indicadores económicos: las páginas existen y esperan al
  proveedor.
- Fundamentales históricos por año en tabla: hoy se muestran los últimos doce meses.
- Deuda, caja y flujo de caja libre quedan como no disponibles en el adaptador de FMP:
  el endpoint gratuito devuelve la métrica por acción, que no es la misma cifra, y se
  prefiere decir que no hay dato antes que mostrar una equivalencia falsa.
