# Calma — wallet no custodia

Una wallet que vive entera en el navegador de quien la abre. La clave se genera
ahí, se cifra ahí y se firma ahí; el servidor solo sirve archivos estáticos y no
ve nunca un secreto. Los pagos van a cadenas EVM reales y se liquidan de verdad.

## Qué hace

- **Crear wallet** — frase BIP-39 de 12 palabras generada con `crypto.getRandomValues`,
  con verificación obligatoria de tres palabras antes de seguir.
- **Importar** — frase de 12/24 palabras o clave privada.
- **Cifrado en disco** — keystore JSON estándar (scrypt + AES-128-CTR) en
  `localStorage`. Ni la frase ni la clave quedan nunca en claro.
- **Pagar** — moneda nativa y ERC-20 (USDC/USDT), con estimación de comisión,
  pantalla de revisión y seguimiento del recibo en cadena.
- **Recibir** — dirección y QR `ethereum:` con el id de red.
- **Cobrar** — enlace (y QR) que abre la app del pagador con el pago ya relleno.
- **Redes** — Base, Polygon, Arbitrum, Optimism, Ethereum y dos de prueba
  (Base Sepolia, Sepolia). RPC propio configurable por red.
- **Bloqueo automático** a los 5 minutos de inactividad.

## Decisiones de seguridad

- **ethers va vendorizado** en `public/vendor`, no en una CDN. Un script de
  terceros en una página que maneja claves privadas es una puerta abierta: quien
  controle la CDN controla las claves.
- **CSP con `script-src 'self'`** (ver `server.js`), más `frame-ancestors 'none'`,
  `nosniff`, `no-referrer` y `Permissions-Policy` restrictiva.
- **`connect-src`** deja pasar `https:` (el usuario puede elegir su nodo RPC) y
  `localhost` (para quien corre un nodo propio en su máquina). Nada más.
- La clave descifrada vive solo en memoria y se borra al bloquear.

## Estructura

- `public/index.html` — la portada.
- `public/app.html` + `app.js` — la wallet, servida en `/app`.
- `public/vendor/` — ethers y el generador de QR, congelados aquí a propósito.
- `server.js` — estáticos y cabeceras de seguridad.
- `test/e2e.js` — el recorrido completo contra una cadena real (ver `test/README.md`).

## Correr en local

```sh
cd wallet
npm start           # http://localhost:8080
```

No hay dependencias que instalar: `server.js` usa solo módulos de Node.

## Cómo se ha comprobado

Con una cadena EVM local fijada al id 8453, el navegador crea la wallet, la
cifra, firma un pago y la prueba verifica **en la cadena** que la transacción
existe y que el destinatario recibió el importe exacto. También comprueba que
ni la frase ni la clave privada quedan en claro en el navegador. Está en
`test/`; se vuelve a pasar con un comando.

## Desplegar

Es un sitio estático con un servidor Node mínimo. En Railway, apunta un servicio
a este directorio (`wallet/`) — `npm start` escucha en `$PORT`.

## Probarlo sin arriesgar dinero

Elige **Base Sepolia** en el selector de red y pide ETH de prueba en un faucet.
Es una cadena real, con los mismos bloques y las mismas firmas, pero su moneda no
vale nada: sirve para comprobar de punta a punta que un cobro funciona antes de
mover dinero de verdad.

## Lo que esto NO es

No es una tarjeta de débito ni un emisor de pagos. Gastar en comercios con una
Visa/Mastercard exige un emisor con licencia, patrocinio de BIN y KYC — eso es un
contrato, no código. Aquí los pagos son transferencias en blockchain entre
direcciones.
