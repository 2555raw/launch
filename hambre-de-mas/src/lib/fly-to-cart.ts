'use client'

/**
 * Miniatura del kit que vuela desde `from` hasta el icono de la cesta de la
 * cabecera (marcado con data-cart-target) y le da un pequeño bote al llegar.
 * Resuelve al terminar; sin icono visible o con «reducir movimiento», al momento.
 */
export function flyToCart(from: Element | null | undefined, imageUrl: string | null | undefined): Promise<void> {
  if (typeof window === 'undefined' || !from || !imageUrl) return Promise.resolve()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  const target = [...document.querySelectorAll<HTMLElement>('[data-cart-target]')].find((el) => el.offsetParent !== null)
  if (!target) return Promise.resolve()

  const start = from.getBoundingClientRect()
  const end = target.getBoundingClientRect()
  const size = Math.min(140, Math.max(56, Math.min(start.width, start.height) * 0.45))
  const x0 = start.left + start.width / 2 - size / 2
  const y0 = start.top + start.height / 2 - size / 2
  const dx = end.left + end.width / 2 - size / 2 - x0
  const dy = end.top + end.height / 2 - size / 2 - y0

  const img = document.createElement('img')
  img.src = imageUrl
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  Object.assign(img.style, {
    position: 'fixed',
    left: `${x0}px`,
    top: `${y0}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: 'cover',
    borderRadius: '9999px',
    boxShadow: '0 12px 30px -8px rgb(29 29 31 / 0.45)',
    border: '3px solid white',
    zIndex: '100',
    pointerEvents: 'none',
  })
  document.body.appendChild(img)

  // Arco: sube un poco antes de caer en la cesta
  const flight = img.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(0.7)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0.6 },
    ],
    { duration: 750, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' },
  )

  return new Promise((resolve) => {
    const done = () => {
      img.remove()
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)' }, { transform: 'scale(1)' }], {
        duration: 380,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      })
      resolve()
    }
    flight.onfinish = done
    flight.oncancel = done
  })
}
