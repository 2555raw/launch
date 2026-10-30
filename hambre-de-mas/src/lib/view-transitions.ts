/**
 * Nombre de la transición que convierte la foto de la tarjeta de la tienda en
 * la foto grande de la ficha (React <ViewTransition>). Solo puede haber un
 * elemento con cada nombre por página: si se repite, el navegador cancela la
 * transición, por eso las tarjetas solo lo llevan en la tienda y las categorías.
 */
export const kitPhotoTransition = (slug: string) => `kit-${slug}`
