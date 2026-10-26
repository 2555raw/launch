'use client'

import { useActionState, useState } from 'react'
import { saveProduct } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { MinusIcon, PlusIcon } from '@/components/ui/icons'
import { Card, Label, Notice, field } from './ui'

/* eslint-disable @typescript-eslint/no-explicit-any -- fila de producto sin tipar */

type VariantRow = { id?: string; sku: string; name: string; price: string; compareAt: string; stock: string; isActive: boolean }

const euros = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2))
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function ProductForm({ categories, product }: { categories: { id: string; name: string }[]; product?: any }) {
  const [state, action, pending] = useActionState(saveProduct, null)
  const [name, setName] = useState<string>(product?.name ?? '')
  const [slug, setSlug] = useState<string>(product?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(product))
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants?.length
      ? [...product.variants]
          .sort((a: any, b: any) => a.position - b.position)
          .map((v: any) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            price: euros(v.price_cents),
            compareAt: euros(v.compare_at_price_cents),
            stock: String(v.stock),
            isActive: v.is_active,
          }))
      : [{ sku: '', name: '2 personas', price: '', compareAt: '', stock: '0', isActive: true }],
  )
  const errors = state?.fields ?? {}

  const setVariant = (i: number, patch: Partial<VariantRow>) => setVariants((rows) => rows.map((r, j) => (i === j ? { ...r, ...patch } : r)))

  const buildPayload = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const text = (k: string) => data.get(k)?.toString() ?? ''
    const lines = (k: string) =>
      text(k)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    return JSON.stringify({
      name,
      slug,
      subtitle: text('subtitle'),
      description: text('description'),
      categoryId: text('categoryId'),
      status: text('status'),
      taxRateBps: Math.round(Number(text('taxRate').replace(',', '.')) * 100),
      isFeatured: data.get('isFeatured') === 'on',
      badge: text('badge'),
      minutes: text('minutes') || undefined,
      difficulty: text('difficulty') || undefined,
      heat: text('heat') || undefined,
      tags: text('tags')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      includes: lines('includes'),
      specs: lines('specs').map((l) => {
        const [label, ...rest] = l.split(':')
        return { label: label?.trim() ?? '', value: rest.join(':').trim() }
      }),
      seoTitle: text('seoTitle'),
      seoDescription: text('seoDescription'),
      variants: variants.map((v) => ({
        id: v.id ?? '',
        sku: v.sku,
        name: v.name,
        price: v.price.replace(',', '.'),
        compareAt: v.compareAt.replace(',', '.'),
        stock: v.stock,
        isActive: v.isActive,
      })),
    })
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const payload = e.currentTarget.elements.namedItem('payload') as HTMLInputElement
        payload.value = buildPayload(e.currentTarget)
      }}
      className="space-y-6"
    >
      <input type="hidden" name="payload" />
      {product && <input type="hidden" name="id" value={product.id} />}

      <Card title="Información">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nombre</Label>
            <input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              required
              className={`${field} mt-1`}
              aria-invalid={Boolean(errors.name)}
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              required
              className={`${field} mt-1 font-mono`}
              aria-invalid={Boolean(errors.slug)}
            />
            {errors.slug && <p className="mt-1 text-xs text-teja">{errors.slug}</p>}
          </div>
          <div>
            <Label htmlFor="categoryId">Categoría</Label>
            <select id="categoryId" name="categoryId" defaultValue={product?.category_id ?? ''} className={`${field} mt-1`}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="subtitle">Subtítulo</Label>
            <input id="subtitle" name="subtitle" defaultValue={product?.subtitle ?? ''} maxLength={200} className={`${field} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea id="description" name="description" rows={5} defaultValue={product?.description ?? ''} className={`${field} mt-1 h-auto py-2`} />
          </div>
        </div>
      </Card>

      <Card title="Variantes, precios y stock">
        <div className="space-y-3">
          <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_auto_auto] gap-2 text-xs text-ash-ink md:grid">
            <span>Nombre</span>
            <span>SKU</span>
            <span>Precio €</span>
            <span>Antes €</span>
            <span>Stock</span>
            <span>Activa</span>
            <span />
          </div>
          {variants.map((v, i) => (
            <div key={v.id ?? `nueva-${i}`} className="grid grid-cols-2 gap-2 rounded-xl bg-mist p-3 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_auto_auto] md:items-center md:bg-transparent md:p-0">
              <input aria-label="Nombre de la variante" value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} className={field} />
              <input aria-label="SKU" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} className={`${field} font-mono`} />
              <input aria-label="Precio en euros" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} className={field} />
              <input aria-label="Precio anterior en euros" inputMode="decimal" value={v.compareAt} onChange={(e) => setVariant(i, { compareAt: e.target.value })} className={field} placeholder="—" />
              <input aria-label="Stock" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} className={field} />
              <label className="flex items-center gap-2 text-xs md:justify-center">
                <input type="checkbox" checked={v.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} className="size-4 accent-chef-ink" />
                <span className="md:sr-only">Activa</span>
              </label>
              <button
                type="button"
                onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))}
                disabled={variants.length === 1}
                className="grid size-9 place-items-center rounded-full text-ash-ink hover:bg-white hover:text-teja disabled:opacity-30"
                aria-label={`Quitar variante ${v.name}`}
              >
                <MinusIcon size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVariants((rows) => [...rows, { sku: '', name: '', price: '', compareAt: '', stock: '0', isActive: true }])}
            className="inline-flex items-center gap-1 text-sm text-teja hover:underline"
          >
            <PlusIcon size={15} /> Añadir variante
          </button>
          <p className="text-xs text-ash-ink">
            Precios con IVA incluido. Los cambios de stock quedan registrados en el historial de inventario. «Antes» debe ser mayor que el precio actual.
          </p>
        </div>
      </Card>

      <Card title="Características y filtros">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="minutes">Tiempo (min)</Label>
            <input id="minutes" name="minutes" inputMode="numeric" defaultValue={product?.attributes?.minutes ?? ''} className={`${field} mt-1`} />
          </div>
          <div>
            <Label htmlFor="difficulty">Dificultad</Label>
            <select id="difficulty" name="difficulty" defaultValue={product?.attributes?.difficulty ?? ''} className={`${field} mt-1`}>
              <option value="">—</option>
              <option value="1">1 · Fácil</option>
              <option value="2">2 · Media</option>
              <option value="3">3 · Reto</option>
            </select>
          </div>
          <div>
            <Label htmlFor="heat">Fuego</Label>
            <select id="heat" name="heat" defaultValue={product?.attributes?.heat ?? ''} className={`${field} mt-1`}>
              <option value="">—</option>
              <option value="sin-fuego">Sin fuego</option>
              <option value="microondas">Microondas</option>
              <option value="sarten">Sartén</option>
              <option value="cazo">Cazo</option>
              <option value="horno">Horno</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="tags">Etiquetas (separadas por comas)</Label>
            <input id="tags" name="tags" defaultValue={(product?.tags ?? []).join(', ')} placeholder="vegano, vegetariano, sin-gluten, picante" className={`${field} mt-1`} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="includes">Qué trae el kit (una línea por elemento)</Label>
            <textarea id="includes" name="includes" rows={4} defaultValue={(product?.includes ?? []).join('\n')} className={`${field} mt-1 h-auto py-2`} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="specs">Información técnica (una línea por dato, «Etiqueta: valor»)</Label>
            <textarea
              id="specs"
              name="specs"
              rows={4}
              defaultValue={(product?.specs ?? []).map((s: any) => `${s.label}: ${s.value}`).join('\n')}
              placeholder="Alérgenos: Gluten, soja"
              className={`${field} mt-1 h-auto py-2`}
            />
          </div>
        </div>
      </Card>

      <Card title="Publicación y SEO">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="status">Estado</Label>
            <select id="status" name="status" defaultValue={product?.status ?? 'draft'} className={`${field} mt-1`}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="taxRate">IVA %</Label>
            <input id="taxRate" name="taxRate" inputMode="decimal" defaultValue={((product?.tax_rate_bps ?? 1000) / 100).toString()} className={`${field} mt-1`} />
          </div>
          <div>
            <Label htmlFor="badge">Etiqueta destacada</Label>
            <input id="badge" name="badge" defaultValue={product?.badge ?? ''} maxLength={24} placeholder="Nuevo, Oferta…" className={`${field} mt-1`} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="isFeatured" defaultChecked={product?.is_featured ?? false} className="size-4 accent-chef-ink" /> Mostrar en destacados
          </label>
          <div className="sm:col-span-3">
            <Label htmlFor="seoTitle">Título SEO (máx. 70)</Label>
            <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={product?.seo_title ?? ''} className={`${field} mt-1`} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="seoDescription">Descripción SEO (máx. 170)</Label>
            <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={2} defaultValue={product?.seo_description ?? ''} className={`${field} mt-1 h-auto py-2`} />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center gap-4 rounded-2xl bg-white/90 p-3 shadow-float backdrop-blur">
        <Button disabled={pending}>{pending ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}</Button>
        <div className="flex-1">
          <Notice state={state} />
        </div>
      </div>
    </form>
  )
}
