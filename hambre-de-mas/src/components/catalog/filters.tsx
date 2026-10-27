'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CheckIcon, ChevronDownIcon, CloseIcon } from '@/components/ui/icons'
import { ALLERGENS, allergenLabel } from '@/lib/allergens'
import { useI18n } from '@/lib/i18n/client'
import { AllergenIcon } from '@/components/product/allergen-icons'
import { dietOptions, difficultyOptions, priceOptions, sortOptions, timeOptions } from '@/lib/catalog/params'
import { cn } from '@/lib/cn'

type CategoryOption = { slug: string; name: string }

function useParamsUpdater() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key)
      else next.set(key, value)
    }
    next.delete('pagina')
    const qs = next.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  const toggleInList = (key: string, value: string) => {
    const current = (params.get(key) ?? '').split(',').filter(Boolean)
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    update({ [key]: next.join(',') || null })
  }

  return { params, update, toggleInList, pending }
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <fieldset className="border-b border-line py-4">
      <legend className="contents">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-[15px] font-semibold" aria-expanded={open}>
          {title}
          <ChevronDownIcon size={16} className={cn('text-ash transition-transform duration-300', open && 'rotate-180')} />
        </button>
      </legend>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </fieldset>
  )
}

function Option({ checked, onChange, label, type = 'checkbox', name }: { checked: boolean; onChange: () => void; label: string; type?: 'checkbox' | 'radio'; name?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm text-ink/85 hover:text-ink">
      <input type={type} name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'grid size-[18px] shrink-0 place-items-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-chef-ink peer-focus-visible:ring-offset-2',
          type === 'radio' ? 'rounded-full' : 'rounded-[5px]',
          checked ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white',
        )}
      >
        {checked && <CheckIcon size={12} strokeWidth={2.5} />}
      </span>
      {label}
    </label>
  )
}

export function FilterPanel({ categories, lockCategory = false }: { categories: CategoryOption[]; lockCategory?: boolean }) {
  const { params, update, toggleInList } = useParamsUpdater()
  const { locale, t } = useI18n()
  const label = (o: { label: string; labelEn: string }) => (locale === 'en' ? o.labelEn : o.label)
  const has = (key: string, value: string) => (params.get(key) ?? '').split(',').includes(value)
  const min = params.get('min') ?? ''
  const max = params.get('max') ?? ''

  return (
    <div>
      {!lockCategory && (
        <Group title={t({ es: 'Nivel', en: 'Level' })}>
          <Option type="radio" name="categoria" label={t({ es: 'Todos', en: 'All' })} checked={!params.get('categoria')} onChange={() => update({ categoria: null })} />
          {categories.map((c) => (
            <Option key={c.slug} type="radio" name="categoria" label={c.name} checked={params.get('categoria') === c.slug} onChange={() => update({ categoria: c.slug })} />
          ))}
        </Group>
      )}
      <Group title={t({ es: 'Precio', en: 'Price' })}>
        {priceOptions.map((o) => (
          <Option
            key={o.label}
            type="radio"
            name="precio"
            label={label(o)}
            checked={min === o.min && max === o.max && Boolean(min || max)}
            onChange={() => update({ min: o.min || null, max: o.max || null })}
          />
        ))}
        {(min || max) && (
          <button type="button" onClick={() => update({ min: null, max: null })} className="pt-1 text-xs text-teja hover:underline">
            {t({ es: 'Quitar filtro de precio', en: 'Clear price filter' })}
          </button>
        )}
      </Group>
      <Group title={t({ es: 'Dieta y sabor', en: 'Diet and flavour' })}>
        {dietOptions.map((o) => (
          <Option key={o.value} label={label(o)} checked={has('dieta', o.value)} onChange={() => toggleInList('dieta', o.value)} />
        ))}
      </Group>
      <Group title={t({ es: 'Sin alérgenos', en: 'Allergen-free' })} defaultOpen={Boolean(params.get('sin'))}>
        <p className="pb-1 text-xs text-ash-ink">
          {t({ es: 'Oculta los kits que los contienen, en trazas o en la receta.', en: 'Hides kits that contain them, as traces or in the recipe.' })}
        </p>
        {ALLERGENS.map((a) => (
          <label key={a.code} className="flex cursor-pointer items-center gap-3 rounded-lg py-1 text-sm text-ink/85 hover:text-ink">
            <input
              type="checkbox"
              checked={has('sin', a.code)}
              onChange={() => toggleInList('sin', a.code)}
              className="size-4 shrink-0 accent-chef-ink"
            />
            <AllergenIcon code={a.code} size={22} />
            {t({ es: `Sin ${a.label.toLowerCase()}`, en: `No ${allergenLabel(a.code, 'en').toLowerCase()}` })}
          </label>
        ))}
      </Group>
      <Group title={t({ es: 'Tiempo de cocina', en: 'Cooking time' })}>
        {timeOptions.map((o) => (
          <Option
            key={o.value}
            type="radio"
            name="tiempo"
            label={label(o)}
            checked={params.get('tiempo') === o.value}
            onChange={() => update({ tiempo: params.get('tiempo') === o.value ? null : o.value })}
          />
        ))}
      </Group>
      <Group title={t({ es: 'Dificultad', en: 'Difficulty' })}>
        {difficultyOptions.map((o) => (
          <Option key={o.value} label={label(o)} checked={has('dificultad', o.value)} onChange={() => toggleInList('dificultad', o.value)} />
        ))}
      </Group>
      <div className="py-4">
        <Option label={t({ es: 'Solo con stock', en: 'In stock only' })} checked={params.get('stock') === '1'} onChange={() => update({ stock: params.get('stock') === '1' ? null : '1' })} />
      </div>
    </div>
  )
}

