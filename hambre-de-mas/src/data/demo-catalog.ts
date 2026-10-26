/**
 * Catálogo de DEMOSTRACIÓN de Hambre de Más.
 *
 * Es la única fuente de los datos de ejemplo:
 *  - `npm run db:seed:generate` lo convierte en supabase/seed.sql.
 *  - Sin Supabase configurado, la tienda lo usa en modo demo (solo lectura).
 *
 * Todos los productos llevan is_demo = true. Para pasar a producción, bórralos
 * desde el panel (o con `delete from products where is_demo`) y crea los tuyos.
 * Las fotos son de Unsplash (licencia Unsplash) y están en public/demo.
 */

/** UUID determinista a partir de un texto, para que demo y base de datos coincidan. */
export function demoId(kind: string, key: string): string {
  const input = `${kind}:${key}`
  const parts: string[] = []
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ (round * 0x9e3779b9)
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    parts.push((h >>> 0).toString(16).padStart(8, '0'))
  }
  const hex = parts.join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-')
}

export type DemoCategory = {
  slug: string
  name: string
  tagline: string
  description: string
  level: number | null
  accent: 'chef' | 'teja' | 'hoja' | 'almendra'
  image: string
  position: number
}

export type DemoVariant = {
  name: string
  sku: string
  price: number
  compareAt?: number
  stock: number
}

export type DemoProduct = {
  slug: string
  name: string
  subtitle: string
  description: string
  category: string
  variants: DemoVariant[]
  images: { file: string; alt: string }[]
  attributes: { minutes: number; difficulty: 1 | 2 | 3; heat: 'sin-fuego' | 'microondas' | 'sarten' | 'cazo' | 'horno' }
  tags: string[]
  includes: string[]
  specs: { label: string; value: string }[]
  featured?: boolean
  badge?: string
  salesCount: number
  publishedDaysAgo: number
}

export type DemoPromotion = {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  value: number
  minSubtotal: number
}

export const demoCategories: DemoCategory[] = [
  {
    slug: 'primer-bocado',
    name: 'Primer bocado',
    tagline: 'Sin fuego o con microondas',
    description: 'El nivel 1. Recetas para empezar sin miedo: nada de fuegos, como mucho un microondas.',
    level: 1,
    accent: 'chef',
    image: '/demo/products/wraps-1.jpg',
    position: 1,
  },
  {
    slug: 'con-ganas',
    name: 'Con ganas',
    tagline: 'Platos con sartén y cazo',
    description: 'El nivel 2. Ya controlas la cocina: toca sartén, cazo y recetas que impresionan.',
    level: 2,
    accent: 'hoja',
    image: '/demo/products/ramen-1.jpg',
    position: 2,
  },
  {
    slug: 'hambre-de-mas',
    name: 'Hambre de más',
    tagline: 'Recetas del mundo',
    description: 'El nivel 3. Viaja sin salir de casa con recetas de Asia, India e Italia.',
    level: 3,
    accent: 'teja',
    image: '/demo/products/curry-1.jpg',
    position: 3,
  },
  {
    slug: 'caja-sorpresa',
    name: 'Caja sorpresa',
    tagline: 'Un kit nuevo cada mes',
    description: 'No sabrás qué receta te toca hasta abrir la caja. Pago por adelantado de 1, 3 o 6 meses.',
    level: null,
    accent: 'almendra',
    image: '/demo/products/sorpresa-1.jpg',
    position: 4,
  },
]

const conservation = { label: 'Conservación', value: 'Lugar fresco y seco. Consumo preferente: 6 meses desde el envío.' }
const recipeCard = { label: 'Receta', value: 'Tarjeta paso a paso con QR al vídeo de la receta.' }

