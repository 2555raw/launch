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
    tagline: 'Sin fuego o con microondas · 100\u00a0% seco',
    description: 'El nivel 1. Todo llega seco y listo para la despensa: tú solo pones agua. Nada de fuegos, como mucho un microondas.',
    level: 1,
    accent: 'chef',
    image: '/demo/products/wraps-1.jpg',
    position: 1,
  },
  {
    slug: 'con-ganas',
    name: 'Con ganas',
    tagline: 'Sartén y cazo · 100\u00a0% seco',
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
      { name: '4 personas', sku: 'HDM-BWL-4', price: 2790, compareAt: 3180, stock: 20 },
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
    salesCount: 12,
    publishedDaysAgo: 52,
  },

  {
    slug: 'kit-onigiris-atun',
    name: 'Kit Onigiris de atún',
    subtitle: 'Bolas de arroz japonés con atún, mayonesa y furikake. Al microondas.',
    description:
      'El snack japonés más famoso, sin encender el fuego. Arroz japonés ya cocido que se calienta en el microondas, atún en lata, mayonesa y furikake (sésamo y alga) para rebozarlos. Les das forma de triángulo con las manos y los envuelves en alga nori.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-ONI-2', price: 1590, stock: 30 },
      { name: '4 personas', sku: 'HDM-ONI-4', price: 2790, stock: 18 },
    ],
    images: [
      { file: 'onigiri-1.jpg', alt: 'Onigiri rebozado en furikake sobre una hoja de alga (sugerencia de presentación)' },
      { file: 'onigiri-2.jpg', alt: 'Manos sujetando un onigiri envuelto en alga' },
    ],
    attributes: { minutes: 15, difficulty: 1, heat: 'microondas', storage: 'seco' },
    tags: ['sin-gluten'],
    allergens: { contains: ['pescado', 'huevos', 'sesamo', 'soja'] },
    includes: ['Vasitos de arroz japonés ya cocido', 'Lata de atún al natural', 'Sobre de mayonesa', 'Sobre de furikake (sésamo y alga)', 'Láminas de alga nori', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Nada: solo un microondas.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['Nada: solo un microondas y un poco de agua para mojarte las manos'],
      steps: [
        { title: 'Calienta el arroz', text: 'Abre un poco la tapa de los vasitos y caliéntalos 1 minuto en el microondas. Deja que se templen para no quemarte.' },
        { title: 'Prepara el relleno', text: 'Escurre el atún y mézclalo en un bol con la mayonesa.' },
        { title: 'Forma los onigiris', text: 'Mójate las manos, coge un puñado de arroz, haz un hueco en el centro, pon una cucharada de relleno y ciérralo apretando hasta formar un triángulo.' },
        { title: 'Reboza', text: 'Pasa los lados por el furikake para que se peguen el sésamo y el alga.' },
        { title: 'Envuelve', text: 'Pon una tira de alga nori en la base justo antes de comer, para que cruja.' },
      ],
      tips: ['Con las manos mojadas el arroz no se pega.', 'Para llevar al instituto, envuelve cada onigiri en film y pon el alga al comer.'],
    },
    salesCount: 22,
    publishedDaysAgo: 38,
  },

  {
    slug: 'kit-mug-cake-chocolate',
    name: 'Kit Mug cake de chocolate',
    subtitle: 'Bizcocho de chocolate en taza, con corazón fundido. 90 segundos de microondas.',
    description:
      'El postre más rápido del mundo. Una mezcla de bizcocho de chocolate que ya lleva la leche y el huevo en polvo, pepitas de chocolate para el corazón fundido y un sobre de cacao para decorar. Solo añades agua, remueves en la taza y al microondas.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-MUG-2', price: 990, stock: 60 },
      { name: '4 personas', sku: 'HDM-MUG-4', price: 1690, stock: 35 },
    ],
    images: [{ file: 'mug-cake-1.jpg', alt: 'Taza con bizcocho de chocolate esponjoso y una cuchara (sugerencia de presentación)' }],
    attributes: { minutes: 5, difficulty: 1, heat: 'microondas', storage: 'seco' },
    tags: ['vegetariano'],
    allergens: { contains: ['gluten', 'leche', 'huevos'], traces: ['frutos-de-cascara', 'soja'] },
    includes: ['Mezcla de bizcocho de chocolate', 'Pepitas de chocolate', 'Sobre de cacao en polvo', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y una taza grande.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['4 cucharadas de agua por taza', 'Una taza grande apta para microondas'],
      steps: [
        { title: 'Mezcla en la taza', text: 'Vacía un sobre de mezcla en una taza grande, añade el agua y remueve con un tenedor hasta que no queden grumos.' },
        { title: 'Esconde el chocolate', text: 'Hunde la mitad de las pepitas de chocolate en el centro: será el corazón fundido.' },
        { title: 'Al microondas', text: '90 segundos a máxima potencia. Sube mucho: es normal.' },
        { title: 'Decora', text: 'Espera un minuto (la taza quema), espolvorea el cacao y pon el resto de pepitas encima.' },
      ],
      tips: ['Si al pincharlo sale muy líquido, dale 15 segundos más.', 'Con una bola de helado encima es otro nivel.'],
    },
    badge: 'Nuevo',
    salesCount: 34,
    publishedDaysAgo: 1,
  },
  {
    slug: 'kit-nachos-queso',
    name: 'Kit Nachos con queso',
    subtitle: 'Totopos de maíz, salsa de queso fundido, jalapeños y maíz dulce.',
    description:
      'Los nachos de cine, en casa y sin fuego. Totopos de maíz crujientes, una salsa de queso cheddar en polvo que se hace con agua en el microondas, jalapeños en rodajas, maíz dulce y un sobre de especias tex-mex para el toque final.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-NAC-2', price: 1290, stock: 45 },
      { name: '4 personas', sku: 'HDM-NAC-4', price: 2190, compareAt: 2580, stock: 25 },
    ],
    images: [{ file: 'nachos-1.jpg', alt: 'Bandeja de nachos con queso fundido y maíz dulce (sugerencia de presentación)' }],
    attributes: { minutes: 10, difficulty: 1, heat: 'microondas', storage: 'seco' },
    tags: ['vegetariano', 'picante'],
    allergens: { contains: ['leche'], traces: ['gluten'] },
    includes: ['Totopos de maíz', 'Salsa de queso cheddar en polvo', 'Jalapeños en rodajas', 'Maíz dulce', 'Sobre de especias tex-mex', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['150 ml de agua (2 personas)'],
      steps: [
        { title: 'Haz la salsa', text: 'En un bol apto para microondas, mezcla el polvo de queso con el agua. Calienta 1 minuto, remueve y otros 30 segundos hasta que quede cremosa.' },
        { title: 'Monta la bandeja', text: 'Extiende los totopos en una fuente grande, sin amontonarlos mucho.' },
        { title: 'Cubre', text: 'Reparte la salsa de queso por encima, el maíz escurrido y los jalapeños (pocos si no te va el picante).' },
        { title: 'Toque final', text: 'Espolvorea las especias tex-mex y a comer con las manos.' },
      ],
      tips: ['Si la salsa se espesa, añade una cucharada de agua y remueve.', 'Perfectos para una noche de peli con amigos.'],
    },
    salesCount: 90,
    publishedDaysAgo: 45,
  },
  {
    slug: 'kit-bolitas-energeticas',
    name: 'Kit Bolitas energéticas de cacao',
    subtitle: 'Avena, dátiles, crema de cacahuete y cacao. Sin horno y sin fuego.',
    description:
      'El snack para antes de entrenar o para el recreo. Copos de avena, dátiles troceados, crema de cacahuete y cacao puro: lo mezclas todo, formas bolitas con las manos y las rebozas en cacao. Salen unas 16 bolitas por cada 2 personas.',
    category: 'primer-bocado',
    variants: [
      { name: '2 personas', sku: 'HDM-BOL-2', price: 1190, stock: 40 },
      { name: '4 personas', sku: 'HDM-BOL-4', price: 1990, stock: 22 },
    ],
    images: [{ file: 'bolitas-1.jpg', alt: 'Bolitas de cacao rebozadas en cacao en polvo sobre un plato (sugerencia de presentación)' }],
    attributes: { minutes: 15, difficulty: 1, heat: 'sin-fuego', storage: 'seco' },
    tags: ['vegano'],
    allergens: { contains: ['gluten', 'cacahuetes'], traces: ['frutos-de-cascara', 'sesamo'] },
    includes: ['Copos de avena', 'Dátiles troceados', 'Crema de cacahuete', 'Cacao puro en polvo', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Un poco de agua templada.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['2 cucharadas de agua templada'],
      steps: [
        { title: 'Ablanda los dátiles', text: 'Pon los dátiles en un bol con el agua templada 5 minutos y aplástalos con un tenedor hasta hacer una pasta.' },
        { title: 'Mezcla', text: 'Añade la avena, la crema de cacahuete y la mitad del cacao. Mezcla con las manos hasta que se pegue todo.' },
        { title: 'Forma las bolitas', text: 'Coge porciones del tamaño de una nuez y hazlas rodar entre las palmas.' },
        { title: 'Reboza', text: 'Pásalas por el resto del cacao y guárdalas en la nevera 15 minutos para que cojan cuerpo.' },
      ],
      tips: ['Si la masa está muy seca, añade unas gotas de agua; si está muy blanda, un poco más de avena.', 'En un táper en la nevera aguantan 5 días.'],
    },
    salesCount: 26,
    publishedDaysAgo: 56,
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
      { name: '4 personas', sku: 'HDM-RAM-4', price: 5900, compareAt: 7000, stock: 30 },
    ],
    images: [
      { file: 'ramen-1.jpg', alt: 'Bol de ramen de miso con setas shiitake, cebolleta y aceite de chile (sugerencia de presentación)' },
    ],
    attributes: { minutes: 25, difficulty: 2, heat: 'cazo', storage: 'seco' },
    tags: [],
    allergens: { contains: ['gluten', 'soja', 'sesamo'] },
    includes: ['Fideos ramen', 'Sobre de caldo de miso', 'Setas shiitake deshidratadas', 'Cebolleta liofilizada', 'Alga nori', 'Aceite de chile y sésamo', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['1 litro de agua (2 personas)'],
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
      { name: '4 personas', sku: 'HDM-TAC-4', price: 3890, compareAt: 4580, stock: 18 },
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
    badge: 'Más vendido',
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
    badge: 'Más vendido',
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

  {
    slug: 'kit-falafel-pita',
    name: 'Kit Falafel con pita',
    subtitle: 'Falafel crujiente a la sartén, pan de pita, salsa de tahini y encurtidos.',
    description:
      'La mezcla de falafel lleva garbanzo, hierbas y especias: solo añades agua, formas las bolitas y las doras en la sartén. Rellenas el pan de pita con los falafels, la salsa de tahini, los pepinillos y una pizca de zumaque. Todo de despensa.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-FAL-2', price: 1890, stock: 26 },
      { name: '4 personas', sku: 'HDM-FAL-4', price: 3290, stock: 14 },
    ],
    images: [
      { file: 'falafel-1.jpg', alt: 'Falafels dorados, uno abierto por la mitad' },
      { file: 'falafel-2.jpg', alt: 'Bol de falafels con encurtidos (sugerencia de presentación)' },
    ],
    attributes: { minutes: 25, difficulty: 2, heat: 'sarten', storage: 'seco' },
    tags: ['vegano', 'vegetariano'],
    allergens: { contains: ['gluten', 'sesamo'], traces: ['mostaza'] },
    includes: ['Mezcla para falafel (garbanzo, hierbas y especias)', 'Pan de pita', 'Sobre de salsa de tahini', 'Pepinillos encurtidos', 'Sobre de zumaque', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['150 ml de agua', '4 cucharadas de aceite'],
      steps: [
        { title: 'Hidrata la mezcla', text: 'Mezcla el falafel con 150 ml de agua y deja reposar 10 minutos: tiene que quedar una masa que se pueda moldear.' },
        { title: 'Forma las bolitas', text: 'Con las manos húmedas, haz bolitas del tamaño de una nuez y aplánalas un poco.' },
        { title: 'Dóralas', text: 'Sartén con el aceite a fuego medio. Dora los falafels 3 minutos por cada lado y sácalos a un papel de cocina.' },
        { title: 'Calienta el pan', text: 'Unos segundos en la sartén, sin aceite, para que se abra mejor.' },
        { title: 'Rellena', text: 'Abre la pita, pon 3 o 4 falafels, salsa de tahini, pepinillos y una pizca de zumaque.' },
      ],
      tips: ['Si la masa se deshace, añade una cucharadita más de la mezcla seca.', 'No los muevas hasta que estén dorados: así no se rompen.'],
    },
    salesCount: 16,
    publishedDaysAgo: 46,
  },

  {
    slug: 'kit-pad-thai',
    name: 'Kit Pad thai',
    subtitle: 'Fideos de arroz salteados con salsa de tamarindo, tofu y cacahuetes.',
    description:
      'El plato callejero más famoso de Tailandia, 100 % de despensa. Fideos de arroz planos, salsa pad thai de tamarindo, tofu firme envasado que no necesita nevera, cacahuetes tostados, cebolleta liofilizada y escamas de chile para quien se atreva.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-PAD-2', price: 1990, stock: 30 },
      { name: '4 personas', sku: 'HDM-PAD-4', price: 3390, compareAt: 3980, stock: 18 },
    ],
    images: [{ file: 'pad-thai-1.jpg', alt: 'Plato de pad thai con fideos de arroz, brotes y cebollino (sugerencia de presentación)' }],
    attributes: { minutes: 20, difficulty: 2, heat: 'sarten', storage: 'seco' },
    tags: ['vegano'],
    allergens: { contains: ['soja', 'cacahuetes', 'gluten'], traces: ['sesamo'] },
    includes: ['Fideos de arroz planos', 'Salsa pad thai de tamarindo', 'Tofu firme envasado', 'Cacahuetes tostados', 'Cebolleta liofilizada', 'Escamas de chile', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['Agua caliente para remojar los fideos', '2 cucharadas de aceite'],
      steps: [
        { title: 'Remoja los fideos', text: 'Cubre los fideos con agua caliente del grifo 10 minutos, hasta que estén flexibles. Escúrrelos.' },
        { title: 'Dora el tofu', text: 'Corta el tofu en dados y dóralo en la sartén con el aceite a fuego medio-alto, 5 minutos.' },
        { title: 'Saltea', text: 'Añade los fideos y la salsa pad thai. Remueve sin parar 2-3 minutos hasta que los fideos se tiñan y queden sueltos.' },
        { title: 'Termina', text: 'Sirve con los cacahuetes picados, la cebolleta y las escamas de chile al gusto.' },
      ],
      tips: ['No remojes los fideos en agua hirviendo: se rompen al saltear.', 'Con un chorrito de lima encima queda todavía mejor.'],
    },
    badge: 'Nuevo',
    salesCount: 30,
    publishedDaysAgo: 2,
  },
  {
    slug: 'kit-risotto-setas',
    name: 'Kit Risotto de setas',
    subtitle: 'Arroz arborio cremoso con boletus, caldo de verduras y parmesano.',
    description:
      'Un clásico italiano que se cocina removiendo con paciencia. Arroz arborio, boletus deshidratados con todo su aroma, caldo de verduras en polvo, cebolla deshidratada y queso parmesano curado rallado. El resultado: un arroz meloso de restaurante.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-RIS-2', price: 2190, stock: 26 },
      { name: '4 personas', sku: 'HDM-RIS-4', price: 3690, stock: 14 },
    ],
    images: [{ file: 'risotto-1.jpg', alt: 'Risotto cremoso de setas con perejil en un bol oscuro (sugerencia de presentación)' }],
    attributes: { minutes: 35, difficulty: 2, heat: 'cazo', storage: 'seco' },
    tags: ['vegetariano', 'sin-gluten'],
    allergens: { contains: ['leche', 'apio'] },
    includes: ['Arroz arborio', 'Boletus deshidratados', 'Caldo de verduras en polvo', 'Cebolla deshidratada', 'Parmesano curado rallado', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite de oliva.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['900 ml de agua (2 personas)', '2 cucharadas de aceite de oliva'],
      steps: [
        { title: 'Hidrata las setas', text: 'Pon los boletus en un vaso con agua caliente 10 minutos. Escúrrelos y guarda el agua.' },
        { title: 'Prepara el caldo', text: 'Calienta el resto del agua con el caldo en polvo y el agua de las setas. Mantenlo caliente a fuego bajo.' },
        { title: 'Nacara el arroz', text: 'En otro cazo, calienta el aceite con la cebolla deshidratada y las setas 2 minutos. Añade el arroz y remueve 1 minuto.' },
        { title: 'Caldo poco a poco', text: 'Añade un cazo de caldo y remueve hasta que el arroz lo absorba. Repite durante unos 18 minutos.' },
        { title: 'Manteca', text: 'Fuera del fuego, añade el parmesano, remueve con energía y deja reposar 2 minutos tapado.' },
      ],
      tips: ['Remover suelta el almidón: por eso queda cremoso sin nata.', 'Tiene que quedar meloso, no seco: si hace falta, un poco más de caldo.'],
    },
    salesCount: 110,
    publishedDaysAgo: 60,
  },
  {
    slug: 'kit-chili-sin-carne',
    name: 'Kit Chili sin carne',
    subtitle: 'Alubias rojas, soja texturizada, tomate y especias mexicanas. Picante y reconfortante.',
    description:
      'Un guiso tex-mex que no echa de menos la carne. Alubias rojas cocidas, soja texturizada, tomate triturado, maíz dulce y una mezcla de especias con comino, pimentón y chile. Todo de despensa y listo en una cazuela.',
    category: 'con-ganas',
    variants: [
      { name: '2 personas', sku: 'HDM-CHL-2', price: 1790, stock: 32 },
      { name: '4 personas', sku: 'HDM-CHL-4', price: 2990, stock: 16 },
    ],
    images: [{ file: 'chili-1.jpg', alt: 'Bol de chili de alubias rojas con aguacate y yogur (sugerencia de presentación)' }],
    attributes: { minutes: 30, difficulty: 2, heat: 'cazo', storage: 'seco' },
    tags: ['vegano', 'sin-gluten', 'picante'],
    allergens: { contains: ['soja'], traces: ['apio'] },
    includes: ['Alubias rojas cocidas', 'Soja texturizada', 'Tomate triturado en brick', 'Maíz dulce', 'Mezcla de especias chili', 'Cebolla deshidratada', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y aceite.' }, dryConservation, recipeCard],
    recipe: {
      youAdd: ['250 ml de agua', '1 cucharada de aceite'],
      steps: [
        { title: 'Hidrata la soja', text: 'Pon la soja texturizada en un bol con agua caliente 10 minutos y escúrrela apretando bien.' },
        { title: 'Sofríe', text: 'En una cazuela con el aceite, rehoga la cebolla deshidratada y la soja 3 minutos. Añade las especias y remueve 30 segundos.' },
        { title: 'Guisa', text: 'Echa el tomate, las alubias escurridas, el maíz y el agua. Cuando hierva, baja el fuego y deja 15 minutos removiendo de vez en cuando.' },
        { title: 'Sirve', text: 'Prueba de sal y sírvelo bien caliente. Con arroz, totopos o pan, como más te guste.' },
      ],
      tips: ['Al día siguiente está todavía más rico.', 'Menos picante: pon solo la mitad del sobre de especias.'],
    },
    salesCount: 95,
    publishedDaysAgo: 40,
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
      { name: '4 personas', sku: 'HDM-CUR-4', price: 4690, compareAt: 5580, stock: 14 },
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
    salesCount: 30,
    publishedDaysAgo: 42,
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
    badge: 'Más vendido',
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
    salesCount: 18,
    publishedDaysAgo: 62,
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
    badge: 'Más vendido',
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

  {
    slug: 'kit-smash-burgers',
    name: 'Kit Smash burgers',
    subtitle: 'Carne fresca aplastada a la plancha, cheddar fundido y pan brioche.',
    description:
      'Las hamburguesas de moda: bolas de carne de vacuno fresca que se aplastan en la sartén muy caliente para que queden con costra. Llega refrigerado con la carne, el cheddar, el pan brioche y la cebolla; además, pepinillos, salsa burger y un sobre de sal y pimienta.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-SMB-2', price: 2690, stock: 20 },
      { name: '4 personas', sku: 'HDM-SMB-4', price: 4490, compareAt: 5380, stock: 10 },
    ],
    images: [
      { file: 'burger-1.jpg', alt: 'Smash burger doble con cheddar y pepinillos' },
      { file: 'burger-2.jpg', alt: 'Hamburguesa doble con queso fundido en pan con sésamo' },
    ],
    attributes: { minutes: 30, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: [],
    allergens: { contains: ['gluten', 'leche', 'huevos', 'mostaza', 'sesamo'] },
    includes: ['Carne picada de vacuno fresca', 'Pan brioche', 'Lonchas de queso cheddar', 'Cebolla roja fresca', 'Pepinillos encurtidos', 'Sobre de salsa burger', 'Sobre de sal y pimienta', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Un chorrito de aceite.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['1 cucharada de aceite'],
      steps: [
        { title: 'Haz las bolas', text: 'Divide la carne en bolas iguales (2 por hamburguesa). No la amases: cuanto menos la toques, más jugosa.' },
        { title: 'Prepara todo', text: 'Corta la cebolla en aros muy finos, abre los panes y ten a mano el queso: luego va todo muy rápido.' },
        { title: 'Tuesta el pan', text: 'Sartén caliente sin aceite: tuesta el pan por la cara de dentro 1 minuto y resérvalo.' },
        { title: 'Aplasta', text: 'Sube el fuego al máximo con un chorrito de aceite. Pon las bolas y aplástalas con una espátula hasta dejarlas finas. Sal y pimienta.' },
        { title: 'Vuelta y queso', text: 'A los 2 minutos, cuando tengan costra, dales la vuelta, pon el cheddar encima y 1 minuto más.' },
        { title: 'Monta', text: 'Pan, salsa burger, dos carnes con queso, cebolla, pepinillos y tapa. ¡A por ella!' },
      ],
      tips: ['La sartén tiene que estar muy caliente: si no humea un poco, espera.', 'Lávate las manos después de tocar la carne cruda.'],
    },
    featured: true,
    salesCount: 40,
    publishedDaysAgo: 34,
  },

  {
    slug: 'kit-poke-salmon',
    name: 'Kit Poke de salmón',
    subtitle: 'Salmón fresco marinado, arroz de sushi, edamame, mango y aguacate.',
    description:
      'El bol hawaiano de moda. Llega refrigerado con el salmón fresco apto para comer crudo (previamente congelado), el aguacate, el mango y el pepino; además, arroz para sushi, edamame, salsa poke de soja y sésamo tostado. Tú cueces el arroz y montas el bol.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-POK-2', price: 2890, stock: 16 },
      { name: '4 personas', sku: 'HDM-POK-4', price: 4890, stock: 8 },
    ],
    images: [{ file: 'poke-1.jpg', alt: 'Bol de poke con dados de salmón, edamame, mango, pepino y aguacate' }],
    attributes: { minutes: 35, difficulty: 3, heat: 'cazo', storage: 'fresco' },
    tags: [],
    allergens: { contains: ['pescado', 'soja', 'gluten', 'sesamo'] },
    includes: ['Lomo de salmón fresco apto para crudo', 'Arroz para sushi', 'Aguacate', 'Mango', 'Pepino', 'Edamame', 'Salsa poke de soja', 'Sésamo tostado', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['Agua para el arroz y el edamame'],
      steps: [
        { title: 'Lava y cuece el arroz', text: 'Lava el arroz hasta que el agua salga clara. Cuécelo tapado con 1,2 veces su volumen de agua 12 minutos a fuego bajo y deja reposar 10.' },
        { title: 'Marina el salmón', text: 'Corta el salmón en dados con un cuchillo bien afilado y mézclalo con la mitad de la salsa poke. A la nevera mientras preparas lo demás.' },
        { title: 'Prepara los toppings', text: 'Cuece el edamame 3 minutos. Corta en dados el aguacate, el mango y el pepino.' },
        { title: 'Monta el bol', text: 'Arroz templado en la base y encima, por grupos, el salmón, el edamame, el aguacate, el mango y el pepino.' },
        { title: 'Termina', text: 'Riega con el resto de la salsa y espolvorea el sésamo.' },
      ],
      tips: ['Lávate las manos y usa una tabla limpia para el pescado crudo.', 'Come el poke el mismo día en que lo montes.'],
    },
    badge: 'Nuevo',
    salesCount: 20,
    publishedDaysAgo: 1,
  },
  {
    slug: 'kit-fajitas-pollo',
    name: 'Kit Fajitas de pollo',
    subtitle: 'Tiras de pollo con pimientos y cebolla a la plancha, tortillas de trigo y salsa.',
    description:
      'Para cenar con las manos y con la mesa llena. Llega refrigerado con las tiras de pechuga de pollo, pimientos rojo y verde, cebolla y una lima; además, tortillas de trigo, especias para fajitas y salsa de tomate mexicana.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-FAJ-2', price: 2490, stock: 22 },
      { name: '4 personas', sku: 'HDM-FAJ-4', price: 4190, compareAt: 4980, stock: 12 },
    ],
    images: [{ file: 'fajitas-1.jpg', alt: 'Fajita de pollo con pimientos enrollada, junto a un bote de salsa y media lima' }],
    attributes: { minutes: 30, difficulty: 3, heat: 'sarten', storage: 'fresco' },
    tags: ['picante'],
    allergens: { contains: ['gluten'], traces: ['soja', 'mostaza'] },
    includes: ['Tiras de pechuga de pollo fresca', 'Pimiento rojo y verde', 'Cebolla', 'Lima', 'Tortillas de trigo', 'Sobre de especias para fajitas', 'Salsa de tomate mexicana', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Aceite.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['2 cucharadas de aceite'],
      steps: [
        { title: 'Corta la verdura', text: 'Corta los pimientos y la cebolla en tiras finas.' },
        { title: 'Adoba el pollo', text: 'Mezcla las tiras de pollo con la mitad de las especias y un chorrito de aceite.' },
        { title: 'Saltea el pollo', text: 'Sartén muy caliente: dora el pollo 5-6 minutos hasta que no quede rosa por dentro. Sácalo.' },
        { title: 'Saltea la verdura', text: 'En la misma sartén, saltea pimientos y cebolla con el resto de especias 5 minutos. Vuelve a echar el pollo y exprime la lima.' },
        { title: 'Monta', text: 'Calienta las tortillas 20 segundos por lado, rellénalas con salsa y el salteado, y enróllalas.' },
      ],
      tips: ['Lávate las manos y la tabla después de cortar el pollo crudo.', 'No llenes demasiado la tortilla o se romperá al enrollar.'],
    },
    salesCount: 130,
    publishedDaysAgo: 35,
  },
  {
    slug: 'kit-carbonara',
    name: 'Kit Espaguetis a la carbonara',
    subtitle: 'La de verdad: guanciale, huevo, pecorino y pimienta negra. Sin nata.',
    description:
      'La receta romana auténtica, con solo cinco ingredientes. Llega refrigerado con el guanciale (papada curada), los huevos frescos y el queso pecorino romano; además, espaguetis de sémola de trigo duro y pimienta negra en grano. El truco está en mezclar fuera del fuego.',
    category: 'hambre-de-mas',
    variants: [
      { name: '2 personas', sku: 'HDM-CAR-2', price: 2290, stock: 24 },
      { name: '4 personas', sku: 'HDM-CAR-4', price: 3890, stock: 12 },
    ],
    images: [{ file: 'carbonara-1.jpg', alt: 'Espaguetis a la carbonara con guanciale y pecorino en un plato hondo' }],
    attributes: { minutes: 25, difficulty: 3, heat: 'cazo', storage: 'fresco' },
    tags: [],
    allergens: { contains: ['gluten', 'huevos', 'leche'] },
    includes: ['Espaguetis de trigo duro', 'Guanciale en tiras', 'Huevos frescos', 'Pecorino romano rallado', 'Pimienta negra en grano', 'Tarjeta de receta con QR'],
    specs: [{ label: 'Tú pones', value: 'Agua y sal.' }, freshConservation, recipeCard],
    recipe: {
      youAdd: ['2 litros de agua', 'Sal para el agua de la pasta'],
      steps: [
        { title: 'Pon el agua', text: 'Lleva a ebullición el agua con sal y cuece los espaguetis el tiempo del paquete menos 1 minuto.' },
        { title: 'Dora el guanciale', text: 'En una sartén sin aceite, a fuego medio, dora el guanciale hasta que suelte la grasa y quede crujiente. Apaga el fuego.' },
        { title: 'Haz la crema', text: 'Bate las yemas (y un huevo entero) con casi todo el pecorino y mucha pimienta recién molida.' },
        { title: 'Mezcla fuera del fuego', text: 'Pasa la pasta a la sartén del guanciale con un poco de agua de cocción. Ya sin fuego, añade la crema de huevo y remueve rápido hasta que quede sedosa.' },
        { title: 'Sirve', text: 'Emplata enseguida con el resto del pecorino y más pimienta.' },
      ],
      tips: ['Si la sartén está muy caliente, el huevo cuaja y se hace tortilla: espera un minuto.', 'El agua de cocción con almidón es lo que hace la salsa cremosa.'],
    },
    salesCount: 125,
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
    publishedDaysAgo: 75,
  },
]

export const demoPromotions: DemoPromotion[] = [
  { code: 'BIENVENIDA10', description: '10 % en tu primer pedido desde 20 €', kind: 'percent', value: 10, minSubtotal: 2000 },
  { code: 'HAMBRE5', description: '5 € de descuento desde 40 €', kind: 'fixed', value: 500, minSubtotal: 4000 },
]
