/**
 * Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011
 * (anexo II), en el orden habitual de las cartas de alérgenos.
 */
export const ALLERGENS = [
  { code: 'gluten', label: 'Gluten', labelEn: 'Gluten', color: '#E9A83A' },
  { code: 'crustaceos', label: 'Crustáceos', labelEn: 'Crustaceans', color: '#E2574C' },
  { code: 'moluscos', label: 'Moluscos', labelEn: 'Molluscs', color: '#2F7FB5' },
  { code: 'pescado', label: 'Pescado', labelEn: 'Fish', color: '#2B4C9B' },
  { code: 'huevos', label: 'Huevos', labelEn: 'Eggs', color: '#EC8B3C' },
  { code: 'altramuces', label: 'Altramuces', labelEn: 'Lupin', color: '#E6A824' },
  { code: 'mostaza', label: 'Mostaza', labelEn: 'Mustard', color: '#E9735A' },
  { code: 'cacahuetes', label: 'Cacahuetes', labelEn: 'Peanuts', color: '#3B8442' },
  { code: 'frutos-de-cascara', label: 'Frutos de cáscara', labelEn: 'Tree nuts', color: '#A8584E' },
  { code: 'soja', label: 'Soja', labelEn: 'Soy', color: '#8BB83A' },
  { code: 'sesamo', label: 'Sésamo', labelEn: 'Sesame', color: '#C46F45' },
  { code: 'apio', label: 'Apio', labelEn: 'Celery', color: '#7FB52F' },
  { code: 'leche', label: 'Leche', labelEn: 'Milk', color: '#2EA3D6' },
  { code: 'sulfitos', label: 'Sulfitos', labelEn: 'Sulphites', color: '#D6408F' },
] as const

export type Allergen = (typeof ALLERGENS)[number]['code']

export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code) as Allergen[]

export const allergenInfo = (code: Allergen) => ALLERGENS.find((a) => a.code === code)!

/** Nombre del alérgeno en el idioma de la página. */
export const allergenLabel = (code: Allergen, locale: 'es' | 'en' = 'es') => {
  const info = allergenInfo(code)
  return locale === 'en' ? info.labelEn : info.label
}

/** Filtra y ordena una lista según el orden oficial, descartando códigos desconocidos. */
export function sortAllergens(list: readonly string[] | null | undefined): Allergen[] {
  const set = new Set(list ?? [])
  return ALLERGEN_CODES.filter((c) => set.has(c))
}
