import { commerce } from '@/lib/config/commerce'
import { company } from '@/lib/config/site'
import type { Locale, Localized } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/money'

/**
 * Preguntas frecuentes del panel de ayuda. Las usa el panel (pestaña «Ayuda»)
 * y la ruta del asistente cuando no hay clave de IA configurada: entonces
 * responde con la pregunta frecuente que mejor encaje.
 */

export type Faq = {
  id: string
  question: Localized<string>
  answer: Localized<string>
  /** Palabras (sin tildes, en minúscula) que apuntan a esta pregunta. */
  keywords: string[]
}

const shipping = formatPrice(commerce.shippingCents)
const freeFrom = formatPrice(commerce.freeShippingThresholdCents)

export const FAQS: Faq[] = [
  {
    id: 'niveles',
    question: { es: '¿Qué nivel elijo?', en: 'Which level should I pick?' },
    answer: {
      es: '«Primer bocado»: recetas sin fuego o con microondas, ideal si nunca has cocinado. «Con ganas»: sartén y cazo, platos completos en 20-30 minutos. «Hambre de más»: recetas del mundo con ingredientes frescos. Si no lo tienes claro, empieza por Primer bocado (o haz el test «¿Qué nivel eres?»): cada kit desbloquea el siguiente.',
      en: '"First bite": no-cook or microwave recipes, ideal if you have never cooked. "Getting hungry": pan and pot, full meals in 20-30 minutes. "Hungry for more": world recipes with fresh ingredients. If in doubt, start with First bite (or take the "Which level are you?" quiz): each kit unlocks the next.',
    },
    keywords: ['nivel', 'level', 'elijo', 'empiezo', 'empezar', 'principiante', 'beginner', 'dificil', 'facil', 'difficulty', 'easy'],
  },
  {
    id: 'que-trae',
    question: { es: '¿Qué trae cada kit?', en: 'What comes in each kit?' },
    answer: {
      es: 'Todos los ingredientes secos ya medidos, las salsas y especias, y una tarjeta con QR que abre la receta paso a paso. Los kits Primer bocado y Con ganas son 100 % secos: tú pones agua y, a veces, un chorrito de aceite. Los de Hambre de más incluyen frescos y llegan refrigerados. En cada ficha verás la lista completa en «Qué trae el kit».',
      en: 'All the dry ingredients pre-measured, the sauces and spices, and a card with a QR code that opens the step-by-step recipe. First bite and Getting hungry kits are 100% dry: you add water and sometimes a splash of oil. Hungry for more kits include fresh ingredients and arrive chilled. Each product page lists everything under "What\'s in the kit".',
    },
    keywords: ['trae', 'incluye', 'contiene', 'ingredientes', 'qr', 'receta', 'include', 'includes', 'contains', 'ingredients', 'recipe', 'comes'],
  },
  {
    id: 'envio',
    question: { es: '¿Cuánto cuesta el envío y cuánto tarda?', en: 'How much is shipping and how long does it take?' },
    answer: {
      es: `El envío cuesta ${shipping} y es gratis desde ${freeFrom}. Enviamos a Península y Baleares en ${commerce.deliveryEstimate}. Los kits con frescos van en caja isotérmica en 24 h laborables. Por ahora no enviamos a Canarias, Ceuta ni Melilla.`,
      en: `Shipping costs ${formatPrice(commerce.shippingCents, 'en')} and is free from ${formatPrice(commerce.freeShippingThresholdCents, 'en')}. We deliver to mainland Spain and the Balearic Islands in 24–72 working hours. Kits with fresh ingredients travel in an insulated box within 24 working hours. We don't ship to the Canary Islands, Ceuta or Melilla yet.`,
    },
    keywords: ['envio', 'envios', 'gastos', 'tarda', 'llega', 'entrega', 'canarias', 'baleares', 'shipping', 'delivery', 'deliver', 'arrive', 'ship'],
  },
  {
    id: 'pedido',
    question: { es: '¿Dónde está mi pedido?', en: 'Where is my order?' },
    answer: {
      es: 'Cuando tu pedido sale del almacén te enviamos el número de seguimiento por email. También lo ves en tu cuenta, en «Mis pedidos». Si algo no cuadra, escríbenos con tu número de pedido (HDM-…).',
      en: 'When your order leaves our warehouse we email you the tracking number. You can also see it in your account under "My orders". If something looks wrong, write to us with your order number (HDM-…).',
    },
    keywords: ['pedido', 'seguimiento', 'donde', 'estado', 'order', 'tracking', 'where', 'status', 'hdm'],
  },
  {
    id: 'devoluciones',
    question: { es: '¿Puedo devolver un kit?', en: 'Can I return a kit?' },
    answer: {
      es: `Sí, si está sin abrir: tienes ${commerce.returnDays} días desde la entrega. Por seguridad alimentaria no aceptamos kits abiertos, salvo que lleguen dañados o con un defecto; en ese caso te lo solucionamos sin coste. Tienes los pasos en Cambios y devoluciones (/legal/devoluciones).`,
      en: `Yes, if it's unopened: you have ${commerce.returnDays} days from delivery. For food safety we can't accept opened kits unless they arrive damaged or faulty; in that case we sort it out at no cost to you. The steps are on the Returns page (/legal/devoluciones).`,
    },
    keywords: ['devolver', 'devolucion', 'reembolso', 'cambio', 'roto', 'danado', 'return', 'refund', 'exchange', 'damaged', 'broken'],
  },
  {
    id: 'alergenos',
    question: { es: '¿Y si tengo alergias?', en: 'What if I have allergies?' },
    answer: {
      es: 'Cada ficha muestra los 14 alérgenos de declaración obligatoria: en color los que contiene el kit y atenuados los que pueden aparecer como trazas. En la tienda puedes filtrar por «Sin alérgenos». Si tienes una alergia grave, revisa siempre la etiqueta del paquete y, ante cualquier duda, escríbenos antes de comprar.',
      en: 'Every product page shows the 14 mandatory allergens: in colour the ones the kit contains and faded the ones that may appear as traces. In the shop you can filter by "Allergen-free". If you have a severe allergy, always check the pack label and write to us before buying if you have any doubt.',
    },
    keywords: ['alergia', 'alergias', 'alergeno', 'alergenos', 'gluten', 'lactosa', 'leche', 'frutos', 'celiaco', 'vegano', 'vegetariano', 'allergy', 'allergies', 'allergen', 'vegan', 'vegetarian'],
  },
  {
    id: 'pago',
    question: { es: '¿Cómo puedo pagar?', en: 'How can I pay?' },
    answer: {
      es: 'El pago se hace en la pasarela segura de Stripe, con tarjeta y los métodos que Stripe muestre en ese momento. Nosotros nunca vemos ni guardamos los datos de tu tarjeta.',
      en: 'Payment happens on Stripe\'s secure checkout, by card and with whichever methods Stripe offers at that moment. We never see or store your card details.',
    },
    keywords: ['pagar', 'pago', 'tarjeta', 'bizum', 'paypal', 'stripe', 'pay', 'payment', 'card'],
  },
  {
    id: 'caja-sorpresa',
    question: { es: '¿Cómo funciona la caja sorpresa?', en: 'How does the surprise box work?' },
    answer: {
      es: 'Es un kit sorpresa cada mes. Puedes elegir 1, 3 o 6 meses; las cajas de 3 y 6 meses se envían la primera semana de cada mes a la misma dirección. Es perfecta para regalar.',
      en: 'It\'s a surprise kit every month. You can choose 1, 3 or 6 months; 3- and 6-month boxes ship in the first week of each month to the same address. It makes a great gift.',
    },
    keywords: ['sorpresa', 'regalo', 'regalar', 'suscripcion', 'mes', 'meses', 'surprise', 'gift', 'subscription', 'month', 'monthly'],
  },
  {
    id: 'packs',
    question: { es: '¿Hay descuentos si compro varios kits?', en: 'Are there discounts if I buy several kits?' },
    answer: {
      es: `Sí. Si llevas ${commerce.bundleMinKits} kits o más del mismo nivel, la cesta te descuenta un ${commerce.bundlePercent} % en todos ellos sin poner ningún código. Además, en algunos kits el tamaño de 4 personas sale más barato que dos de 2.`,
      en: `Yes. If you take ${commerce.bundleMinKits} or more kits from the same level, your bag takes ${commerce.bundlePercent}% off all of them with no code needed. On some kits the serves-4 size is also cheaper than two serves-2 kits.`,
    },
    keywords: ['descuento', 'descuentos', 'pack', 'packs', 'oferta', 'barato', 'varios', 'discount', 'discounts', 'bundle', 'offer', 'cheaper'],
  },
  {
    id: 'regalo',
    question: { es: '¿Puedo enviarlo como regalo?', en: 'Can I send it as a gift?' },
    answer: {
      es: 'Sí. Al pagar marca «Es un regalo»: lo enviamos sin precios en el paquete y, si quieres, escribimos tu mensaje en una tarjeta. Pon la dirección de la persona que lo recibe.',
      en: 'Yes. At checkout tick "It\'s a gift": we ship it with no prices in the box and, if you like, we write your message on a card. Use the address of the person receiving it.',
    },
    keywords: ['regalo', 'regalar', 'cumpleanos', 'tarjeta', 'mensaje', 'gift', 'present', 'birthday', 'card', 'message'],
  },
  {
    id: 'qr',
    question: { es: '¿Cómo funciona el QR de la receta?', en: 'How does the recipe QR code work?' },
    answer: {
      es: 'Cada kit trae una tarjeta con un código QR. Escanéalo con la cámara del móvil y se abre la receta paso a paso. También la tienes en la ficha de cada kit.',
      en: 'Every kit comes with a card with a QR code. Scan it with your phone camera and the step-by-step recipe opens. It\'s also on each kit\'s page.',
    },
    keywords: ['qr', 'codigo', 'escanear', 'movil', 'video', 'pasos', 'paso', 'code', 'scan', 'phone', 'steps', 'step'],
  },
  {
    id: 'nutricion',
    question: { es: '¿Puedo ver las calorías y la proteína?', en: 'Can I see the calories and protein?' },
    answer: {
      es: 'Sí. En la ficha de cada kit verás las calorías, la proteína, los hidratos y las grasas por ración (valores aproximados). Los kits con 25 g de proteína o más llevan la etiqueta «Alto en proteína» y salen en la sección «Para el gym».',
      en: 'Yes. Each kit\'s page shows calories, protein, carbs and fat per serving (approximate values). Kits with 25 g of protein or more carry the "High protein" tag and appear in the "For the gym" section.',
    },
    keywords: ['calorias', 'kcal', 'proteina', 'proteinas', 'gym', 'gimnasio', 'nutricion', 'nutricional', 'dieta', 'calories', 'protein', 'nutrition', 'macros'],
  },
  {
    id: 'edad',
    question: { es: '¿Desde qué edad se puede cocinar?', en: 'From what age can you cook?' },
    answer: {
      es: 'Los kits están pensados para adolescentes. Recomendamos que los menores de 14 años cocinen con la supervisión de un adulto, sobre todo en Con ganas y Hambre de más, donde hay fuego y cuchillos.',
      en: 'The kits are designed for teens. We recommend that under-14s cook with an adult around, especially for Getting hungry and Hungry for more, where there is heat and knives.',
    },
    keywords: ['edad', 'anos', 'nino', 'ninos', 'menor', 'supervision', 'adulto', 'age', 'old', 'kid', 'kids', 'child', 'adult'],
  },
]

/** Quita tildes y pasa a minúsculas para comparar palabras. */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** La pregunta frecuente que mejor encaja con el texto (o null si ninguna). */
export function matchFaq(text: string): Faq | null {
  const words = new Set(normalize(text).split(/[^a-z0-9]+/).filter(Boolean))
  let best: { faq: Faq; score: number } | null = null
  for (const faq of FAQS) {
    const score = faq.keywords.filter((k) => words.has(k)).length
    if (score > 0 && (!best || score > best.score)) best = { faq, score }
  }
  return best?.faq ?? null
}

/** Respuesta sin IA: la pregunta frecuente más parecida o una invitación a escribir. */
export function faqReply(text: string, locale: Locale) {
  const faq = matchFaq(text)
  if (faq) return faq.answer[locale]
  return locale === 'en'
    ? `I'm not sure about that one. Write to us at ${company.email} and we'll get back to you.`
    : `Esa no la sé responder. Escríbenos a ${company.email} y te contestamos.`
}
