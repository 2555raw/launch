import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getCatalog } from '@/lib/catalog'
import { site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'
import { dayLabel, isPreorderOpen } from '@/lib/preorder'

/**
 * Imagen para compartir cada kit (WhatsApp, Instagram, X…): la foto del plato,
 * el nombre, el precio y la marca, en vez de la foto sola.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Hambre de Más'

/** Las fotos del modo demo están en /public; las de Supabase se cargan por URL. */
async function photoSrc(url: string) {
  if (url.startsWith('http')) return url
  const data = await readFile(join(process.cwd(), 'public', url))
  const type = url.endsWith('.png') ? 'image/png' : 'image/jpeg'
  return `data:${type};base64,${data.toString('base64')}`
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getCatalog().getProduct(slug)
  const { locale, t } = await getI18n()
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/brand/logo-320.png'))).toString('base64')}`
  const photo = product?.image ? await photoSrc(product.image.url).catch(() => null) : null
  const preorder = product?.attributes.preorder && isPreorderOpen(product.attributes) ? product.attributes.preorder : null

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff', fontFamily: 'Geist' }}>
        {photo && <img src={photo} alt="" width={630} height={630} style={{ width: 630, height: 630, objectFit: 'cover' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 52px', justifyContent: 'space-between' }}>
          <img src={logo} alt="" width={120} height={120} style={{ width: 120, height: 120, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(preorder || product?.category) && (
              <div
                style={{
                  display: 'flex',
                  alignSelf: 'flex-start',
                  borderRadius: 999,
                  padding: '6px 16px',
                  fontSize: 22,
                  fontWeight: 700,
                  color: preorder ? '#ffffff' : '#bf2d11',
                  background: preorder ? '#d63327' : '#fdf0e5',
                }}
              >
                {preorder
                  ? t({ es: `Encárgala hasta el ${dayLabel(preorder.closesDate ?? preorder.releaseDate, locale, 'short')}`, en: `Pre-order until ${dayLabel(preorder.closesDate ?? preorder.releaseDate, locale, 'short')}` })
                  : product?.category?.name}
              </div>
            )}
            <div style={{ display: 'flex', marginTop: 20, fontSize: 58, fontWeight: 800, lineHeight: 1.05, color: '#1d1d1f' }}>
              {product?.name ?? site.name}
            </div>
            {product?.subtitle && (
              <div style={{ display: 'flex', marginTop: 16, fontSize: 26, lineHeight: 1.3, color: '#6e6e73', maxHeight: 102, overflow: 'hidden' }}>{product.subtitle}</div>
            )}
          </div>
          {product && (
            <div style={{ display: 'flex', alignItems: 'baseline', color: '#d63327' }}>
              {product.variantCount > 1 && <div style={{ display: 'flex', fontSize: 26, color: '#6e6e73', marginRight: 12 }}>{t({ es: 'Desde', en: 'From' })}</div>}
              <div style={{ display: 'flex', fontSize: 48 }}>{formatPrice(product.priceCents, locale)}</div>
            </div>
          )}
        </div>
      </div>
    ),
    size,
  )
}
