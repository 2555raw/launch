# Prueba de punta a punta

`e2e.js` abre la wallet en un navegador de verdad, crea una wallet, la cifra,
paga, y después comprueba en la cadena que ese pago existe y movió el dinero.
No comprueba maquetación; comprueba las cosas que, si fallan, cuestan dinero:

- la frase generada es BIP-39 válida y la dirección deriva de ella;
- el keystore queda cifrado con scrypt, y **ni la frase ni la clave privada
  aparecen en claro** en ningún sitio de `localStorage`;
- una palabra de verificación incorrecta se rechaza;
- una contraseña incorrecta se rechaza;
- una cantidad escrita a la española (`0,25`) mueve exactamente 0,25;
- el recibo en cadena existe, es de tipo 2 (EIP-1559), lo firma la dirección de
  la wallet y el destinatario recibe el importe exacto;
- un enlace de cobro, abierto en frío en otra pestaña, lleva al pago relleno.

## Qué hace falta

- `playwright` y `ethers` resolubles desde aquí (`npm i -D playwright ethers`,
  o globales).
- Un nodo EVM local **con chain id 8453**, porque la app firma para la red que
  tiene seleccionada y un id distinto haría que el nodo rechazara la firma:

  ```sh
  npx hardhat node --port 8545      # con networks.hardhat.chainId = 8453
  ```

- La wallet servida: `PORT=8099 npm start` desde `wallet/`.

## Correrlo

```sh
node test/e2e.js
```

Variables opcionales: `APP_URL`, `RPC_URL`, `CHROME_PATH`, `SHOT_DIR`.

La clave privada que aparece en el archivo es la primera cuenta de Hardhat, que
es pública y conocida por todo el mundo. Sirve para financiar la wallet de
prueba en la cadena local y **no debe usarse en ninguna red real**.
