# ARCHIVO 2020

Pieza web experimental sobre la pandemia de COVID-19, planteada como una instalación
digital y no como una página informativa: un volumen corrupto que alguien recupera
en un ordenador viejo y recorre sector a sector.

Muerte → hospital → mascarillas → vacunas → memoria.

## Cómo está hecho

Todo lo que se ve dentro del encuadre está dibujado píxel a píxel en un `<canvas>`
de **384 × 216** que el navegador amplía sin suavizado. No hay imágenes, ni fuentes
externas, ni librerías: la tipografía de los rótulos es un mapa de bits de 5 × 7
escrito a mano en `app.js`, y las camas, monitores, rostros y objetos son sprites
o formas dibujadas con rectángulos de un píxel.

El scroll de cada capítulo se traduce en un progreso `0..1`, y ese número es el
único guion de la escena: no hay temporizadores narrativos, la pieza avanza sólo
si alguien la recorre.

```
index.html   los cinco sectores, el arranque y el pie con la nota de fuentes
juego.html   el modo exploración: la planta del hospital vista desde la cámara
styles.css   el mueble: monitor CRT, rejilla de líneas, ruido, interfaz de archivo
juego.css    el mueble del juego: mando táctil, barra del registro, tarjeta final
escenas.js   tipografía de bits, sprites, texturas y las cinco escenas
app.js       monta las escenas sobre el scroll de index.html
juego.js     planta, cámara, personaje, luz por bloques y puestos de lectura
```

Las escenas viven en `escenas.js` y no tocan el DOM: reciben un lienzo, un
progreso `0..1` y el tiempo. Por eso las mismas cinco valen para el archivo con
scroll y para las pantallas que se abren dentro del juego.

## Los cinco sectores

| | | |
|---|---|---|
| 01 | MUERTES / PERDIDAS | Habitación vacía, contador y un campo donde cada punto son mil personas. |
| 02 | AISLAMIENTO / HOSPITAL | Pasillo infinito en perspectiva, puertas cerradas, fluorescentes que fallan. |
| 03 | MASCARILLAS | Dieciocho rostros que llegan corruptos y se pierden como datos dañados. |
| 04 | VACUNAS | Inventario de videojuego antiguo: los objetos se desbloquean, la certeza no. |
| 05 | MEMORIA | Miles de píxeles que se apagan hasta que queda uno. |

## Modo exploración

`juego.html` es la otra puerta de entrada: la misma planta cuarta, pero vista
desde la cámara del techo. Se anda con `WASD` o las flechas por un hospital
vacío —habitación 214, UCI, almacén de EPI, cámara fría y sala de espera—
con la luz pegada al personaje y un plano de la planta en la esquina. En cada
sala hay un puesto marcado en rojo: `E` lo abre y mantiene la lectura del
registro, que es exactamente la escena correspondiente del archivo. Con los
cinco recuperados se apagan las luces de la planta y queda el último píxel.

En pantallas táctiles aparece una cruceta y un botón de acción.

## Las cifras

Son material del relato, redondeado y cerrado a 2023: unos 7.010.000 fallecimientos
notificados a la OMS, una estimación de exceso de mortalidad de 14,9 millones para
2020 y 2021, y más de 13.500 millones de dosis administradas. La página lo dice en
su propio pie: es una pieza visual, no un panel de datos.

## Verla

Abrir `index.html` en el navegador, o servir la carpeta:

```
npx http-server archivo-2020
```

Rueda o gesto para avanzar, teclas `1`–`5` para saltar de sector. Si el sistema pide
movimiento reducido, el parpadeo y el ruido se congelan y la pieza responde sólo al scroll.
