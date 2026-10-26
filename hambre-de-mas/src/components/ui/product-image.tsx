import Image, { type ImageProps } from 'next/image'

/**
 * Imagen de producto optimizada. Las imágenes servidas desde un Supabase
 * local (127.0.0.1) no pasan por el optimizador, que bloquea IPs locales.
 */
export function ProductImage({ src, alt, ...props }: Omit<ImageProps, 'src'> & { src: string }) {
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(src)
  return <Image src={src} alt={alt} unoptimized={local} {...props} />
}
