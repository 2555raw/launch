import 'server-only'
import QRCode from 'qrcode'
import { site } from '@/lib/config/site'

/**
 * URL que abre el QR de la tarjeta de cada kit. Por defecto, la página de la
 * receta en la tienda (/receta/<slug>). Con NEXT_PUBLIC_RECIPE_QR_TARGET se
 * puede apuntar a otra dirección (p. ej. un dominio corto impreso en la caja);
 * "{slug}" se sustituye por el del producto.
 */
export function recipeUrl(slug: string) {
  const target = process.env.NEXT_PUBLIC_RECIPE_QR_TARGET
  return target ? target.replaceAll('{slug}', slug) : `${site.url}/receta/${slug}`
}

/** SVG del QR (escaneable: corrección de errores media y margen de seguridad). */
export async function recipeQrSvg(slug: string) {
  return QRCode.toString(recipeUrl(slug), {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#1d1d1fff', light: '#ffffffff' },
  })
}
