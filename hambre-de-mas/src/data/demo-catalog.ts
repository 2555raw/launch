/**
 * Catálogo de DEMOSTRACIÓN de Hambre de Más.
 *
 * Es la única fuente de los datos de ejemplo:
 *  - `npm run db:seed:generate` lo convierte en supabase/seed.sql.
 *  - Sin Supabase configurado, la tienda lo usa en modo demo (solo lectura).
 *
 * Modelo de producto: los niveles 1 y 2 llevan ingredientes 100 % secos (el
 * cliente solo pone agua y, como mucho, un chorrito de aceite); el nivel 3
 * incluye ingredientes frescos y se envía refrigerado.
 *
 * Todos los productos llevan is_demo = true. Para pasar a producción, bórralos
 * desde el panel (o con `delete from products where is_demo`) y crea los tuyos.
 * Las fotos son de Unsplash (licencia Unsplash) y están en public/demo.
 */

import type { Allergen } from '@/lib/allergens'

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

export type DemoRecipe = {
  /** Lo que tiene que poner el cliente (en niveles 1 y 2, solo agua y aceite). */
  youAdd: string[]
  steps: { title: string; text: string }[]
  tips: string[]
}

export type DemoProduct = {
  slug: string
  name: string
  subtitle: string
  description: string
  category: string
  variants: DemoVariant[]
  images: { file: string; alt: string }[]
  attributes: {
    minutes: number
    difficulty: 1 | 2 | 3
    heat: 'sin-fuego' | 'microondas' | 'sarten' | 'cazo' | 'horno'
    /** seco: se conserva en la despensa · fresco: incluye refrigerados */
    storage: 'seco' | 'fresco'
  }
  tags: string[]
  /** Alérgenos del kit, trazas y los que añade lo que pone el cliente (ver src/lib/allergens.ts). */
  allergens: { contains: Allergen[]; traces?: Allergen[]; recipe?: Allergen[] }
  includes: string[]
  specs: { label: string; value: string }[]
  recipe: DemoRecipe
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
    tagline: 'Sin fuego o con microondas · 100 % seco',
    description: 'El nivel 1. Todo llega seco y listo para la despensa: tú solo pones agua. Nada de fuegos, como mucho un microondas.',
    level: 1,
    accent: 'chef',
    image: '/demo/products/wraps-1.jpg',
    position: 1,
  },
  {
    slug: 'con-ganas',
    name: 'Con ganas',
    tagline: 'Sartén y cazo · 100 % seco',
    description: 'El nivel 2. Sigue siendo todo seco, pero toca encender el fuego: sartén, cazo y recetas que impresionan. Tú pones agua y un chorrito de aceite.',
    level: 2,
    accent: 'hoja',
    image: '/demo/products/ramen-1.jpg',
    position: 2,
  },
  {
    slug: 'hambre-de-mas',
    name: 'Hambre de más',
    tagline: 'Recetas del mundo · con ingredientes frescos',
    description: 'El nivel 3. Ya sabes cocinar: este kit trae también los ingredientes frescos (carne, verdura, lácteos) y llega refrigerado.',
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

const dryConservation = { label: 'Conservación', value: 'Despensa: lugar fresco y seco. Consumo preferente: 6 meses desde el envío.' }
const freshConservation = {
  label: 'Conservación',
  value: 'Llega refrigerado. Guarda los frescos en la nevera nada más recibirlo y cocínalo en 3 días.',
}
const recipeCard = { label: 'Receta', value: 'Tarjeta con QR: escanéalo y verás la receta paso a paso en el móvil.' }

export const demoProducts: DemoProduct[] = [
  // Nivel 1 · Primer bocado (100 % seco)
  {
    slug: 'kit-wraps-crujientes',
    name: 'Kit Wraps crujientes',
    subtitle: 'Wraps de hummus y verduras crujientes. Sin fuego y sin nevera.',
    description:
      'Tu primera receta sin encender nada. Tortillas de trigo que aguantan en la despensa, hummus que se prepara con agua en un minuto y verduras liofilizadas que crujen como recién cortadas. Enrollas, cortas y listo.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-WRP-2', price: 1690, stock: 40 },
      { name: '4 personas', sku: 'HDM-WRP-4', price: 2990, stock: 25 },
    ],
    images: [
      { file: 'wraps-1.jpg', alt: 'Dos wraps de verduras cortados por la mitad' },
      { file: 'wraps-2.jpg', alt: 'Ingredientes sobre una tabla de cortar' },
    ],
    attributes: { minutes: 15, difficulty: 1, heat: 'sin-fuego', storage: 'seco' },
    tags: ['vegano', 'vegetariano'],
    allergens: { contains: ['gluten', 'sesamo'], traces: ['soja'] },
    includes: ['6 tortillas de trigo', 'Sobre de hummus (garbanzo y tahini)', 'Verduras crujientes liofilizadas', 'Sobre de especias suaves', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['100 ml de agua'],
      steps: [
        { title: 'Prepara el hummus', text: 'Echa el sobre de hummus en un bol, añade 100 ml de agua fría poco a poco y mezcla con un tenedor hasta que quede cremoso.' },
        { title: 'Despierta las verduras', text: 'Abre la bolsa de verduras liofilizadas y sacúdela con la mezcla de especias dentro. Quedan crujientes y con sabor.' },
        { title: 'Unta las tortillas', text: 'Extiende dos cucharadas de hummus en cada tortilla, dejando un dedo libre en el borde.' },
        { title: 'Rellena y enrolla', text: 'Reparte las verduras en una tira en el centro. Dobla los lados hacia dentro y enrolla apretando.' },
        { title: 'Corta y a comer', text: 'Corta cada wrap en diagonal con un cuchillo de sierra. Si no te los comes ya, envuélvelos en papel de horno.' },
      ],
      tips: ['Si el hummus queda espeso, añade agua a cucharaditas.', 'Calienta la tortilla 10 segundos en el microondas para que no se rompa al enrollar.'],
    },
    salesCount: 120,
    publishedDaysAgo: 120,
  },
  {
    slug: 'kit-bowl-arcoiris',
    name: 'Kit Bowl arcoíris',
    subtitle: 'Cuscús al microondas, garbanzos especiados y verduras de colores.',
    description:
      'Un bowl que entra por los ojos y sale de la despensa. El cuscús se hace en el microondas en cinco minutos, los garbanzos vienen cocidos y listos para especiar y las verduras liofilizadas dan el color. El aliño de tahini lo une todo.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-BWL-2', price: 1590, stock: 35 },
      { name: '4 personas', sku: 'HDM-BWL-4', price: 2790, stock: 20 },
    ],
    images: [
      { file: 'bowl-1.jpg', alt: 'Bowl con garbanzos, tomate y lombarda' },
      { file: 'bowl-2.jpg', alt: 'Bowl de verduras de colores visto desde arriba' },
    ],
    attributes: { minutes: 15, difficulty: 1, heat: 'microondas', storage: 'seco' },
    tags: ['vegano', 'vegetariano'],
    allergens: { contains: ['gluten', 'sesamo'] },
    includes: ['Cuscús', 'Garbanzos cocidos (bote)', 'Sobre de especias tostadas', 'Verduras liofilizadas', 'Aliño de tahini', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['Agua (la misma cantidad que de cuscús)'],
      steps: [
        { title: 'Cuscús al microondas', text: 'Pon el cuscús en un bol apto para microondas con el mismo volumen de agua y una pizca de sal. Calienta 2 minutos, tapa con un plato y deja reposar 3.' },
        { title: 'Especia los garbanzos', text: 'Escurre y enjuaga los garbanzos del bote. Mézclalos con las especias tostadas.' },
        { title: 'Hidrata las verduras', text: 'Pon las verduras en un vaso con un poco de agua fría 2 minutos y escúrrelas.' },
        { title: 'Monta el bowl', text: 'Base de cuscús suelto con un tenedor, y encima, por zonas, garbanzos y verduras. Que se vean los colores.' },
        { title: 'Aliña', text: 'Mezcla el aliño de tahini con dos cucharadas de agua y riégalo por encima.' },
      ],
      tips: ['El bowl aguanta un día en la nevera: perfecto para llevar al instituto.'],
    },
    featured: true,
    salesCount: 95,
    publishedDaysAgo: 90,
  },
  {
    slug: 'kit-parfait-frutos-rojos',
    name: 'Kit Parfait de frutos rojos',
    subtitle: 'Crema de yogur que se monta con agua, granola y frutos rojos.',
    description:
      'Capas de crema de yogur (viene en polvo y se monta con agua fría), granola con miel y frutos rojos liofilizados que recuperan todo su sabor. Montas cuatro tarros en diez minutos.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-PRF-2', price: 1290, compareAt: 1490, stock: 50 },
      { name: '4 personas', sku: 'HDM-PRF-4', price: 2190, compareAt: 2490, stock: 30 },
    ],
    images: [
      { file: 'parfait-1.jpg', alt: 'Tarros de yogur con fresas' },
      { file: 'parfait-2.jpg', alt: 'Bol de fruta variada' },
    ],
    attributes: { minutes: 10, difficulty: 1, heat: 'sin-fuego', storage: 'seco' },
    tags: ['vegetariano'],
    allergens: { contains: ['gluten', 'leche', 'frutos-de-cascara'] },
    includes: ['Sobre de crema de yogur', 'Granola con miel', 'Frutos rojos liofilizados', 'Sobre de semillas de chía', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua fría.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['200 ml de agua muy fría'],
      steps: [
        { title: 'Monta la crema', text: 'Mezcla el sobre de crema de yogur con 200 ml de agua muy fría y bate con unas varillas 2 minutos, hasta que espese.' },
        { title: 'Primera capa', text: 'Pon dos cucharadas de granola en el fondo de cada vaso o tarro.' },
        { title: 'Crema y fruta', text: 'Añade una capa de crema y unos frutos rojos. Repite hasta llenar.' },
        { title: 'Remata', text: 'Termina con granola, frutos rojos y una pizca de chía por encima.' },
      ],
      tips: ['Si lo dejas para mañana, guarda la granola aparte para que siga crujiente.'],
    },
    badge: 'Oferta',
    salesCount: 80,
    publishedDaysAgo: 60,
  },
  {
    slug: 'kit-tostadas-aguacate',
    name: 'Kit Tostadas de guacamole',
    subtitle: 'Guacamole liofilizado, pan crujiente y semillas con chile suave.',
    description:
      'Guacamole hecho con aguacate liofilizado: se prepara con agua y sabe a recién hecho. Lo untas en pan de masa madre tostado y rematas con nuestra mezcla de semillas y chile suave.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-TST-2', price: 1390, stock: 3 },
      { name: '4 personas', sku: 'HDM-TST-4', price: 2390, stock: 12 },
    ],
    images: [{ file: 'tostadas-1.jpg', alt: 'Tostada con aguacate y huevo (sugerencia de presentación)' }],
    attributes: { minutes: 10, difficulty: 1, heat: 'sin-fuego', storage: 'seco' },
    tags: ['vegano', 'vegetariano'],
    allergens: { contains: ['gluten', 'sesamo'] },
    includes: ['Pan de masa madre tostado', 'Guacamole liofilizado', 'Sobre de semillas y chile suave', 'Sobre de escamas de sal', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['80 ml de agua', 'Opcional, como en la foto: un huevo cocido y unas hojas de espinaca'],
      steps: [
        { title: 'Haz el guacamole', text: 'Echa el guacamole en polvo en un bol y añade 80 ml de agua. Mezcla y deja reposar 2 minutos para que se hidrate.' },
        { title: 'Prepara el pan', text: 'Saca las rebanadas de pan tostado. Si te gusta templado, 20 segundos en el microondas.' },
        { title: 'Unta', text: 'Reparte el guacamole con una cuchara, sin miedo.' },
        { title: 'Remata', text: 'Espolvorea las semillas con chile y unas escamas de sal. ¡A comer!' },
      ],
      tips: ['Para un toque ácido, añade unas gotas de limón si tienes en casa.'],
    },
    badge: 'Nuevo',
    salesCount: 12,
    publishedDaysAgo: 6,
  },

  // Nivel 2 · Con ganas (100 % seco, con fuego)
  {
    slug: 'kit-ramen-casero',
    name: 'Kit Ramen casero',
    subtitle: 'Caldo de miso, fideos ramen y toppings deshidratados. El que te convierte en chef.',
    description:
      'Nuestro kit estrella y 100 % de despensa. Fideos ramen de verdad, caldo de miso, setas shiitake y cebolleta deshidratadas, alga nori y aceite de chile y sésamo. Un bol que no tiene nada que envidiar al de tu restaurante favorito.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-RAM-2', price: 3500, stock: 60 },
      { name: '4 personas', sku: 'HDM-RAM-4', price: 5900, stock: 30 },
    ],
    images: [
      { file: 'ramen-1.jpg', alt: 'Bol de ramen con huevo y gambas (sugerencia de presentación)' },
      { file: 'ramen-2.jpg', alt: 'Ramen en un bol oscuro' },
    ],
    attributes: { minutes: 25, difficulty: 2, heat: 'cazo', storage: 'seco' },
    tags: [],
    allergens: { contains: ['gluten', 'soja', 'sesamo'] },
    includes: ['Fideos ramen', 'Sobre de caldo de miso', 'Setas shiitake deshidratadas', 'Cebolleta liofilizada', 'Alga nori', 'Aceite de chile y sésamo', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['1 litro de agua (2 personas)', 'Opcional, para dejarlo como en la foto: huevos cocidos y gambas'],
      steps: [
        { title: 'Hidrata las setas', text: 'Pon las setas shiitake en un vaso con agua caliente del grifo 10 minutos. Guarda esa agua: tiene mucho sabor.' },
        { title: 'Haz el caldo', text: 'En un cazo, calienta el agua (incluida la de las setas). Cuando hierva, baja el fuego y disuelve el caldo de miso removiendo. Que no vuelva a hervir fuerte.' },
        { title: 'Cuece los fideos', text: 'En otro cazo con agua hirviendo, cuece los fideos 3 minutos. Escúrrelos y repártelos en los boles.' },
        { title: 'Monta el bol', text: 'Vierte el caldo caliente sobre los fideos. Añade las setas escurridas y la cebolleta.' },
        { title: 'Toque final', text: 'Pon un trozo de alga nori en el borde del bol y unas gotas de aceite de chile y sésamo. ¡Itadakimasu!' },
      ],
      tips: ['Los fideos se cuecen aparte para que el caldo no quede turbio.', 'Más picante: más aceite de chile. Menos: solo sésamo.'],
    },
    featured: true,
    badge: 'Más vendido',
    salesCount: 340,
    publishedDaysAgo: 150,
  },
  {
    slug: 'kit-tacos-al-pastor',
    name: 'Kit Tacos al pastor',
    subtitle: 'Soja texturizada al pastor, tortillas de maíz y salsa de piña.',
    description:
      'Tacos con soja texturizada marinada en adobo al pastor, hechos a la sartén. Textura de carne picada sin necesidad de nevera. El kit trae las tortillas de maíz y una salsa de piña con un punto picante.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-TAC-2', price: 2290, stock: 28 },
      { name: '4 personas', sku: 'HDM-TAC-4', price: 3890, stock: 18 },
    ],
    images: [{ file: 'tacos-1.jpg', alt: 'Plato con tres tacos de verduras' }],
    attributes: { minutes: 25, difficulty: 2, heat: 'sarten', storage: 'seco' },
    tags: ['vegano', 'picante', 'sin-gluten'],
    allergens: { contains: ['soja'], traces: ['gluten'] },
    includes: ['Soja texturizada', 'Sobre de adobo al pastor', '12 tortillas de maíz', 'Salsa de piña y chile', 'Cebolla crujiente', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y un chorrito de aceite.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['300 ml de agua caliente', '2 cucharadas de aceite'],
      steps: [
        { title: 'Hidrata la soja', text: 'Cubre la soja texturizada con agua caliente 10 minutos. Escúrrela apretando con una cuchara.' },
        { title: 'Marina', text: 'Mezcla la soja con el adobo al pastor y deja que coja sabor mientras calientas la sartén.' },
        { title: 'Dora en la sartén', text: 'Sartén a fuego medio-alto con el aceite. Saltea la soja 6-8 minutos hasta que se dore por los bordes.' },
        { title: 'Calienta las tortillas', text: 'En la misma sartén, ya sin aceite, 20 segundos por cada lado.' },
        { title: 'Monta los tacos', text: 'Tortilla, soja al pastor, salsa de piña y cebolla crujiente. Dobla y muerde.' },
      ],
      tips: ['Apila las tortillas calientes envueltas en un paño para que no se sequen.'],
    },
    featured: true,
    salesCount: 175,
    publishedDaysAgo: 100,
  },
  {
    slug: 'kit-tortitas-americanas',
    name: 'Kit Tortitas americanas',
    subtitle: 'Mezcla completa: solo añades agua. Esponjosas, altas y con sirope.',
    description:
      'La mezcla ya lleva la leche y el huevo en polvo, así que solo añades agua. Te enseñamos a controlar el fuego de la sartén para que salgan doradas y altísimas. Incluye sirope de arce y pepitas de chocolate.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-TRT-2', price: 1490, stock: 45 },
      { name: '4 personas', sku: 'HDM-TRT-4', price: 2490, stock: 22 },
    ],
    images: [
      { file: 'tortitas-1.jpg', alt: 'Torre de tortitas con plátano y sirope' },
      { file: 'tortitas-2.jpg', alt: 'Tostadas francesas con arándanos y plátano' },
    ],
    attributes: { minutes: 20, difficulty: 2, heat: 'sarten', storage: 'seco' },
    tags: ['vegetariano'],
    allergens: { contains: ['gluten', 'leche', 'huevos'], traces: ['frutos-de-cascara'] },
    includes: ['Mezcla completa para tortitas', 'Sirope de arce', 'Pepitas de chocolate', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y un poco de aceite.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['250 ml de agua', 'Unas gotas de aceite'],
      steps: [
        { title: 'Haz la masa', text: 'Mezcla la mezcla para tortitas con 250 ml de agua usando unas varillas. Que queden algunos grumitos: así salen más esponjosas.' },
        { title: 'Reposo', text: 'Deja la masa 5 minutos mientras se calienta la sartén a fuego medio-bajo.' },
        { title: 'Engrasa poco', text: 'Unas gotas de aceite repartidas con papel de cocina. La sartén debe brillar, no tener charco.' },
        { title: 'Primera vuelta', text: 'Vierte un cazo de masa. Cuando salgan burbujas en la superficie (1-2 minutos), dale la vuelta.' },
        { title: 'Apila y decora', text: 'Un minuto más y a la torre. Remata con sirope y pepitas de chocolate.' },
      ],
      tips: ['La primera tortita casi nunca sale bien: es la de prueba.', 'Si se queman por fuera y están crudas por dentro, baja el fuego.'],
    },
    salesCount: 210,
    publishedDaysAgo: 130,
  },
  {
    slug: 'kit-penne-arrabbiata',
    name: "Kit Penne all'arrabbiata",
    subtitle: 'La salsa de tomate picante más famosa de Roma.',
    description:
      'Penne rigate de trigo duro, tomate triturado italiano y nuestra mezcla de guindilla y ajo deshidratado. Aprendes a sofreír sin quemar y a ligar la salsa con el agua de la pasta como en Italia.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-PEN-2', price: 1690, stock: 30 },
      { name: '4 personas', sku: 'HDM-PEN-4', price: 2890, stock: 0 },
    ],
    images: [
      { file: 'pasta-1.jpg', alt: 'Plato de penne con salsa de tomate' },
      { file: 'pasta-2.jpg', alt: 'Sartén con pasta' },
    ],
    attributes: { minutes: 20, difficulty: 2, heat: 'cazo', storage: 'seco' },
    tags: ['vegano', 'picante'],
    allergens: { contains: ['gluten'] },
    includes: ['Penne rigate', 'Tomate triturado italiano (brik)', 'Sobre de guindilla y ajo', 'Sobre de perejil', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite de oliva.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['2 litros de agua', '3 cucharadas de aceite de oliva'],
      steps: [
        { title: 'Agua a hervir', text: 'Pon a hervir 2 litros de agua con una cucharada de sal en un cazo grande.' },
        { title: 'Sofrito', text: 'En una sartén, calienta el aceite a fuego bajo con el ajo y la guindilla 1 minuto. Si el ajo se tuesta demasiado, amarga.' },
        { title: 'Salsa', text: 'Añade el tomate triturado y cocina 10 minutos a fuego medio, removiendo de vez en cuando.' },
        { title: 'Pasta', text: 'Cuece los penne el tiempo del paquete menos un minuto. Antes de escurrir, guarda medio vaso del agua de cocción.' },
        { title: 'Liga', text: 'Echa la pasta a la salsa con un chorrito del agua guardada y remueve a fuego fuerte 1 minuto hasta que brille. Perejil y a la mesa.' },
      ],
      tips: ['El agua de la pasta tiene almidón: es lo que hace que la salsa se pegue.'],
    },
    salesCount: 140,
    publishedDaysAgo: 80,
  },

  // Nivel 3 · Hambre de más (incluye frescos, envío refrigerado)
  {
    slug: 'kit-curry-rojo-thai',
    name: 'Kit Curry rojo de salmón',
    subtitle: 'Salmón fresco en curry rojo tailandés con leche de coco y arroz jazmín.',
    description:
      'Un viaje a Bangkok en 35 minutos. Nivel 3: el kit trae el salmón fresco y el limón, además de la pasta de curry rojo, la leche de coco, el arroz jazmín y las hierbas. Aprendes a marcar el pescado sin que se rompa y a equilibrar dulce, salado, ácido y picante.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-CUR-2', price: 2790, stock: 26 },
      { name: '4 personas', sku: 'HDM-CUR-4', price: 4690, stock: 14 },
    ],
    images: [
      { file: 'curry-1.jpg', alt: 'Lomos de salmón en salsa de curry rojo con rodajas de limón' },
      { file: 'curry-2.jpg', alt: 'Sartén de curry con hierbas frescas' },
    ],
    attributes: { minutes: 35, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: ['picante', 'sin-gluten'],
    allergens: { contains: ['pescado', 'crustaceos'] },
    includes: ['Lomos de salmón frescos', 'Limón', 'Pasta de curry rojo', 'Leche de coco', 'Arroz jazmín', 'Orégano fresco', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['Agua para el arroz', '1 cucharada de aceite'],
      steps: [
        { title: 'Arroz jazmín', text: 'Lava el arroz bajo el grifo hasta que el agua salga clara. Cuécelo con 1,5 veces su volumen de agua, tapado y a fuego bajo, 12 minutos. Reposa 5.' },
        { title: 'Seca el salmón', text: 'Saca el salmón de la nevera, sécalo bien con papel de cocina y ponle una pizca de sal. Seco se dora mejor y no salpica.' },
        { title: 'Marca el salmón', text: 'Sartén a fuego medio-alto con el aceite. Pon los lomos con la piel hacia abajo 3 minutos sin moverlos, dales la vuelta 1 minuto y sácalos a un plato.' },
        { title: 'La salsa', text: 'En la misma sartén, baja el fuego y remueve la pasta de curry 1 minuto. Añade la leche de coco y cocina 5 minutos hasta que espese un poco.' },
        { title: 'Junta todo', text: 'Vuelve a meter el salmón en la salsa 4 minutos a fuego suave. Está listo cuando se separa en láminas al tocarlo con un tenedor.' },
        { title: 'Sirve', text: 'Unas rodajas de limón y el orégano fresco por encima, y el arroz al lado.' },
      ],
      tips: ['Mueve el salmón lo menos posible: si lo tocas mucho, se rompe.', 'Si pica demasiado, añade más leche de coco.'],
    },
    featured: true,
    badge: 'Nuevo',
    salesCount: 30,
    publishedDaysAgo: 4,
  },
  {
    slug: 'kit-butter-chicken',
    name: 'Kit Butter chicken con naan',
    subtitle: 'Pollo fresco en salsa de tomate, mantequilla y garam masala.',
    description:
      'El plato indio que gusta a todo el mundo. Llega refrigerado con los muslos de pollo, el yogur, la nata y la mantequilla; además, especias, tomate y la mezcla para hacer naan en la sartén. Nivel 3 porque hay que coordinar tres elaboraciones a la vez.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-BTC-2', price: 2990, stock: 20 },
      { name: '4 personas', sku: 'HDM-BTC-4', price: 4990, stock: 10 },
    ],
    images: [
      { file: 'butter-1.jpg', alt: 'Butter chicken con pan naan' },
      { file: 'butter-2.jpg', alt: 'Cuencos de curry indio con arroz' },
    ],
    attributes: { minutes: 50, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: [],
    allergens: { contains: ['gluten', 'leche'] },
    includes: ['Muslos de pollo frescos', 'Yogur natural, nata y mantequilla', 'Sobres de garam masala y especias del marinado', 'Tomate concentrado', 'Mezcla para naan', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['120 ml de agua (para el naan)'],
      steps: [
        { title: 'Marina el pollo', text: 'Corta el pollo en trozos y mézclalo con la mitad del yogur y las especias del marinado. Deja 15 minutos en la nevera.' },
        { title: 'Masa de naan', text: 'Mezcla la harina de naan con el resto del yogur y 120 ml de agua. Amasa 3 minutos y deja reposar tapada.' },
        { title: 'Dora el pollo', text: 'Sartén caliente con la mitad de la mantequilla. Dora el pollo 6 minutos y sácalo.' },
        { title: 'La salsa', text: 'En la misma sartén, el resto de la mantequilla, el tomate y el garam masala 3 minutos. Añade la nata y vuelve a meter el pollo 10 minutos a fuego suave.' },
        { title: 'Naan a la sartén', text: 'Divide la masa en bolas, estíralas finas y cocínalas en una sartén sin aceite muy caliente, 1 minuto por lado, hasta que hagan burbujas.' },
        { title: 'Sirve', text: 'Butter chicken en un bol y naan caliente al lado para mojar.' },
      ],
      tips: ['Con tres cosas a la vez, prepara todo antes de encender el fuego.'],
    },
    salesCount: 150,
    publishedDaysAgo: 70,
  },
  {
    slug: 'kit-gyozas-caseras',
    name: 'Kit Gyozas caseras',
    subtitle: 'Obleas frescas, relleno de cerdo y col, y salsa ponzu.',
    description:
      'El reto del nivel 3: cerrar gyozas con sus pliegues. Llega refrigerado con las obleas, la carne picada y la col; además, especias para el relleno y salsa ponzu para mojar. Te enseñamos el pliegue y la técnica de vapor y sartén.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-GYO-2', price: 2490, stock: 18 },
      { name: '4 personas', sku: 'HDM-GYO-4', price: 4190, stock: 9 },
    ],
    images: [{ file: 'gyozas-1.jpg', alt: 'Gyozas al vapor en una vaporera de bambú' }],
    attributes: { minutes: 60, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: [],
    allergens: { contains: ['gluten', 'soja', 'sesamo'] },
    includes: ['30 obleas para gyozas', 'Carne picada de cerdo fresca', 'Col y cebolleta frescas', 'Sobre de especias para el relleno', 'Salsa ponzu', 'Aceite de sésamo', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['Un vasito de agua', '1 cucharada de aceite'],
      steps: [
        { title: 'Relleno', text: 'Pica la col y la cebolleta muy finas. Mézclalas con la carne y las especias hasta que quede una pasta.' },
        { title: 'Rellena', text: 'Pon una cucharadita de relleno en el centro de cada oblea y moja el borde con un dedo húmedo.' },
        { title: 'El pliegue', text: 'Dobla por la mitad y, desde un extremo, haz 5 o 6 pliegues en la cara de delante, apretando contra la de detrás.' },
        { title: 'Dora', text: 'Sartén con aceite a fuego medio. Coloca las gyozas de pie y dóralas 2 minutos por la base.' },
        { title: 'Vapor', text: 'Echa medio vaso de agua y tapa enseguida (¡cuidado con las salpicaduras!). Cocina 6 minutos hasta que se evapore el agua.' },
        { title: 'Sirve', text: 'Con la base crujiente hacia arriba y ponzu con sésamo para mojar.' },
      ],
      tips: ['Las primeras quedan feas: a la décima te salen perfectas.', 'Puedes congelarlas crudas y cocinarlas otro día.'],
    },
    badge: 'Nuevo',
    salesCount: 18,
    publishedDaysAgo: 9,
  },
  {
    slug: 'kit-pizza-napolitana',
    name: 'Kit Pizza napolitana',
    subtitle: 'Masa de larga fermentación, mozzarella fresca y albahaca.',
    description:
      'Harina tipo 00, levadura y tomate San Marzano, más los frescos: mozzarella fior di latte y albahaca. Estiras a mano, horneas a máxima potencia y consigues un borde inflado y tostado.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 pizzas', sku: 'HDM-PIZ-2', price: 2190, stock: 32 },
      { name: '4 pizzas', sku: 'HDM-PIZ-4', price: 3690, stock: 16 },
    ],
    images: [
      { file: 'pizza-1.jpg', alt: 'Pizza margarita recién horneada' },
      { file: 'pizza-2.jpg', alt: 'Pizza cortada en porciones' },
    ],
    attributes: { minutes: 45, difficulty: 3, heat: 'horno', storage: 'fresco' },
    tags: ['vegetariano'],
    allergens: { contains: ['gluten', 'leche'] },
    includes: ['Harina tipo 00', 'Sobre de levadura seca', 'Tomate San Marzano', 'Mozzarella fior di latte fresca', 'Albahaca fresca', 'Tarjeta de receta con QR'],
    specs: [
      { label: 'Tú pones', value: 'Agua templada y aceite de oliva.' },
      { label: 'Tiempo de reposo', value: 'La masa necesita entre 8 y 24 horas de reposo en nevera.' },
      freshConservation,
      recipeCard,
    ],
    recipe: {
      youAdd: ['300 ml de agua templada', '1 cucharada de aceite de oliva'],
      steps: [
        { title: 'La masa (el día antes)', text: 'Mezcla la harina, la levadura, una cucharadita de sal y el agua templada. Amasa 10 minutos hasta que esté lisa, haz bolas y guárdalas tapadas en la nevera de 8 a 24 horas.' },
        { title: 'Atempera', text: 'Saca las bolas de la nevera 1 hora antes y pon el horno a la máxima temperatura con la bandeja dentro.' },
        { title: 'Estira a mano', text: 'Aplasta la bola desde el centro hacia fuera, dejando el borde gordito. Nada de rodillo: aplastaría el aire.' },
        { title: 'Monta', text: 'Tomate aplastado con la mano, mozzarella escurrida y troceada, un chorrito de aceite.' },
        { title: 'Hornea', text: 'Sobre la bandeja caliente, 7-9 minutos hasta que el borde esté inflado y con manchas tostadas.' },
        { title: 'Albahaca', text: 'Al sacarla, unas hojas de albahaca fresca. Corta y comparte (o no).' },
      ],
      tips: ['Usa guantes de horno para sacar la bandeja: está ardiendo.'],
    },
    salesCount: 260,
    publishedDaysAgo: 140,
  },
  {
    slug: 'kit-yakisoba',
    name: 'Kit Yakisoba',
    subtitle: 'Fideos salteados al wok con verduras frescas y salsa yakisoba.',
    description:
      'Fideos de trigo salteados a fuego fuerte con verduras frescas (col, zanahoria, pimiento y cebolla, ya incluidas) y salsa yakisoba casera. Aprendes la técnica del salteado: todo cortado antes, sartén muy caliente y movimiento constante.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-YAK-2', price: 2390, stock: 24 },
      { name: '4 personas', sku: 'HDM-YAK-4', price: 3990, stock: 12 },
    ],
    images: [
      { file: 'noodles-1.jpg', alt: 'Fideos salteados en un plato negro' },
      { file: 'noodles-2.jpg', alt: 'Bol de fideos con lima y verduras' },
    ],
    attributes: { minutes: 25, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: ['vegano'],
    allergens: { contains: ['gluten', 'soja', 'sesamo'] },
    includes: ['Fideos de trigo', 'Col, zanahoria, pimiento y cebolla frescos', 'Salsa yakisoba', 'Jengibre', 'Sobre de sésamo tostado', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['Agua para los fideos', '2 cucharadas de aceite'],
      steps: [
        { title: 'Corta todo antes', text: 'Col en tiras, zanahoria en bastones finos, pimiento y cebolla en tiras. El salteado va tan rápido que no da tiempo después.' },
        { title: 'Fideos', text: 'Cuécelos 3 minutos, escúrrelos y pásalos por agua fría para que no se peguen.' },
        { title: 'Sartén muy caliente', text: 'Aceite a fuego fuerte. Saltea la cebolla y la zanahoria 2 minutos sin parar de mover.' },
        { title: 'Resto de verduras', text: 'Añade la col, el pimiento y el jengibre. 2 minutos más: deben quedar crujientes.' },
        { title: 'Todo junto', text: 'Fideos y salsa yakisoba. Mezcla 1 minuto a fuego fuerte y termina con sésamo tostado.' },
      ],
      tips: ['Si tu sartén es pequeña, hazlo en dos tandas: si la llenas, las verduras se cuecen en vez de saltearse.'],
    },
    salesCount: 88,
    publishedDaysAgo: 50,
  },

  // Caja sorpresa
  {
    slug: 'caja-sorpresa',
    name: 'Caja sorpresa',
    subtitle: 'Un kit nuevo cada mes. No sabrás cuál hasta abrir la caja.',
    description:
      'Cada mes enviamos un kit distinto con recetas que no están en la tienda. Las cajas de 1 y 3 meses son de niveles 1 y 2 (100 % secas); la de 6 meses incluye un kit de nivel 3 con frescos. Pagas por adelantado y la recibes la primera semana de cada mes. No se renueva sola.',
    category: 'caja-sorpresa',
    variants: [
      { name: '1 mes', sku: 'HDM-SRP-1', price: 3490, stock: 100 },
      { name: '3 meses', sku: 'HDM-SRP-3', price: 9900, compareAt: 10470, stock: 100 },
      { name: '6 meses', sku: 'HDM-SRP-6', price: 18900, compareAt: 20940, stock: 100 },
    ],
    images: [
      { file: 'sorpresa-1.jpg', alt: 'Mesa llena de ingredientes, frutas y especias' },
      { file: 'sorpresa-2.jpg', alt: 'Platos variados con especias' },
    ],
    attributes: { minutes: 40, difficulty: 2, heat: 'sarten', storage: 'seco' },
    tags: [],
    allergens: { contains: [] },
    includes: ['Un kit sorpresa al mes', 'Receta exclusiva con QR', 'Pegatina de nivel para coleccionar'],
    specs: [
      { label: 'Envíos', value: 'La primera semana de cada mes, a la misma dirección.' },
      { label: 'Renovación', value: 'Sin renovación automática.' },
      { label: 'Alérgenos', value: 'Variables según el kit. Te avisamos por email antes de cada envío.' },
    ],
    recipe: {
      youAdd: ['Depende del kit del mes'],
      steps: [
        { title: 'Abre la caja', text: 'Dentro encontrarás el kit del mes y su tarjeta con un QR propio.' },
        { title: 'Escanea su QR', text: 'Cada kit sorpresa trae su propia receta paso a paso.' },
        { title: 'Colecciona', text: 'Pega la pegatina de nivel en tu tarjeta de progreso.' },
      ],
      tips: ['Si tienes alguna alergia, indícanoslo al comprar y adaptamos la caja.'],
    },
    featured: true,
    salesCount: 64,
    publishedDaysAgo: 30,
  },
]

export const demoPromotions: DemoPromotion[] = [
  { code: 'BIENVENIDA10', description: '10 % en tu primer pedido desde 20 €', kind: 'percent', value: 10, minSubtotal: 2000 },
  { code: 'HAMBRE5', description: '5 € de descuento desde 40 €', kind: 'fixed', value: 500, minSubtotal: 4000 },
]
