# Hydro

Launchpad simulado donde cada token se lanza pareado a una fuente de agua —
un embalse, un acuífero, un glaciar o una planta de desalación — y hereda su
unidad, su registro y su precio spot.

Sitio estático: HTML, CSS y JavaScript sin dependencias ni build. Ábrelo con
cualquier servidor de ficheros:

```
python3 -m http.server 8777
```

## Páginas

| Fichero | Qué es |
| --- | --- |
| `index.html` | Portada y tablón spot en vivo |
| `sources.html` | El registro: 32 fuentes con filtro por clase, búsqueda y orden |
| `launch.html` | Formulario de pareado y lanzamiento |
| `launches.html` | Todos los tokens lanzados |
| `token.html?id=…` | Ficha de un token: precio, curva, bóveda y pareado |
| `docs.html` | El modelo, explicado |

`data.js` define el catálogo de fuentes y su llenado inicial; `app.js` lleva el
mercado simulado, los lanzamientos y el render de cada página.

## Modelo

- Cada fuente tiene un llenado entre 0 y 1 que deriva con el tiempo. Cuando baja
  el llenado, sube el spot: manda la escasez, no el volumen.
- Al lanzar, el token fija el spot de su fuente y abre a
  `precio0 = 0,4 · objetivo_de_curva / supply · (1 + (1 − llenado) · 0,5)`.
- Después, `precio = precio0 · (spot / spot0)^β · (1 + curva / 4,2 · 0,65)`.
- Se opera sobre una curva de bonding hasta 4,2 ETH; al completarse, gradúa.
- El 3% de cada operación entra en la bóveda del token.

No hay cadena, wallet ni backend: el estado vive en `localStorage` y se borra
con «Reiniciar datos» en el pie.
