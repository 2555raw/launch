'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/cart-context'
import { BagIcon, ChevronRightIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { Category } from '@/lib/types'
import { Logo } from './logo'
import { SearchPanel } from './search-panel'

const ease = [0.28, 0.11, 0.32, 1] as const

type NavCategory = Pick<Category, 'slug' | 'name' | 'tagline' | 'level' | 'imageUrl'>

const links = [
  { href: '/tienda?orden=novedades', label: 'Novedades' },
  { href: '/tienda?destacados=1', label: 'Destacados' },
  { href: '/categoria/caja-sorpresa', label: 'Caja sorpresa' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
]

export function Header({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()
  const { count, hydrated, openDrawer } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [flyout, setFlyout] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [search, setSearch] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cierra menús al navegar (ajuste de estado durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setFlyout(false)
    setMobile(false)
    setSearch(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlyout(false)
        setMobile(false)
        setSearch(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobile])

  const openFlyout = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setSearch(false)
    setFlyout(true)
  }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setFlyout(false), 120)
  }

  const overlayOpen = flyout || search

  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      <header
        className={cn(
          'sticky top-0 z-50 transition-[background-color,box-shadow] duration-300',
          overlayOpen || mobile ? 'bg-white' : 'bg-white/80 backdrop-blur-xl backdrop-saturate-150',
          scrolled && !overlayOpen && !mobile && 'shadow-[0_1px_0_var(--color-line)]',
        )}
      >
        <nav aria-label="Principal" className="container-page flex h-14 items-center justify-between gap-4">
          <Logo />

          <ul className="hidden items-center gap-7 text-[13px] text-ink/85 lg:flex">
            <li onMouseEnter={openFlyout} onMouseLeave={scheduleClose}>
              <button
                type="button"
                aria-expanded={flyout}
                aria-controls="flyout-kits"
                onClick={() => (flyout ? setFlyout(false) : openFlyout())}
                className="py-4 transition-colors hover:text-ink"
              >
                Kits por nivel
              </button>
            </li>
            <li>
              <Link href="/tienda" className="py-4 transition-colors hover:text-ink">
                Tienda
              </Link>
            </li>
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="py-4 transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setFlyout(false)
                setSearch((s) => !s)
              }}
              className="grid size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink"
              aria-label="Buscar en la tienda"
              aria-expanded={search}
            >
              <SearchIcon size={19} />
            </button>
            <Link
              href="/cuenta"
              className="hidden size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink sm:grid"
              aria-label="Mi cuenta"
            >
              <UserIcon size={20} />
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              className="relative grid size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink"
              aria-label={`Cesta, ${count} ${count === 1 ? 'producto' : 'productos'}`}
            >
              <BagIcon size={20} />
              <AnimatePresence>
                {hydrated && count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="absolute top-1 right-0.5 grid min-w-[18px] place-items-center rounded-full bg-chef-ink px-1 text-[10px] leading-[18px] font-semibold text-white"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={() => setMobile((m) => !m)}
              className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-mist lg:hidden"
              aria-label={mobile ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobile}
              aria-controls="menu-movil"
            >
              {mobile ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>

        {/* Flyout de escritorio con los niveles */}
        <AnimatePresence>
          {flyout && (
            <motion.div
              id="flyout-kits"
              key="flyout"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease }}
              onMouseEnter={openFlyout}
              onMouseLeave={scheduleClose}
              className="absolute inset-x-0 top-full hidden overflow-hidden bg-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.15)] lg:block"
            >
              <div className="container-page grid grid-cols-[1fr_2.5fr] gap-12 pt-6 pb-10">
                <div>
                  <p className="mb-3 text-xs text-ash-ink">Comprar kits</p>
                  <ul className="space-y-2">
                    <li>
                      <Link href="/tienda" className="font-display text-2xl font-bold hover:text-teja">
                        Ver toda la tienda
                      </Link>
                    </li>
                    <li>
                      <Link href="/tienda?orden=novedades" className="font-display text-2xl font-bold hover:text-teja">
                        Novedades
                      </Link>
                    </li>
                    <li>
                      <Link href="/tienda?orden=populares" className="font-display text-2xl font-bold hover:text-teja">
                        Los más vendidos
                      </Link>
                    </li>
                  </ul>
                </div>
                <ul className="grid grid-cols-4 gap-4">
                  {categories.map((c, i) => (
                    <motion.li
                      key={c.slug}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease }}
                    >
                      <Link href={`/categoria/${c.slug}`} className="group block">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mist">
                          {c.imageUrl && (
                            <Image
                              src={c.imageUrl}
                              alt=""
                              fill
                              sizes="220px"
                              className="object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-105"
                            />
                          )}
                        </div>
                        <p className="mt-3 text-[11px] font-semibold tracking-wide text-teja uppercase">
                          {c.level ? `Nivel ${c.level}` : 'Cada mes'}
                        </p>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-ash-ink">{c.tagline}</p>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{search && <SearchPanel onClose={() => setSearch(false)} />}</AnimatePresence>

        {/* Menú móvil */}
        <AnimatePresence>
          {mobile && (
            <motion.div
              id="menu-movil"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'calc(100dvh - 3.5rem)' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease }}
              className="overflow-y-auto bg-white lg:hidden"
            >
              <nav aria-label="Menú móvil" className="container-page pt-4 pb-12">
                <ul className="space-y-1">
                  {[{ href: '/tienda', label: 'Tienda' }, ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: c.name })), ...links].map(
                    (item, i) => (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.3, ease }}
                      >
                        <Link
                          href={item.href}
                          className="flex items-center justify-between py-2.5 font-display text-[26px] font-bold text-ink"
                        >
                          {item.label}
                          <ChevronRightIcon className="text-ash" />
                        </Link>
                      </motion.li>
                    ),
                  )}
                </ul>
                <div className="mt-8 border-t border-line pt-6">
                  <Link href="/cuenta" className="flex items-center gap-3 py-2 text-[17px]">
                    <UserIcon /> Mi cuenta
                  </Link>
                  <Link href="/cesta" className="flex items-center gap-3 py-2 text-[17px]">
                    <BagIcon /> Cesta
                  </Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Velo bajo los paneles desplegables */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
            onClick={() => {
              setFlyout(false)
              setSearch(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
