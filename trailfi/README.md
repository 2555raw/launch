# Stepit — Walk. Explore. Earn.

Plataforma Web3 que recompensa a los usuarios por caminar: conectan su wallet, registran pasos verificados y reciben una parte de los fees elegibles de la plataforma, pagada en stablecoins a su dirección pública tras la revisión de un administrador.

- **Landing** (`/`): hero con fotografía real de senderismo, tarjeta flotante de estadísticas, How it works, Rewards, Leaderboard y footer.
- **Dashboard privado** (`/dashboard`): pasos de hoy, anillo de progreso, recompensas estimadas / pendientes / pagadas, gráfico de 14 días, historial de pagos y actividad.
- **Panel de administración** (`/admin`): usuarios, revisión de pasos, motor de distribución, aprobación de recompensas, pagos on-chain, ajustes y registro de auditoría.

---

## Arquitectura

```
┌──────────────────────── Navegador ────────────────────────┐
│ Next.js App Router · React 19 · Tailwind · Framer Motion  │
│ RainbowKit + wagmi + viem (MetaMask, WalletConnect, …)    │
│  · Sign-In With Ethereum: firma de un mensaje, sin gas    │
│  · Pagos: el admin firma la transferencia ERC-20          │
│    en su propia wallet autorizada                         │
└──────────────┬────────────────────────────────────────────┘
               │ fetch (cookie de sesión httpOnly, SameSite)
┌──────────────▼──────────── Servidor (Next.js API) ────────┐
│ /api/auth/*      SIWE → sesión JWT (jose)                 │
│ /api/me, /steps  datos del usuario, registro de pasos     │
│ /api/steps/ingest  ingesta firmada HMAC (apps de salud)   │
│ /api/admin/*     requireAdmin() en cada petición          │
│ lib/rewards/engine.ts   motor de recompensas (puro, test) │
│ lib/steps/validation.ts reglas anti-manipulación (test)   │
│ lib/services/*   lógica de negocio + SQL                  │
│ viem publicClient → verifica pagos on-chain               │
└──────────────┬────────────────────────────────────────────┘
               │ SQL (mismas migraciones en ambos)
┌──────────────▼────────────────────────────────────────────┐
│ Supabase / Postgres (DATABASE_URL)                        │
│   o PGlite embebido en .data/ para la demo local          │
└───────────────────────────────────────────────────────────┘
```

```
trailfi/
├── supabase/migrations/0001_init.sql   Esquema (users, step_entries, platform_settings,
│                                        distributions, rewards, payouts, audit_log) con RLS
├── src/app/                            Páginas y rutas API
│   ├── page.tsx                        Landing
│   ├── dashboard/                      Dashboard del usuario
│   ├── admin/                          Panel admin (layout con control de acceso en servidor)
│   └── api/                            Endpoints REST
├── src/components/                     landing/, dashboard/, admin/, wallet/, ui/
├── src/lib/
│   ├── rewards/engine.ts               Cálculo de recompensas (bigint, sin I/O)
│   ├── steps/                          Validación, firma de ingesta, proveedores
│   ├── services/                       users, steps, rewards, payouts, settings, stats
│   ├── auth/                           SIWE, sesión, guards de rol
│   ├── db/                             Acceso a Postgres/PGlite + migraciones
│   └── web3/                           Cadenas, tokens, config de wagmi
├── scripts/                            migrate.mjs, ingest-example.mjs
└── tests/                              Tests del motor y de la validación
```

## Puesta en marcha (demo local, sin servicios externos)

```bash
cd trailfi
cp .env.example .env.local
# Edita .env.local: pon tu dirección en ADMIN_WALLETS
npm install
npm run dev          # http://localhost:3000
```

