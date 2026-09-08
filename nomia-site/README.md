# Nomia — site

Landing estática de **Nomia**, la vía de pago de los agentes autónomos: identidad por agente,
políticas de gasto y liquidación multi-riel en una sola API.

Sin build, sin dependencias. HTML, CSS y JS a pelo.

## Estructura

```
index.html   la página entera: tira de estado, héroe, cifras, cómo funciona, funciones,
             desarrolladores, panel, casos de uso, precios, preguntas, llamada final y pie
styles.css   el sistema de diseño (paleta, tipografía, retícula) y lo adaptable
app.js       tema, menú móvil, navegación por anclas, sección activa, pestañas de código,
             y la maqueta de gasto por agente
```

## Verlo

Abre `index.html` directamente, o sirve la carpeta:

```bash
python3 -m http.server 8000     # y abre http://localhost:8000
```

Se despliega dejando la carpeta en cualquier host estático (Netlify, Vercel, GitHub Pages,
S3, Cloudflare Pages).

## Diseño

Fondo casi negro con matiz frío, tipografía sobria de infraestructura financiera y **un solo
acento**: el verde eléctrico `#00E5A0`. El acento marca dinero en movimiento (cifras vivas,
estados en curso, la acción principal) y nada más; en cuanto se reparte por toda la página deja
de significar algo. En el tema claro baja a `#00B47E` para mantener el contraste sobre blanco.

| Token | Oscuro | Claro | Papel |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | `#07090C` / `#0A0D12` | `#F4F6F8` / `#ECEFF3` | fondo de página y bandas alternas |
| `--card` / `--card-hi` / `--surface` | `#0E1218` / `#131922` / `#161D26` | `#FFFFFF` / `#F7F9FB` / `#E8ECF1` | tarjetas, estado hover, pistas |
| `--ink` / `--prose` / `--muted` / `--dim` | `#F2F5F8` / `#C4CDD8` / `#8E9BAA` / `#5E6A78` | `#0B1015` / `#26313C` / `#5A6673` / `#838F9C` | texto, cuerpo, secundario, micro-etiquetas |
| `--line` / `--line-hi` | `#1B222C` / `#2A3441` | `#DDE3EA` / `#C4CDD8` | bordes y bordes al pasar |
| `--accent` (+ `--accent-glow`) | `#00E5A0` | `#00B47E` | cifras, estados, botón principal |
| `--warn` / `--down` | `#FFB84D` / `#FF6B6B` | iguales | avisos y caídas |

Tipografía: **Inter** para todo el texto y **JetBrains Mono** para cifras, código y etiquetas.
Las micro-etiquetas usan `.nm-label`: 10,5 px mono, mayúsculas, `0.16em` de tracking.

## Partes interactivas (`app.js`)

- **Tema** — oscuro por defecto, con interruptor y memoria en `localStorage` (envuelto en
  `try/catch`: si el navegador bloquea el almacenamiento, la página sigue funcionando).
- **Navegación** — `data-scroll="<id>"` en cualquier elemento lleva a esa sección, con el
  desplazamiento corregido por la altura de la barra; un `IntersectionObserver` marca el enlace activo.
- **Menú móvil** — el botón de hamburguesa despliega los enlaces por debajo de la barra.
- **Pestañas de código** — TypeScript, Python, cURL y MCP; cambian el panel y el nombre del
  archivo en la barra de la consola.
- **Panel** — `AGENTS` en `app.js` es la única fuente del gasto por agente: nombre, id, gastado y
  techo. La barra se llena con el porcentaje del techo consumido.

## Animaciones

Una sola entrada al hacer scroll (`.nm-rise`), resuelta con animaciones nativas ligadas al scroll
(`animation-timeline: view()`), sin observadores y respetando `prefers-reduced-motion`. Los
navegadores sin soporte ven el estado final. Nada se repite en bucle.

## Antes de publicar

- **Todos los datos son de muestra.** Las cifras de la tira superior, el bloque de estadísticas,
  el resumen del día y la lista `AGENTS` son ilustrativos; el pie y el panel lo dicen.
- Los enlaces de "Crear cuenta", "Documentación" y los legales (`#legal`) todavía son anclas.
- Los protocolos de la tira de compatibilidad (x402, AP2, MCP, USDC, SEPA Instant, ERC-4337)
  describen intención de compatibilidad, no acuerdos firmados: confírmalos antes de publicarlos.
- Las comisiones (0,4 % por liquidado) y los límites de los planes son marcador de posición.
