// Genera supabase/seed.sql a partir de src/data/demo-catalog.ts.
// Uso: npm run db:seed:generate
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { demoCategories, demoId, demoProducts, demoPromotions } from '../src/data/demo-catalog.ts'
import { demoCategoriesEn, demoProductsEn } from '../src/data/demo-catalog-en.ts'

const q = (value: string | null | undefined) => (value == null ? 'null' : `'${value.replace(/'/g, "''")}'`)
const arr = (values: string[]) => `array[${values.map(q).join(', ')}]::text[]`
const json = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`

const lines: string[] = [
  '-- GENERADO por scripts/generate-seed.ts a partir de src/data/demo-catalog.ts.',
  '-- No lo edites a mano: cambia el catálogo de demo y vuelve a generarlo.',
  '-- Todo lo que crea lleva is_demo = true o códigos de ejemplo, para poder borrarlo.',
  '',
  'begin;',
  '',
]

for (const c of demoCategories) {
  lines.push(
    `insert into public.categories (id, slug, name, tagline, description, level, accent, image_url, position, translations) values (` +
      [
        q(demoId('category', c.slug)),
        q(c.slug),
        q(c.name),
        q(c.tagline),
        q(c.description),
        c.level ?? 'null',
        q(c.accent),
        q(c.image),
        c.position,
        json(demoCategoriesEn[c.slug] ? { en: demoCategoriesEn[c.slug] } : {}),
      ].join(', ') +
      `) on conflict (id) do update set translations = excluded.translations;`,
  )
}
lines.push('')

for (const p of demoProducts) {
  const id = demoId('product', p.slug)
  lines.push(
    `insert into public.products (id, slug, name, subtitle, description, category_id, tax_rate_bps, status, is_featured, is_demo, badge, sales_count, attributes, specs, tags, allergens, allergen_traces, recipe_allergens, recipe, includes, translations, published_at, created_at) values (` +
      [
        q(id),
        q(p.slug),
        q(p.name),
        q(p.subtitle),
        q(p.description),
        q(demoId('category', p.category)),
        1000,
        q('published'),
        p.featured ? 'true' : 'false',
        'true',
        q(p.badge ?? null),
        p.salesCount,
        json(p.attributes),
        json(p.specs),
        arr(p.tags),
        arr(p.allergens.contains),
        arr(p.allergens.traces ?? []),
        arr(p.allergens.recipe ?? []),
        json(p.recipe),
        arr(p.includes),
        json(demoProductsEn[p.slug] ? { en: demoProductsEn[p.slug] } : {}),
        `now() - interval '${p.publishedDaysAgo} days'`,
        `now() - interval '${p.publishedDaysAgo} days'`,
      ].join(', ') +
      `) on conflict (id) do update set translations = excluded.translations;`,
  )
  p.images.forEach((img, i) => {
    lines.push(
      `insert into public.product_images (id, product_id, url, alt, position) values (` +
        [q(demoId('image', `${p.slug}/${img.file}`)), q(id), q(`/demo/products/${img.file}`), q(img.alt), i].join(', ') +
        `) on conflict (id) do nothing;`,
    )
  })
  p.variants.forEach((v, i) => {
    lines.push(
      `insert into public.product_variants (id, product_id, sku, name, price_cents, compare_at_price_cents, stock, position) values (` +
        [q(demoId('variant', v.sku)), q(id), q(v.sku), q(v.name), v.price, v.compareAt ?? 'null', v.stock, i].join(', ') +
        `) on conflict (id) do nothing;`,
    )
  })
  lines.push('')
}

for (const promo of demoPromotions) {
  lines.push(
    `insert into public.promotions (id, code, description, kind, value, min_subtotal_cents) values (` +
      [q(demoId('promotion', promo.code)), q(promo.code), q(`[DEMO] ${promo.description}`), q(promo.kind), promo.value, promo.minSubtotal].join(', ') +
      `) on conflict (code) do nothing;`,
  )
}

lines.push('', 'commit;', '')

const target = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url))
writeFileSync(target, lines.join('\n'))
console.log(`seed.sql generado: ${demoProducts.length} productos, ${demoCategories.length} categorías`)