Sin `DATABASE_URL`, la app arranca una base de datos Postgres embebida (PGlite) en `.data/pglite` y aplica las migraciones sola. Con una wallet de navegador (Phantom, MetaMask, Coinbase, Rabby) ya puedes conectarte en Robinhood Chain; para WalletConnect / móviles añade `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (gratis en [cloud.reown.com](https://cloud.reown.com)).

Recorrido completo de la demo:

1. Conecta una wallet y firma el mensaje de verificación → te registras y ves `/dashboard`.
2. Ve a **Upload steps** (`/steps`): elige el día, escribe los pasos y adjunta una captura de tu app de salud. Queda *unverified* hasta que el admin revise la captura en `/admin/steps`. La página muestra lo estimado por día y la media diaria de los últimos 7 días (solo importes, nunca las tarifas).
3. Con la wallet de `ADMIN_WALLETS`, entra en `/admin/steps` y verifica la entrada.
4. En `/admin/rewards` elige un día ya cerrado, los fees elegibles, **Preview** → **Create**, y aprueba las recompensas.
5. En `/admin/users` pulsa **Pay** → revisa destino, cantidad, token, red y gas → confirma y **Sign & send** (o, en modo demo, *simulate*).
6. El usuario ve el pago y el hash de la transacción en su dashboard.

```bash
npm test             # motor de recompensas, validación de pasos y firmas
npm run typecheck
npm run lint
npm run build
```

## Conexión de wallets y seguridad

- **Sign-In With Ethereum (EIP-4361)**: el usuario firma un mensaje de texto. No es una transacción, no cuesta gas y no concede permisos. El texto incluye el consentimiento: *"I agree that Stepit uses this public address to identify me and to send my rewards."* El servidor rechaza cualquier mensaje con otro texto, otro dominio, un nonce ya usado o caducado.
- Solo se guarda la **dirección pública**. Nunca se piden ni se almacenan frases semilla, claves privadas ni credenciales. No se solicitan `approve` de tokens.
- Sesión en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, firmada con `SESSION_SECRET`. Comprobación de `Origin` en todas las peticiones que modifican datos (CSRF).
- **Roles**: el acceso admin exige rol `admin` en la base de datos **y** que la wallet esté en `ADMIN_WALLETS`. Se comprueba en el layout de `/admin` (servidor) y en cada endpoint `/api/admin/*`. Quitar una wallet de la variable revoca el acceso al instante.
- **RLS** activado en todas las tablas sin políticas: las claves públicas de Supabase (`anon`) no pueden leer ni escribir nada. Solo el servidor accede, con `DATABASE_URL`.
- Todas las acciones sensibles quedan en `audit_log` con la wallet que las hizo.
- Rate limiting básico por IP/usuario (en memoria, por instancia: para varias instancias usar Redis/Upstash).

## Sistema de recompensas

Las recompensas siguen **tarifas privadas por tramos**, configurables en `/admin/settings`:

| Pasos verificados del día | Recompensa |
| --- | --- |
| Menos de 1.000 | 0 |
| 1.000 – 7.000 | unos 4 USDC de media (de 3,40 a 4,60, sube con los pasos) |
| Desde 7.000 | algo más: de 4,60 hasta 6 USDC (a los 15.000 pasos) |

Los cuatro valores (mínimo, media, umbral y máximo) se cambian en el panel. **Son privados**: solo la API de administración los devuelve; las páginas públicas y la API del usuario muestran únicamente importes. El cálculo se hace en el servidor (`tierReward` en `src/lib/rewards/engine.ts`, con tests).

Las recompensas se financian con las comisiones de trading del token $STEPIT. El reparto (`/admin/rewards`) calcula cada día cerrado, guarda las asignaciones como *pending* y el administrador las aprueba.

## Pagos

**Solicitudes de pago.** Cuando un usuario tiene recompensas aprobadas, pulsa **Request payout** en su dashboard. La solicitud aparece en `/admin/requests` con la **wallet completa** (solo visible para administradores), los pasos y el importe; desde ahí se paga con el mismo flujo de abajo. Una vez confirmado, el pago aparece en la lista pública de la portada con la wallet recortada (`0x2bdb…ef76`).


1. **Preparar**: el admin agrupa las recompensas aprobadas de un usuario en un pago (`prepared`). No se mueve nada.
2. **Revisar**: el modal muestra dirección de destino, cantidad (y unidades base), token, red, gas estimado, estado y hash. El admin debe marcar una casilla de confirmación explícita.
3. **Firmar**: la transferencia ERC-20 la firma el admin **en su propia wallet**, que debe estar en `PAYOUT_WALLETS`, en la red correcta y con saldo. El servidor nunca tiene claves privadas.
4. **Verificar**: el servidor lee el recibo desde su propio RPC y comprueba que la transacción tuvo éxito, que es del contrato del token correcto, que el emisor es una wallet autorizada y que el `Transfer` va a la dirección del usuario por la cantidad exacta. Solo entonces marca el pago como `confirmed` y las recompensas como `paid`. Un hash no puede reutilizarse para dos pagos.
5. Si la transacción revierte, el pago queda `failed` y las recompensas vuelven a `approved`. Si la transacción no coincide, las recompensas quedan bloqueadas para revisión manual (evita pagos dobles).

Nada se ejecuta automáticamente. Para pagos masivos se puede sustituir el paso 3 por un contrato de pagos por lotes o una Safe multisig manteniendo la misma verificación en servidor.

## Integración de pasos

| Fuente | Estado | Verificación inicial |
| --- | --- | --- |
| Subida desde el navegador con captura | Activa | `unverified`: nunca se paga hasta que el admin revisa la captura |
| Apple Health (HealthKit) | Vía app compañera iOS | `verified` si no hay alertas |
| Google Health Connect | Vía app compañera Android | `verified` si no hay alertas |
| APIs cloud (Fitbit, Garmin, Oura…) | Planificado (mismo contrato) | `verified` si no hay alertas |

HealthKit y Health Connect son APIs **en el dispositivo**: no existe una API web. La arquitectura prevista es una app compañera (React Native / Swift / Kotlin) que lee el agregado diario de pasos y lo envía a su backend, que lo firma y llama a `POST /api/steps/ingest`:

```
x-trailfi-timestamp: <unix seconds>
x-trailfi-signature: sha256=<hex HMAC-SHA256(STEP_INGEST_SECRET, `${timestamp}.${rawBody}`)>

{ "wallet": "0x…", "source": "apple_health",
  "entries": [{ "day": "2026-09-30", "steps": 11234, "externalId": "hk:…:2026-09-30" }] }
```

Ver `scripts/ingest-example.mjs`. El secreto no debe ir embebido en la app móvil: la app se autentica contra su backend (idealmente con App Attest / Play Integrity) y es el backend quien firma.

Validaciones aplicadas a todas las fuentes (`src/lib/steps/validation.ts`):

- Una entrada por usuario, día y fuente; no se puede sobrescribir. `externalId` único por fuente (anti-replay).
- Rechazo de fechas futuras, entradas manuales de más de 7 días, valores no enteros, negativos o > 100.000.
- Alertas (`flagged`, requieren revisión): > 45.000 pasos, picos > 3× la mediana de los últimos 14 días, números redondos en entradas manuales.
- Si un día tiene varias fuentes verificadas se usa el máximo, nunca la suma.

## Despliegue en producción

1. Crea un proyecto en **Supabase** y copia la cadena de conexión *Transaction pooler* (puerto 6543) en `DATABASE_URL`. Aplica el esquema con `npm run db:migrate` (o pega los ficheros de `supabase/migrations/` en orden en el SQL editor).
2. Configura `SESSION_SECRET` (`openssl rand -base64 48`), `ADMIN_WALLETS`, `PAYOUT_WALLETS`, `RPC_URL` de un proveedor dedicado, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` y `STEP_INGEST_SECRET`.
3. Elige la red (`NEXT_PUBLIC_CHAIN_ID=4663` para Robinhood Chain, la red por defecto) y el contrato del token de pago en `/admin/settings`.
4. Pon `NEXT_PUBLIC_DEMO_MODE=false`: desactiva los pagos simulados.
5. Despliega en Vercel, Railway o cualquier host Node 20+ (`npm run build && npm start`). En plataformas serverless, usa siempre `DATABASE_URL` (PGlite necesita disco persistente).

Antes de mover fondos reales: prueba el circuito completo en testnet, revisa los textos legales (`/terms`, `/privacy`) con un abogado y valora las implicaciones regulatorias de distribuir fees a usuarios en tu jurisdicción.

## Créditos

Fotografías de [Unsplash](https://unsplash.com) bajo la [Unsplash License](https://unsplash.com/license) (uso comercial permitido, sin atribución obligatoria): `photo-1551632811-561732d1e306` (hero) y `photo-1501555088652-021faa106b9b` (CTA).