export function SortSelect() {
  const { params, update } = useParamsUpdater()
  const { locale, t } = useI18n()
  return (
    <label className="relative inline-flex items-center gap-2 text-sm">
      <span className="hidden text-ash-ink sm:inline">{t({ es: 'Ordenar por', en: 'Sort by' })}</span>
      <select
        value={params.get('orden') ?? 'destacados'}
        onChange={(e) => update({ orden: e.target.value === 'destacados' ? null : e.target.value })}
        className="h-9 appearance-none rounded-full bg-mist py-0 pr-9 pl-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-chef-ink"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {locale === 'en' ? o.labelEn : o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={14} className="pointer-events-none absolute right-3.5 text-ash-ink" />
    </label>
  )
}

/** Botón y hoja inferior con los filtros en móvil y tablet. */
export function MobileFilters({ categories, count, lockCategory }: { categories: CategoryOption[]; count: number; lockCategory?: boolean }) {
  const [open, setOpen] = useState(false)
  const { update } = useParamsUpdater()
  const { t } = useI18n()
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        {t({ es: 'Filtros', en: 'Filters' })}
        {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-white">{count}</span>}
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-ink/30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t({ es: 'Filtros', en: 'Filters' })}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.4, ease: [0.28, 0.11, 0.32, 1] }}
              className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[85dvh] flex-col rounded-t-[28px] bg-white lg:hidden"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-2">
                <h2 className="font-display text-xl font-bold">{t({ es: 'Filtros', en: 'Filters' })}</h2>
                <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-mist" aria-label={t({ es: 'Cerrar filtros', en: 'Close filters' })}>
                  <CloseIcon size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6">
                <FilterPanel categories={categories} lockCategory={lockCategory} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
                <Button
                  variant="secondary"
                  onClick={() => update({ categoria: null, min: null, max: null, dieta: null, sin: null, tiempo: null, dificultad: null, stock: null, destacados: null })}
                >
                  {t({ es: 'Limpiar', en: 'Clear' })}
                </Button>
                <Button onClick={() => setOpen(false)}>{t({ es: 'Ver resultados', en: 'Show results' })}</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
