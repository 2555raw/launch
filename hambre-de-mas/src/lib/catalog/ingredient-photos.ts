/**
 * Foto de cada elemento de «Qué trae el kit».
 *
 * Se busca por palabras clave en el texto en español (el idioma base del
 * catálogo), así que la versión en inglés usa las mismas fotos. Las fotos
 * están en public/demo/ingredients (Unsplash, ver CREDITOS.md): sustitúyelas
 * por fotos propias del producto antes de abrir la tienda. Si un elemento no
 * tiene foto, la ficha muestra un icono.
 */

const rules: [RegExp, string | null][] = [
  // Lo que no es un ingrediente
  [/tarjeta|receta exclusiva|pegatina|kit sorpresa/i, null],
  // Primero los nombres compuestos, para que no los capture una regla general
  [/aceite de chile/i, 'aceite-chile'],
  [/aceite de s[ée]samo/i, 'aceite-sesamo'],
  [/tortillas? de trigo/i, 'tortilla-trigo'],
  [/tortillas? de ma[ií]z/i, 'tortilla-maiz'],
  [/hummus/i, 'hummus'],
  [/especias tostadas/i, 'especias-tostadas'],
  [/garam masala/i, 'garam-masala'],
  [/adobo|guindilla|zumaque|piment[oó]n/i, 'chile'],
  [/pi[ñn]a/i, 'pina'],
  [/chile/i, 'chile'],
  [/especias/i, 'especias'],
  [/cusc[uú]s/i, 'cuscus'],
  [/falafel|garbanzo/i, 'garbanzos'],
  [/tahini/i, 'tahini'],
  [/yogur/i, 'yogur'],
  [/granola/i, 'granola'],
  [/frutos rojos/i, 'frutos-rojos'],
  [/ch[ií]a/i, 'chia'],
  [/masa madre/i, 'pan-masa-madre'],
  [/guacamole/i, 'guacamole'],
  [/pimienta/i, 'pimienta'],
  [/sal\b/i, 'sal'],
  [/fideos ramen/i, 'fideos-ramen'],
  [/fideos/i, 'fideos-trigo'],
  [/miso/i, 'miso'],
  [/shiitake|setas/i, 'shiitake'],
  [/zanahoria|pimiento/i, 'verduras-frescas'],
  [/^col\b/i, 'col'],
  [/cebolleta/i, 'cebolleta'],
  [/cebolla crujiente/i, 'cebolla-crujiente'],
  [/cebolla/i, 'cebolla-roja'],
  [/furikake|s[ée]samo/i, 'sesamo'],
  [/nori/i, 'nori'],
  [/soja texturizada/i, 'soja-texturizada'],
  [/salsa (ponzu|yakisoba)|salsa de soja/i, 'salsa-soja'],
  [/sirope/i, 'sirope'],
  [/chocolate/i, 'chocolate'],
  [/tortitas|harina|naan|levadura/i, 'harina'],
  [/penne/i, 'penne'],
  [/tomate triturado/i, 'tomate-triturado'],
  [/tomate concentrado/i, 'tomate-concentrado'],
  [/tomate/i, 'tomate-entero'],
  [/\bajo\b/i, 'ajo'],
  [/perejil/i, 'perejil'],
  [/salm[oó]n/i, 'salmon'],
  [/lim[oó]n/i, 'limon'],
  [/pasta de curry/i, 'pasta-curry'],
  [/leche de coco/i, 'leche-coco'],
  [/arroz jazm[ií]n/i, 'arroz'],
  [/arroz/i, 'arroz-cocido'],
  [/or[ée]gano/i, 'oregano'],
  [/pollo/i, 'pollo'],
  [/mantequilla|nata/i, 'mantequilla'],
  [/obleas/i, 'obleas-gyoza'],
  [/carne picada|vacuno/i, 'carne-picada'],
  [/mozzarella/i, 'mozzarella'],
  [/albahaca/i, 'albahaca'],
  [/jengibre/i, 'jengibre'],
  [/at[uú]n/i, 'atun'],
  [/mayonesa|salsa burger/i, 'mayonesa'],
  [/pita/i, 'pita'],
  [/pepinillos/i, 'pepinillos'],
  [/brioche/i, 'brioche'],
  [/cheddar/i, 'cheddar'],
  // Al final: «liofilizado» solo decide si no hay nada más concreto (cebolleta, frutos rojos…)
  [/liofilizad/i, 'verduras-secas'],
]

/** Ruta de la foto del ingrediente (o null si no hay). */
export function ingredientPhoto(item: string): string | null {
  for (const [pattern, key] of rules) {
    if (pattern.test(item)) return key ? `/demo/ingredients/${key}.jpg` : null
  }
  return null
}

export const ingredientPhotos = (items: string[]) => items.map(ingredientPhoto)
