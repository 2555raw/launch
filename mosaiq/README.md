# Mosaiq

**Every launchpad. One canvas.** Un estudio de lanzamiento de tokens que reúne varias launchpads (Pump.fun, Bonk.fun,
Four.meme, Flap, Clanker, Zora) en Solana, BNB Chain y Base detrás de un solo formulario. La persona redacta el token;
un **agente** con clave de Mosaiq lo envía a través de un servidor MCP.

Inspirado en el concepto y la estructura de dotspad.io, con nombre, identidad visual, textos, componentes y código propios.

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run typecheck
npm run agent:demo     # hace de agente contra un servidor en marcha (BASE_URL=… para otro host)
```

Requiere Node 20+. Copia `.env.example` a `.env.local` si quieres fijar la URL pública o el directorio de datos.

## Análisis de la referencia → qué se implementó

| Referencia | Mosaiq |
| --- | --- |
| Rail lateral de iconos + barra superior con búsqueda ⌘K, “Launch” y “Connect your Dot” | Rail con tooltips e indicador activo; en móvil, tab bar inferior. Paleta ⌘K real (páginas, pads y búsqueda en el ledger con debounce). “Connect agent” emite una clave real |
| Hero con carrusel de tarjetas 3D de pads | Hero con **mosaico**: foco animado sobre el pad activo + rejilla de 6 teselas, autoplay con barra de progreso, pausa, anterior/siguiente, respeta `prefers-reduced-motion` |
| Marquesina de pads | Marquesina infinita con pausa al hover/focus; los clones no son enfocables |
| Bento (Explore / Launches / Analytics / Bring a Dot / How it works) | Bento con datos reales del ledger: últimos lanzamientos, sparkline acumulado, pasos |
| Top Tokens con filtros, Top creators, lista de Launchpads | Filtro por cadena, ranking de agentes por lanzamientos, contador por pad; enlaces preseleccionan el pad en el estudio |
| `/launch`: cadena → pad → par, nombre, ticker, imagen, X, web, compra inicial, descripción, nota para el agente, Create/Import | Todo lo anterior con validación zod compartida cliente/servidor, subida por arrastrar o clic (se redimensiona a WebP 512 px en el navegador), selección sincronizada con la URL, autoguardado local, vista previa en vivo, índice con scroll-spy, estados de carga/error/éxito |
| “Solo un Dot puede lanzar; MCP en /api/mcp” | Las personas guardan borradores; `submit_launch` exige `Authorization: Bearer mq_live_…`. Clave mostrada una sola vez, se guarda solo su hash |
| `/explore`: búsqueda, orden, cuadrícula/lista, filtro de red, estado vacío | Igual, con filtros reflejados en la URL, vista recordada, tabla accesible en modo lista |
| `/analytics`: tarjetas, gráfico con Total/Daily y 7D/30D/All | Gráfico SVG propio con tooltip por puntero, barras diarias, recarga por rango con estados, tabla oculta para lectores de pantalla, desglose por pad |
| `/docs` con índice lateral, páginas legales | Docs con scroll-spy y tabla de herramientas MCP; términos, privacidad y avisos |

## Arquitectura

```
app/
  layout.tsx            metadatos SEO/OG/Twitter, JSON-LD, fuentes, shell
  page.tsx              home (server component, lee el ledger)
  launch/ explore/ analytics/ docs/ legal/[slug]/
  api/
    drafts/             POST guardar borrador · GET /[id]
    agents/             POST emitir clave de agente (se muestra una vez)
    launches/           GET ledger (q, chain, pad, sort, limit)
    stats/              GET métricas (range=7d|30d|all)
    mcp/                servidor MCP JSON-RPC 2.0
  icon.svg opengraph-image.tsx sitemap.ts robots.ts manifest.ts
components/
  shell/                AppProvider (toasts, agente, atajos), navegación, ⌘K, diálogo de agente, footer
  home/ launch/ explore/ analytics/ docs/ ui/
lib/
  site.ts               nombre, tagline, redes: cambiar la marca empieza aquí
  pads.ts               registro de cadenas, pads y pares (datos, no código)
  schemas.ts            validación zod compartida
  handoff.ts            nota para el agente (misma en UI y MCP)
  server/
    store.ts            interfaz Store + implementación en fichero JSON
    adapters.ts         un adaptador por pad (hoy: “pending”)
    launches.ts agents.ts mcp.ts rate-limit.ts http.ts ids.ts
```

### Qué falta conectar para producción

- **Adaptadores de pads** (`lib/server/adapters.ts`): hoy registran el lanzamiento como `queued` y no reportan market cap.
  Cada pad necesita su adaptador que construya y firme la transacción con la wallet del agente y lea el precio. La web
  nunca muestra cifras inventadas: sin adaptador, el market cap aparece como “—”.
- **Persistencia**: `Store` usa un fichero JSON en `DATA_DIR` (válido para una instancia con volumen). Para escalar,
  implementa la misma interfaz con Postgres/KV.
- **Rate limit** en memoria; muévelo a Redis junto con el store si hay varias instancias.
- Pares y compras mínimas en `lib/pads.ts` son configuración: verifícalos con cada venue antes de activar adaptadores.

## Identidad

| Token | Valor | Uso |
| --- | --- | --- |
| `ink` | `#07080A` | fondo |
| `surface` | `#111418` | tarjetas |
| `bone` | `#F3EFE7` | texto, botón primario |
| `ember` | `#FF6A3D` | acento único: CTA, foco, estado activo |
| `mint` / `amber` / `peri` | `#3DD9B3` / `#F5C84B` / `#7C9CFF` | colores de cadena |

Tipografía: Space Grotesk (titulares), Geist Sans (texto), Geist Mono (etiquetas). Todo se sirve localmente, sin
peticiones a Google Fonts. El logo es un mosaico 2×2 con una tesela ember desplazada. Los pads usan monogramas
propios: no se incluyen logotipos de terceros.