export const demoProducts: DemoProduct[] = [
  // Nivel 1 · Primer bocado
  {
    slug: 'kit-wraps-crujientes',
    name: 'Kit Wraps crujientes',
    subtitle: 'Wraps de pollo y verduras con salsa de yogur y lima. Sin fuego.',
    description:
      'Tu primera receta sin encender nada. Tortillas de trigo, mezcla de especias suave y la salsa de yogur y lima que hace que todo sepa a restaurante. Tú pones el pollo asado y las verduras; nosotros, todo lo demás y un vídeo paso a paso.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-WRP-2', price: 1690, stock: 40 },
      { name: '4 personas', sku: 'HDM-WRP-4', price: 2990, stock: 25 },
    ],
    images: [
      { file: 'wraps-1.jpg', alt: 'Dos wraps de pollo y verduras cortados por la mitad' },
      { file: 'wraps-2.jpg', alt: 'Ingredientes frescos sobre una tabla de cortar' },
    ],
    attributes: { minutes: 15, difficulty: 1, heat: 'sin-fuego' },
    tags: [],
    includes: ['6 tortillas de trigo', 'Mezcla de especias suave', 'Base para salsa de yogur y lima', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, leche. Puede contener trazas de sésamo.' },
      { label: 'Lo que pones tú', value: 'Pollo asado, lechuga, tomate y un yogur natural.' },
      conservation,
      recipeCard,
    ],
    salesCount: 120,
    publishedDaysAgo: 120,
  },
  {
    slug: 'kit-bowl-arcoiris',
    name: 'Kit Bowl arcoíris',
    subtitle: 'Garbanzos especiados, cuscús y verduras de todos los colores.',
    description:
      'Un bowl que entra por los ojos. El cuscús se hace en el microondas en cinco minutos, los garbanzos llevan nuestra mezcla de especias tostadas y el aliño de tahini lo une todo. Cien por cien vegetal.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-BWL-2', price: 1590, stock: 35 },
      { name: '4 personas', sku: 'HDM-BWL-4', price: 2790, stock: 20 },
    ],
    images: [
      { file: 'bowl-1.jpg', alt: 'Bowl con aguacate, tomate, garbanzos y lombarda' },
      { file: 'bowl-2.jpg', alt: 'Bowl de verduras de colores visto desde arriba' },
    ],
    attributes: { minutes: 15, difficulty: 1, heat: 'microondas' },
    tags: ['vegano', 'vegetariano'],
    includes: ['Cuscús', 'Garbanzos cocidos en conserva', 'Especias tostadas', 'Aliño de tahini', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, sésamo.' },
      { label: 'Lo que pones tú', value: 'Un aguacate, tomates cherry, lombarda y zanahoria.' },
      conservation,
      recipeCard,
    ],
    featured: true,
    salesCount: 95,
    publishedDaysAgo: 90,
  },
  {
    slug: 'kit-parfait-frutos-rojos',
    name: 'Kit Parfait de frutos rojos',
    subtitle: 'Granola crujiente, yogur y frutos rojos. Desayuno de diez.',
    description:
      'Capas de yogur, granola con miel y frutos rojos liofilizados que recuperan todo su sabor. Montas cuatro tarros en diez minutos y tienes desayuno o merienda para varios días.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-PRF-2', price: 1290, compareAt: 1490, stock: 50 },
      { name: '4 personas', sku: 'HDM-PRF-4', price: 2190, compareAt: 2490, stock: 30 },
    ],
    images: [
      { file: 'parfait-1.jpg', alt: 'Tarros de yogur con fresas' },
      { file: 'parfait-2.jpg', alt: 'Bol de fruta fresca variada' },
    ],
    attributes: { minutes: 10, difficulty: 1, heat: 'sin-fuego' },
    tags: ['vegetariano'],
    includes: ['Granola con miel', 'Frutos rojos liofilizados', 'Semillas de chía', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten (avena), frutos de cáscara.' },
      { label: 'Lo que pones tú', value: 'Yogur natural o griego.' },
      conservation,
      recipeCard,
    ],
    badge: 'Oferta',
    salesCount: 80,
    publishedDaysAgo: 60,
  },
  {
    slug: 'kit-tostadas-aguacate',
    name: 'Kit Tostadas de aguacate y huevo',
    subtitle: 'Pan de masa madre, aguacate y huevo poché al microondas.',
    description:
      'El truco del huevo poché en taza que te va a cambiar los desayunos. Incluye pan de masa madre tostado, nuestra mezcla de semillas y chile suave, y la receta para clavar el punto del huevo en 60 segundos.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-TST-2', price: 1390, stock: 3 },
      { name: '4 personas', sku: 'HDM-TST-4', price: 2390, stock: 12 },
    ],
    images: [{ file: 'tostadas-1.jpg', alt: 'Tostada con aguacate y huevo cocido sobre espinacas' }],
    attributes: { minutes: 12, difficulty: 1, heat: 'microondas' },
    tags: ['vegetariano'],
    includes: ['Pan de masa madre tostado', 'Mezcla de semillas y chile suave', 'Escamas de sal', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, sésamo. Huevo (lo pones tú).' },
      { label: 'Lo que pones tú', value: 'Dos aguacates y cuatro huevos.' },
      conservation,
      recipeCard,
    ],
    badge: 'Nuevo',
    salesCount: 12,
    publishedDaysAgo: 6,
  },

  // Nivel 2 · Con ganas
  {
    slug: 'kit-ramen-casero',
    name: 'Kit Ramen casero',
    subtitle: 'Caldo de miso, fideos ramen y toppings. El que te convierte en chef.',
    description:
      'Nuestro kit estrella. Fideos ramen de verdad, base de caldo de miso, aceite de chile y sésamo, alga nori y la receta para dejar los huevos marinados perfectos. Un bol que no tiene nada que envidiar al de tu restaurante favorito.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-RAM-2', price: 3500, stock: 60 },
      { name: '4 personas', sku: 'HDM-RAM-4', price: 5900, stock: 30 },
    ],
    images: [
      { file: 'ramen-1.jpg', alt: 'Bol de ramen con huevo, gambas y palillos' },
      { file: 'ramen-2.jpg', alt: 'Ramen con naruto y huevo en un bol oscuro' },
    ],
    attributes: { minutes: 35, difficulty: 2, heat: 'cazo' },
    tags: [],
    includes: ['Fideos ramen', 'Base de caldo de miso', 'Aceite de chile y sésamo', 'Alga nori', 'Salsa para marinar huevos', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, soja, sésamo.' },
      { label: 'Lo que pones tú', value: 'Huevos, cebolleta y la proteína que quieras (pollo, tofu o gambas).' },
      conservation,
      recipeCard,
    ],
    featured: true,
    badge: 'Más vendido',
    salesCount: 340,
    publishedDaysAgo: 150,
  },
  {
    slug: 'kit-tacos-al-pastor',
    name: 'Kit Tacos al pastor',
    subtitle: 'Adobo de achiote, tortillas de maíz y salsa de piña.',
    description:
      'Tacos de pollo marinado en adobo al pastor, hechos a la sartén. El kit trae el adobo, las tortillas de maíz y una salsa de piña con un punto picante. Fiesta asegurada.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-TAC-2', price: 2290, stock: 28 },
      { name: '4 personas', sku: 'HDM-TAC-4', price: 3890, stock: 18 },
    ],
    images: [{ file: 'tacos-1.jpg', alt: 'Plato con tres tacos de verduras y carne' }],
    attributes: { minutes: 30, difficulty: 2, heat: 'sarten' },
    tags: ['picante', 'sin-gluten'],
    includes: ['12 tortillas de maíz', 'Adobo al pastor', 'Salsa de piña y chile', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Sin alérgenos de declaración obligatoria. Elaborado en instalaciones que manipulan gluten.' },
      { label: 'Lo que pones tú', value: 'Muslos de pollo, cebolla, cilantro y lima.' },
      conservation,
      recipeCard,
    ],
    featured: true,
    salesCount: 175,
    publishedDaysAgo: 100,
  },
  {
    slug: 'kit-tortitas-americanas',
    name: 'Kit Tortitas americanas',
    subtitle: 'Esponjosas, altas y con sirope de arce. Domingo resuelto.',
    description:
      'La mezcla seca ya está pesada: solo añades huevo y leche. Te enseñamos a controlar el fuego de la sartén para que salgan doradas y altísimas. Incluye sirope de arce y pepitas de chocolate.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-TRT-2', price: 1490, stock: 45 },
      { name: '4 personas', sku: 'HDM-TRT-4', price: 2490, stock: 22 },
    ],
    images: [
      { file: 'tortitas-1.jpg', alt: 'Torre de tortitas con plátano y sirope' },
      { file: 'tortitas-2.jpg', alt: 'Tostadas francesas con arándanos y plátano' },
    ],
    attributes: { minutes: 25, difficulty: 2, heat: 'sarten' },
    tags: ['vegetariano'],
    includes: ['Mezcla para tortitas', 'Sirope de arce', 'Pepitas de chocolate', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, leche. Puede contener trazas de frutos de cáscara.' },
      { label: 'Lo que pones tú', value: 'Dos huevos, leche y mantequilla.' },
      conservation,
      recipeCard,
    ],
    salesCount: 210,
    publishedDaysAgo: 130,
  },
  {
    slug: 'kit-penne-arrabbiata',
    name: "Kit Penne all'arrabbiata",
    subtitle: 'La salsa de tomate picante más famosa de Roma.',
    description:
      'Penne rigate de trigo duro, tomate triturado italiano y nuestra mezcla de guindilla y ajo. Aprendes a sofreír sin quemar y a ligar la salsa con el agua de la pasta como en Italia.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-PEN-2', price: 1690, stock: 30 },
      { name: '4 personas', sku: 'HDM-PEN-4', price: 2890, stock: 0 },
    ],
    images: [
      { file: 'pasta-1.jpg', alt: 'Plato de penne con salsa de tomate y queso' },
      { file: 'pasta-2.jpg', alt: 'Sartén con pasta y carne' },
    ],
    attributes: { minutes: 20, difficulty: 2, heat: 'cazo' },
    tags: ['vegano', 'picante'],
    includes: ['Penne rigate', 'Tomate triturado italiano', 'Mezcla de guindilla y ajo', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten.' },
      { label: 'Lo que pones tú', value: 'Aceite de oliva y perejil fresco.' },
      conservation,
      recipeCard,
    ],
    salesCount: 140,
    publishedDaysAgo: 80,
  },

  // Nivel 3 · Hambre de más
  {
    slug: 'kit-curry-rojo-thai',
    name: 'Kit Curry rojo tailandés',
    subtitle: 'Pasta de curry, leche de coco y arroz jazmín.',
    description:
      'Un viaje a Bangkok en 40 minutos. Pasta de curry rojo, leche de coco cremosa, salsa de pescado y arroz jazmín. Te enseñamos a equilibrar dulce, salado, ácido y picante como hacen en Tailandia.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-CUR-2', price: 2790, stock: 26 },
      { name: '4 personas', sku: 'HDM-CUR-4', price: 4690, stock: 14 },
    ],
    images: [
      { file: 'curry-1.jpg', alt: 'Curry rojo con salmón y limón en una sartén' },
      { file: 'curry-2.jpg', alt: 'Curry con hierbas frescas en una sartén' },
    ],
    attributes: { minutes: 40, difficulty: 3, heat: 'sarten' },
    tags: ['picante', 'sin-gluten'],
    includes: ['Pasta de curry rojo', 'Leche de coco', 'Arroz jazmín', 'Salsa de pescado', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Pescado, crustáceos.' },
      { label: 'Lo que pones tú', value: 'Pollo o salmón, un pimiento rojo y lima.' },
      conservation,
      recipeCard,
    ],
    featured: true,
    badge: 'Nuevo',
    salesCount: 30,
    publishedDaysAgo: 4,
  },
  {
    slug: 'kit-butter-chicken',
    name: 'Kit Butter chicken con naan',
    subtitle: 'Pollo en salsa de tomate, mantequilla y garam masala.',
    description:
      'El plato indio que gusta a todo el mundo. Marinado de yogur y especias, salsa cremosa de tomate y mantequilla, y la mezcla para hacer naan en la sartén. Nivel 3 porque hay que coordinar tres elaboraciones a la vez.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-BTC-2', price: 2990, stock: 20 },
      { name: '4 personas', sku: 'HDM-BTC-4', price: 4990, stock: 10 },
    ],
    images: [
      { file: 'butter-1.jpg', alt: 'Butter chicken con pan naan' },
      { file: 'butter-2.jpg', alt: 'Cuencos de curry indio con arroz' },
    ],
    attributes: { minutes: 50, difficulty: 3, heat: 'sarten' },
    tags: [],
    includes: ['Garam masala', 'Especias para el marinado', 'Tomate concentrado', 'Mezcla para naan', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, leche.' },
      { label: 'Lo que pones tú', value: 'Muslos de pollo, yogur natural, mantequilla y nata.' },
      conservation,
      recipeCard,
    ],
    salesCount: 150,
    publishedDaysAgo: 70,
  },
  {
    slug: 'kit-gyozas-caseras',
    name: 'Kit Gyozas caseras',
    subtitle: 'Obleas, relleno y salsa ponzu. Aprende el pliegue perfecto.',
    description:
      'El reto del nivel 3: cerrar gyozas con sus pliegues. Trae obleas, la mezcla de especias para el relleno y salsa ponzu para mojar. En el vídeo te enseñamos el pliegue paso a paso y la técnica de vapor y sartén.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-GYO-2', price: 2490, stock: 18 },
      { name: '4 personas', sku: 'HDM-GYO-4', price: 4190, stock: 9 },
    ],
    images: [{ file: 'gyozas-1.jpg', alt: 'Gyozas al vapor en una vaporera de bambú' }],
    attributes: { minutes: 60, difficulty: 3, heat: 'sarten' },
    tags: [],
    includes: ['30 obleas para gyozas', 'Especias para el relleno', 'Salsa ponzu', 'Aceite de sésamo', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, soja, sésamo.' },
      { label: 'Lo que pones tú', value: 'Carne picada o tofu, col y cebolleta.' },
      conservation,
      recipeCard,
    ],
    badge: 'Nuevo',
    salesCount: 18,
    publishedDaysAgo: 9,
  },
  {
    slug: 'kit-pizza-napolitana',
    name: 'Kit Pizza napolitana',
    subtitle: 'Masa de larga fermentación, tomate San Marzano y orégano.',
    description:
      'Harina tipo 00, levadura y la técnica de la masa con reposo largo. Estiras a mano, horneas a máxima potencia y consigues un borde inflado y tostado. Incluye tomate San Marzano y orégano siciliano.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 pizzas', sku: 'HDM-PIZ-2', price: 2190, stock: 32 },
      { name: '4 pizzas', sku: 'HDM-PIZ-4', price: 3690, stock: 16 },
    ],
    images: [
      { file: 'pizza-1.jpg', alt: 'Pizza margarita recién horneada con romero' },
      { file: 'pizza-2.jpg', alt: 'Pizza cortada en porciones sobre una tabla' },
    ],
    attributes: { minutes: 45, difficulty: 3, heat: 'horno' },
    tags: ['vegetariano'],
    includes: ['Harina tipo 00', 'Levadura seca', 'Tomate San Marzano', 'Orégano siciliano', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten.' },
      { label: 'Lo que pones tú', value: 'Mozzarella, albahaca fresca y aceite de oliva.' },
      { label: 'Tiempo de reposo', value: 'La masa necesita entre 8 y 24 horas de reposo en nevera.' },
      conservation,
      recipeCard,
    ],
    salesCount: 260,
    publishedDaysAgo: 140,
  },
  {
    slug: 'kit-yakisoba',
    name: 'Kit Yakisoba',
    subtitle: 'Fideos salteados al wok con salsa yakisoba y verduras.',
    description:
      'Fideos de trigo salteados a fuego fuerte con verduras crujientes y salsa yakisoba casera. Aprendes la técnica del salteado rápido: todo cortado antes, sartén muy caliente y movimiento constante.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-YAK-2', price: 2390, stock: 24 },
      { name: '4 personas', sku: 'HDM-YAK-4', price: 3990, stock: 12 },
    ],
    images: [
      { file: 'noodles-1.jpg', alt: 'Fideos salteados con chile en un plato negro' },
      { file: 'noodles-2.jpg', alt: 'Bol de fideos con caldo, lima y verduras' },
    ],
    attributes: { minutes: 25, difficulty: 3, heat: 'sarten' },
    tags: ['vegano'],
    includes: ['Fideos de trigo', 'Salsa yakisoba', 'Jengibre deshidratado', 'Sésamo tostado', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Alérgenos', value: 'Gluten, soja, sésamo.' },
      { label: 'Lo que pones tú', value: 'Col, zanahoria, cebolla y pimiento.' },
      conservation,
      recipeCard,
    ],
    salesCount: 88,
    publishedDaysAgo: 50,
  },

  // Caja sorpresa
  {
    slug: 'caja-sorpresa',
    name: 'Caja sorpresa',
    subtitle: 'Un kit nuevo cada mes. No sabrás cuál hasta abrir la caja.',
    description:
      'Cada mes enviamos un kit distinto, elegido entre los tres niveles y con recetas que no están en la tienda. Pagas por adelantado 1, 3 o 6 meses (cuantos más, más barato) y la recibes la primera semana de cada mes. No es una suscripción: no se renueva sola.',
    category: 'caja-sorpresa',
    variants: [
      { name: '1 mes', sku: 'HDM-SRP-1', price: 3490, stock: 100 },
      { name: '3 meses', sku: 'HDM-SRP-3', price: 9900, compareAt: 10470, stock: 100 },
      { name: '6 meses', sku: 'HDM-SRP-6', price: 18900, compareAt: 20940, stock: 100 },
    ],
    images: [
      { file: 'sorpresa-1.jpg', alt: 'Mesa llena de ingredientes, frutas y especias' },
      { file: 'sorpresa-2.jpg', alt: 'Platos variados con carne, ensalada y especias' },
    ],
    attributes: { minutes: 40, difficulty: 2, heat: 'sarten' },
    tags: [],
    includes: ['Un kit sorpresa al mes', 'Receta exclusiva con QR', 'Pegatina de nivel para coleccionar'],
    specs: [
      { label: 'Envíos', value: 'La primera semana de cada mes, a la misma dirección.' },
      { label: 'Renovación', value: 'Sin renovación automática.' },
      { label: 'Alérgenos', value: 'Variables según el kit. Te avisamos por email antes de cada envío.' },
    ],
    featured: true,
    salesCount: 64,
    publishedDaysAgo: 30,
  },
]

export const demoPromotions: DemoPromotion[] = [
  { code: 'BIENVENIDA10', description: '10 % en tu primer pedido desde 20 €', kind: 'percent', value: 10, minSubtotal: 2000 },
  { code: 'HAMBRE5', description: '5 € de descuento desde 40 €', kind: 'fixed', value: 500, minSubtotal: 4000 },
]
