# Hambre de Más · tienda online

Tienda online de **Hambre de Más**, kits de cocina para adolescentes («Cocina lo que te flipa»).
Sigue la estructura y la experiencia de compra de la Apple Store (mucho blanco, imágenes grandes,
tarjetas limpias, animaciones suaves) con la identidad de la marca: logotipo del gorro de chef,
Rojo Chef, Rojo Teja, Verde Hoja y Almendra.

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS 4** · **Framer Motion**
- **Supabase**: base de datos Postgres, autenticación, almacenamiento de imágenes y RLS
- **Stripe Checkout**: pago en la página segura de Stripe, webhooks firmados

> **Estado de los pagos:** la integración con Stripe está completa y probada de extremo a extremo
> contra un servidor de pruebas que firma los webhooks igual que Stripe. **No se ha probado con una
> cuenta real de Stripe** porque no había credenciales. Hasta que configures tus claves y hagas una
> compra de prueba (ver «Activar pagos reales»), la tienda no cobra nada.

---

## Índice

1. [Qué incluye](#qué-incluye)
2. [Arranque rápido (modo demo)](#arranque-rápido-modo-demo)
3. [Desarrollo con Supabase local](#desarrollo-con-supabase-local)
4. [Configurar Supabase en la nube](#configurar-supabase-en-la-nube)
5. [Configurar Stripe](#configurar-stripe)
6. [Crear el primer administrador](#crear-el-primer-administrador)
7. [Publicar la tienda](#publicar-la-tienda)
8. [Activar pagos reales: lista de comprobación](#activar-pagos-reales-lista-de-comprobación)
9. [Pruebas](#pruebas)
10. [Arquitectura](#arquitectura)
11. [Seguridad](#seguridad)
12. [Idiomas (español e inglés)](#idiomas-español-e-inglés)
13. [Asistente de ayuda](#asistente-de-ayuda)
14. [Decisiones de diseño](#decisiones-de-diseño)
15. [Limitaciones conocidas y siguientes pasos](#limitaciones-conocidas-y-siguientes-pasos)

---

## Qué incluye

**Tienda**
- Homepage: hero con producto destacado, niveles, novedades (carrusel), destacados, cómo funciona,
  más vendidos, ventajas, historia de la marca, opiniones verificadas (solo si existen), newsletter.
- Cabecera fija translúcida con menú desplegable de niveles, buscador con sugerencias en vivo,
  cuenta y cesta con contador animado; menú a pantalla completa en móvil.
- Catálogo con filtros por nivel, precio, dieta, tiempo, dificultad y stock; orden por destacados,
  novedades, más vendidos y precio; paginación. Todo en la URL (`/tienda?dieta=vegano&orden=precio-asc`).
- Ficha de producto: galería con miniaturas, variantes, cantidad, disponibilidad, «Añadir a la cesta»,
  «Comprar ahora», qué trae el kit, información técnica (alérgenos, IVA…), envíos y devoluciones,
  opiniones verificadas y productos relacionados.
- Cesta lateral y página de cesta: cantidades, eliminar, código promocional, envío gratis a partir
  de 40 €, IVA desglosado, total. **Todos los importes se calculan en el servidor.**
- Checkout como invitado o con cuenta, direcciones guardadas, validación de código postal (Península
  y Baleares), aceptación de condiciones, newsletter opcional.
- Pago con Stripe Checkout, páginas de pago completado y cancelado, email de confirmación (Resend, opcional).

**Idiomas**
- Toda la parte de clientes en español e inglés, con selector ES/EN en la cabecera, el menú móvil,
  el pie y las pantallas de acceso. Ver [Idiomas](#idiomas-español-e-inglés).

**Cuentas (Supabase Auth)**
- Registro, acceso, cierre de sesión, recuperación y cambio de contraseña, en pantallas propias a
  pantalla completa (fondo oscuro con un remolino de caracteres animado por CSS).
- Perfil, historial de pedidos con seguimiento de envío, direcciones de envío.

**Panel de administración** (`/admin`, solo rol `admin`)
- Resumen: ventas, pedidos por enviar, stock bajo, gráfico de 14 días, más vendidos.
- Pedidos: filtros, búsqueda, detalle, historial, estado de envío y seguimiento, cancelar pendientes,
  reembolsar con Stripe.
- Productos: crear, editar, publicar/archivar, variantes con precio, precio anterior y stock, SEO,
  subir/ordenar/borrar imágenes (Supabase Storage).
- Inventario con ajuste rápido y registro de movimientos, categorías, promociones, clientes y
  moderación de opiniones.

**Legal, SEO y accesibilidad**
- Aviso legal, privacidad, cookies, condiciones de compra, envíos, devoluciones y contacto
  (plantillas con datos configurables, ver más abajo).
- Banner de cookies con «Rechazar» al mismo nivel que «Aceptar» y analítica opcional que solo se
  carga con consentimiento.
- Metadatos por página, Open Graph, `sitemap.xml`, `robots.txt`, datos estructurados (Product,
  Offer, BreadcrumbList, Organization, WebSite), imágenes optimizadas (AVIF/WebP) y diferidas.
- Navegación por teclado, «saltar al contenido», etiquetas accesibles, contraste AA en textos y
  botones, `prefers-reduced-motion` respetado.

---

## Arranque rápido (modo demo)

Requisitos: **Node.js 20.9 o superior** (probado con Node 22).

```bash
cd hambre-de-mas
npm install
npm run dev
```

Abre http://localhost:3000. Sin variables de Supabase la tienda funciona en **modo demostración**:
catálogo de ejemplo en memoria, búsqueda, filtros y cesta funcionan, pero no hay cuentas ni pedidos.
Una franja negra arriba lo indica.

---

## Desarrollo con Supabase local

### Opción A · CLI de Supabase (recomendada)

Necesitas Docker y la [CLI de Supabase](https://supabase.com/docs/guides/local-development).

```bash
cd hambre-de-mas
supabase start          # aplica supabase/migrations y supabase/seed.sql
supabase status         # muestra API URL, anon key y service_role key
cp .env.example .env.local
```

Rellena en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key de supabase status>
```

Los emails (confirmación, recuperación) se ven en http://127.0.0.1:54324 (Inbucket/Mailpit).
Para empezar de cero: `supabase db reset`.

### Opción B · `npm run stack:up` (Linux/CI sin la CLI)

`scripts/local-stack/up.sh` levanta un Supabase mínimo con PostgreSQL 16 nativo y los contenedores
oficiales de GoTrue, PostgREST y Storage (de `ghcr.io`), aplica las migraciones y el seed y deja las
claves en `/tmp/hdm-local-stack/env`. Es el entorno con el que se ha probado este proyecto.
`npm run stack:down` lo para (`PURGE=1` borra los datos).

### Datos de demostración

`supabase/seed.sql` se **genera** desde `src/data/demo-catalog.ts` (`npm run db:seed:generate`).
Crea 4 categorías, 14 kits con 29 variantes (todos con `is_demo = true`) y dos códigos de ejemplo:
`BIENVENIDA10` (10 % desde 20 €) y `HAMBRE5` (5 € desde 40 €).
Para quitarlos en producción: bórralos desde el panel o ejecuta
`delete from products where is_demo; delete from promotions where description like '[DEMO]%';`.

---

## Configurar Supabase en la nube

1. Crea un proyecto en https://supabase.com. **Elige una región de la UE** (p. ej. Frankfurt o París).
2. Aplica las migraciones (cualquiera de las dos formas):
   - CLI: `supabase link --project-ref <ref>` y `supabase db push`.
   - Panel: SQL Editor → pega y ejecuta, **en orden**, los archivos de `supabase/migrations/`.
3. Opcional: ejecuta `supabase/seed.sql` si quieres los productos de demostración.
4. **Authentication → URL Configuration**
   - Site URL: `https://tudominio.es`
   - Redirect URLs: `https://tudominio.es/auth/confirm`
5. **Authentication → Providers → Email**: activa «Confirm email».
6. **Authentication → Emails → SMTP**: configura tu propio SMTP (el de Supabase es solo para pruebas
   y tiene límites muy bajos). Puedes traducir las plantillas al castellano.
7. **Project Settings → API**: copia la URL, la clave pública (anon/publishable) y la secreta
   (service_role/secret) en las variables de entorno.

Opcional: libera reservas de stock caducadas cada 15 minutos con `pg_cron` (Database → Extensions):

```sql
select cron.schedule('caducar-pedidos', '*/15 * * * *', $$select public.expire_stale_orders()$$);
```

(o llama a `GET /api/cron/expire-orders` con `Authorization: Bearer $CRON_SECRET`).

---

## Configurar Stripe

1. Crea una cuenta en https://dashboard.stripe.com y empieza en **modo de prueba**.
2. Developers → API keys → copia la **Secret key** (`sk_test_…`) en `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → **Add endpoint**:
   - URL: `https://tudominio.es/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Copia el **Signing secret** (`whsec_…`) en `STRIPE_WEBHOOK_SECRET`.
4. Settings → Payment methods: activa los métodos que quieras (tarjeta, Apple Pay, Google Pay,
   Bizum si está disponible para tu cuenta…). Checkout mostrará los activos.
5. Settings → Emails: activa «Successful payments» si quieres que Stripe envíe el recibo.

**En local**, con la [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copia el whsec_… que muestra en STRIPE_WEBHOOK_SECRET y reinicia `npm run dev`
```

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
Otras para probar errores: https://docs.stripe.com/testing.

### Cómo funciona el pago

1. El navegador envía a `POST /api/checkout` solo ids de variante, cantidades y datos de envío.
2. El servidor recalcula precios, descuentos, envío e IVA con datos de la base de datos.
3. La función SQL `create_order` bloquea las variantes, comprueba precio y stock, crea el pedido
   `pending` y **reserva el stock** en una sola transacción (no se puede vender de más, ni con
   compras simultáneas).
4. Se crea la sesión de Stripe Checkout con esos importes (el descuento va como cupón de un solo uso)
   y claves de idempotencia. Si Stripe falla, el pedido se cancela y el stock se libera.
5. Stripe envía el webhook; la firma se verifica y `mark_order_paid` comprueba importe, moneda y
   sesión antes de marcar el pedido como **pagado**. Es idempotente: reintentos o eventos duplicados
   no hacen nada. Si el importe no cuadra, el pedido queda «en revisión».
6. La página de confirmación vuelve a consultar la sesión en la API de Stripe (nunca se fía del
   navegador). Si la sesión caduca o el cliente vuelve atrás, el stock se libera.

No se guarda ningún dato de tarjeta: solo los ids de sesión y de PaymentIntent de Stripe.

---

## Crear el primer administrador

1. Regístrate en la tienda (`/cuenta/registro`).
2. En Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'tu@email.com';
```

3. Entra en `/admin`. El rol no se puede cambiar desde la web: los clientes no tienen permiso de
   escritura sobre esa columna.

---

## Publicar la tienda

Funciona en cualquier hosting de Next.js. Con **Vercel**:

1. Importa el repositorio y pon **Root Directory** = `hambre-de-mas`.
2. Añade las variables de `.env.example` (Production y Preview).
3. Despliega y configura tu dominio.
4. Actualiza `NEXT_PUBLIC_SITE_URL`, las URLs de Supabase Auth y el endpoint del webhook de Stripe
   con el dominio definitivo.
5. Opcional: crea un Vercel Cron que llame a `/api/cron/expire-orders` cada 15 minutos.

Scripts:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Desarrollo con recarga en caliente |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript |
| `npm test` | Pruebas unitarias |
| `npm run test:integration` | Pruebas contra Supabase (RLS, stock, pagos) |
| `npm run test:e2e` | Pruebas de navegador (Playwright) |
| `npm run db:seed:generate` | Regenera `supabase/seed.sql` desde el catálogo de demo |
| `npm run stack:up` / `stack:down` | Supabase local sin la CLI (Linux) |

---

## Activar pagos reales: lista de comprobación

- [ ] Datos de la empresa en `NEXT_PUBLIC_COMPANY_*` (las páginas legales muestran `[PENDIENTE: …]`
      mientras falten).
- [ ] **Revisión jurídica** de aviso legal, privacidad, cookies y condiciones (son plantillas
      orientativas, no asesoramiento legal). Especial atención a: venta a menores, derecho de
      desistimiento en alimentos, garantías y registro sanitario/etiquetado de alimentos.
- [ ] **Revisión fiscal** del IVA: los kits están al 10 % y el envío al 21 % por defecto
      (configurable por producto y con `SHIPPING_TAX_RATE_BPS`). Facturas: Stripe no las emite por
      ti en este flujo; usa tu programa de facturación o Stripe Invoicing.
- [ ] Sustituir productos y fotos de demostración por los reales; borrar los códigos `[DEMO]`.
- [ ] Supabase: región UE, confirmación de email activada, SMTP propio, copias de seguridad.
- [ ] Stripe: cuenta **activada** (datos fiscales y bancarios verificados), claves `sk_live_…`,
      webhook de producción con su propio `whsec_…`, métodos de pago activados.
- [ ] Hacer una compra real de importe bajo, comprobar el pedido en `/admin/pedidos` y reembolsarla.
- [ ] `ORDER_TOKEN_SECRET` y `CRON_SECRET` propios; programar la caducidad de reservas.
- [ ] Opcional: `RESEND_API_KEY` y `EMAIL_FROM` para el email de confirmación propio.

---

## Pruebas

| Tipo | Dónde | Qué cubre |
| --- | --- | --- |
| Unitarias (46) | `tests/unit` | Cálculo del presupuesto (precios, IVA, envío, promociones, stock), validaciones, flujo de checkout con Stripe simulado, webhooks y verificación de firma, catálogo y filtros |
| Integración (14) | `tests/integration` | RLS (anónimos, clientes, admin), nadie puede hacerse admin, 8 compras simultáneas sobre 3 unidades → exactamente 3 pedidos, idempotencia de pagos, importes que no cuadran, opiniones solo de compradores, subida de imágenes solo admin |
| E2E (9) | `e2e` | Compra completa como invitado (buscar → cesta → código → pagar → confirmación), Canarias, cancelar el pago, filtros, registro/direcciones/cierre de sesión, acceso de clientes al panel, móvil y cookies |

Para las e2e, con la tienda en marcha y Supabase local, añade a `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_local
STRIPE_WEBHOOK_SECRET=whsec_test_local
STRIPE_API_BASE_URL=http://localhost:12111
```

`tests/support/fake-stripe.mjs` es un **Stripe falso solo para pruebas**: imita las llamadas que usa
la tienda y envía webhooks firmados con el mismo algoritmo que Stripe. El cliente de Stripe solo lo
usa con claves `sk_test_`; con `sk_live_` se ignora siempre.

Si Playwright no encuentra el navegador, indica su ruta con `PLAYWRIGHT_CHROMIUM_PATH`.

---

## Arquitectura

```
hambre-de-mas/
├── src/
│   ├── app/
│   │   ├── (store)/            tienda: home, tienda, categoría, producto, cesta, checkout, cuenta, legal
│   │   ├── admin/              panel (layout protegido) y página «sin acceso»
│   │   ├── api/                cart/quote, checkout, webhooks/stripe, search, cron
│   │   ├── actions/            server actions: auth, cuenta, admin, opiniones, newsletter
│   │   ├── auth/confirm/       enlaces de los emails de Supabase
│   │   └── sitemap.ts, robots.ts, manifest.ts
│   ├── components/             ui, layout, home, catalog, product, cart, account, admin, legal, motion, seo
│   ├── data/demo-catalog.ts    catálogo de demostración (fuente del seed)
│   ├── lib/
│   │   ├── catalog/            repositorio de catálogo (Supabase o demo), filtros
│   │   ├── pricing/            presupuesto puro + versión servidor + promociones
│   │   ├── orders/             pedidos (service role), checkout, tokens
│   │   ├── stripe/             cliente y procesamiento de webhooks
│   │   ├── supabase/           clientes: servidor (sesión), público, service role, navegador, proxy
│   │   ├── auth/               sesión, requireUser, requireAdmin
│   │   ├── validation/         esquemas Zod
│   │   ├── email/              email de confirmación (Resend)
│   │   └── config/             tienda, empresa, reglas comerciales
│   └── proxy.ts                refresco de sesión y redirecciones de zonas privadas
├── supabase/
│   ├── migrations/             esquema, funciones, permisos/RLS, storage
│   ├── seed.sql                generado
│   └── config.toml
├── tests/ (unit, integration, support)   e2e/   scripts/
└── public/ (brand, demo)
```

Esquema principal: `profiles`, `categories`, `products`, `product_variants` (precio y stock),
`product_images`, `inventory_movements`, `promotions`, `addresses`, `orders`, `order_items`,
`order_events`, `stripe_events`, `reviews`, `newsletter_subscribers`. Todos los importes en céntimos
con IVA incluido, con `check` que impiden cantidades e importes inválidos.

---

## Seguridad

- **RLS en todas las tablas.** El navegador solo tiene la clave pública; un cliente solo ve sus
  pedidos y direcciones, no puede cambiar su rol ni el stock, y no puede crear pedidos ni marcarlos
  como pagados (esas funciones solo las ejecuta el servidor con la service role).
- **Panel**: `requireAdmin()` en el layout y en cada acción, y además RLS con `is_admin()` en la base
  de datos. Ocultar botones no es la protección.
- **Precios**: nunca se aceptan del navegador; se recalculan en el servidor y se vuelven a comprobar
  en SQL con las filas bloqueadas.
- **Webhooks** con verificación de firma, registro de eventos procesados y operaciones idempotentes.
- `server-only` impide importar en el navegador los módulos con claves secretas.
- Cabeceras: CSP, `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Límite de peticiones en checkout, login, registro, newsletter y presupuesto (en memoria: con varias
  instancias usa Redis/Upstash).
- Redirecciones tras el login solo a rutas internas; enlaces de cancelación firmados con HMAC.

---

## Idiomas (español e inglés)

- **Cómo se elige**: el selector ES/EN guarda la cookie `hdm_locale` (un año). En la primera visita,
  sin cookie, se usa el idioma preferido del navegador (inglés solo si lo prefiere al español).
- **Textos de la interfaz**: se escriben junto a donde se usan, como pares
  `t({ es: '…', en: '…' })` (`src/lib/i18n`). TypeScript obliga a dar los dos idiomas, así que no se
  puede quedar un texto sin traducir. Para añadir un tercer idioma, se añade a `LOCALES` en
  `src/lib/i18n/config.ts` y el compilador señala cada texto que falta.
- **Catálogo**: el español va en las columnas de siempre y las traducciones en la columna
  `translations` de `products` y `categories` (migración `20261028000100_translations.sql`). Se
  editan en el panel, en la tarjeta «Inglés (opcional)» de cada producto. Lo que no esté traducido se
  muestra en español. La búsqueda encuentra los kits también por su nombre en inglés.
- **Pago y emails**: Stripe Checkout se abre en el idioma del cliente y el email de confirmación se
  envía en ese idioma (el idioma viaja en los metadatos del pago).
- **Qué queda en español**: el panel de administración (uso interno) y los **textos legales**. En
  inglés, las páginas legales avisan de que solo existen en español y que esa es la versión válida.
  Si vas a vender a clientes de habla inglesa, valora con tu asesoría traducirlos.
- **SEO**: el idioma va en una cookie, no en la URL, así que los buscadores indexan la versión en
  español. Si necesitas posicionar en inglés, el siguiente paso es servirlo con prefijo (`/en/...`)
  y etiquetas `hreflang`.

---

## Asistente de ayuda

El botón rojo de abajo a la derecha abre un panel con tres opciones: preguntar al asistente, buscar
en las preguntas frecuentes y escribir al email de atención al cliente (`NEXT_PUBLIC_COMPANY_EMAIL`,
por defecto HambreDeMas@gmail.com).

- **Con IA**: añade `ANTHROPIC_API_KEY` (clave de https://console.anthropic.com) y el asistente
  responde con Claude (`claude-opus-5-5`, esfuerzo bajo para que conteste rápido). Sus instrucciones
  están en `src/lib/assistant/prompt.ts`: los datos de envío, devoluciones y pago salen de la
  configuración, y el catálogo publicado se lee en cada pregunta, así que no hay que mantener nada a
  mano. Solo responde con esa información; lo que no sepa (el estado de un pedido concreto, una
  incidencia) lo deriva al email.
- **Respaldo**: si el modelo declina una pregunta, la API la reintenta sola con el modelo de respaldo
  recomendado por Anthropic (`fallbacks: "default"`); si aun así no responde, o la API falla, el
  cliente ve un mensaje que le invita a escribir al email.
- **Sin clave**: el panel funciona igual y responde con la pregunta frecuente que mejor encaje
  (`src/lib/assistant/faq.ts`, donde también se editan las preguntas del panel).
- **Privacidad y coste**: las conversaciones no se guardan en la tienda; se envían a Anthropic para
  generar la respuesta (añádelo a la política de privacidad si activas la IA). Cada IP puede hacer
  15 preguntas por minuto y cada conversación se limita a 20 mensajes de 1000 caracteres.

---

## Decisiones de diseño

- **Colores**: el encargo pedía azul `#0071E3` como acento, pero la guía de identidad de la marca usa
  Rojo Chef. Se mantiene la base neutra de la Apple Store (`#FFFFFF`, `#F5F5F7`, `#1D1D1F`,
  `#86868B`) y el acento es el rojo de la marca. Los tokens están en `src/app/globals.css` (`@theme`):
  cambiar el acento es una línea.
- **Contraste**: Rojo Chef sobre blanco da 4,2:1, por debajo del mínimo AA para texto normal. Los
  botones usan `chef-ink` (`#D63327`, 4,8:1) y los textos en rojo usan Rojo Teja (`#BF2D11`, 5,8:1).
  El gris `#86868B` se usa solo en textos grandes; el texto secundario pequeño usa `#6E6E73`.
- **Tipografía**: la guía usa Etna Sans Serif (no disponible en Google Fonts). Se usa Montserrat
  ExtraBold, muy similar, para títulos, e Inter para el texto. Si tienes la licencia web de Etna,
  cámbiala en `src/app/layout.tsx` con `next/font/local`.
- **Caja sorpresa** se vende como pago por adelantado de 1, 3 o 6 meses (sin renovación automática),
  para no necesitar suscripciones de Stripe en esta primera versión.

---

## Limitaciones conocidas y siguientes pasos

- Pagos verificados con un Stripe simulado; falta la prueba con tu cuenta real (ver lista).
- Envíos solo a Península y Baleares (Canarias, Ceuta y Melilla requieren IGIC/IPSI y aduanas).
- Sin facturación automática ni cálculo de impuestos de Stripe Tax.
- Suscripción mensual real (Stripe Billing) para la caja sorpresa: pendiente.
- El limitador de peticiones es en memoria (una sola instancia).
- Los textos legales son plantillas: necesitan revisión profesional.
- Fotos de producto de Unsplash (ver `public/demo/CREDITOS.md`): sustitúyelas por las reales.
