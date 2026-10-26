import type { MetadataRoute } from 'next'
import { site } from '@/lib/config/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e63a2e',
    lang: 'es',
    icons: [{ src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }
}
