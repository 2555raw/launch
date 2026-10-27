/**
 * Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011
 * (anexo II), en el orden habitual de las cartas de alérgenos.
 */
export const ALLERGENS = [
  { code: 'gluten', label: 'Gluten', color: '#E9A83A' },
  { code: 'crustaceos', label: 'Crustáceos', color: '#E2574C' },
  { code: 'moluscos', label: 'Moluscos', color: '#2F7FB5' },
  { code: 'pescado', label: 'Pescado', color: '#2B4C9B' },
  { code: 'huevos', label: 'Huevos', color: '#EC8B3C' },
  { code: 'altramuces', label: 'Altramuces', color: '#E6A824' },
  { code: 'mostaza', label: 'Mostaza', color: '#E9735A' },
  { code: 'cacahuetes', label: 'Cacahuetes', color: '#3B8442' },
  { code: 'frutos-de-cascara', label: 'Frutos de cáscara', color: '#A8584E' },
  { code: 'soja', label: 'Soja', color: '#8BB83A' },
  { code: 'sesamo', label: 'Sésamo', color: '#C46F45' },
  { code: 'apio', label: 'Apio', color: '#7FB52F' },
  { code: 'leche', label: 'Leche', color: '#2EA3D6' },
  { code: 'sulfitos', label: 'Sulfitos', color: '#D6408F' },
] as const

export type Allergen = (typeof ALLERGENS)[number]['code']

export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code) as Allergen[]

export const allergenInfo = (code: Allergen) => ALLERGENS.find((a) => a.code === code)!

/** Filtra y ordena una lista según el orden oficial, descartando códigos desconocidos. */
export function sortAllergens(list: readonly string[] | null | undefined): Allergen[] {
  const set = new Set(list ?? [])
  return ALLERGEN_CODES.filter((c) => set.has(c))
}
