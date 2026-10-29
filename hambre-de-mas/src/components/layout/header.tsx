'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/cart-context'
import { ArrowRightIcon, BagIcon, ChevronRightIcon, CloseIcon, GiftIcon, MenuIcon, SearchIcon, UserIcon } from '@/components/ui/icons'
import { dietOptions, timeOptions } from '@/lib/catalog/params'
import { cn } from '@/lib/cn'
import { howItWorksSteps } from '@/lib/how-it-works'
import { useI18n } from '@/lib/i18n/client'
import type { Category } from '@/lib/types'
import { LocaleSwitcher } from './locale-switcher'
import { Logo } from './logo'
import { SearchPanel } from './search-panel'

const ease = [0.28, 0.11, 0.32, 1] as const

type NavCategory = Pick<Category, 'slug' | 'name' | 'tagline' | 'level' | 'imageUrl'>

export type MenuKit = { slug: string; name: string; image: string | null; price: string; level: number | null }
export type MenuData = {
  newest: MenuKit[]
  featured: MenuKit[]
  box: { image: string | null; subtitle: string | null; options: { name: string; price: string }[] } | null
}

type MenuId = 'niveles' | 'tienda' | 'novedades' | 'destacados' | 'caja' | 'como'

const navItems: { id: MenuId; href: string | null; label: { es: string; en: string } }[] = [
  { id: 'niveles', href: null, label: { es: 'Kits por nivel', en: 'Kits by level' } },
  { id: 'tienda', href: '/tienda', label: { es: 'Tienda', en: 'Shop' } },
  { id: 'novedades', href: '/tienda?nuevos=1', label: { es: 'Novedades', en: 'New' } },
  { id: 'destacados', href: '/tienda?destacados=1', label: { es: 'Destacados', en: 'Featured' } },
  { id: 'caja', href: '/categoria/caja-sorpresa', label: { es: 'Caja sorpresa', en: 'Surprise box' } },
  { id: 'como', href: '/#como-funciona', label: { es: 'Cómo funciona', en: 'How it works' } },
]

export function Header({ categories, menu }: { categories: NavCategory[]; menu: MenuData }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const links = navItems.flatMap((item) => (item.href && item.id !== 'tienda' ? [{ href: item.href, label: t(item.label) }] : []))
  const { count, hydrated, openDrawer } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [flyout, setFlyout] = useState<MenuId | null>(null)
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
    setFlyout(null)
    setMobile(false)
    setSearch(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlyout(null)
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

  const openFlyout = (id: MenuId) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setSearch(false)
    setFlyout(id)
  }
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setFlyout(null), 140)
  }
  // Al pulsar cualquier enlace del menú, se cierra (aunque la ruta no cambie, p. ej. /tienda → /tienda?nuevos=1)
  const closeOnLink = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setFlyout(null)
  }

  const overlayOpen = flyout !== null || search

  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t({ es: 'Saltar al contenido', en: 'Skip to content' })}
      </a>

      <header
        className={cn(
          'sticky top-0 z-50 transition-[background-color,box-shadow] duration-300',
          overlayOpen || mobile ? 'bg-white' : 'bg-white/80 backdrop-blur-xl backdrop-saturate-150',
          scrolled && !overlayOpen && !mobile && 'shadow-[0_1px_0_var(--color-line)]',
        )}
      >
        <nav aria-label={t({ es: 'Principal', en: 'Main' })} className="container-page flex h-14 items-center justify-between gap-4">
          <Logo />

          <ul className="hidden items-center gap-7 text-[13px] text-ink/85 lg:flex" onClick={closeOnLink}>
            {navItems.map((item) => (
              <li key={item.id} onMouseEnter={() => openFlyout(item.id)} onMouseLeave={scheduleClose}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onFocus={() => openFlyout(item.id)}
                    aria-controls="menu-desplegable"
                    className={cn('py-4 transition-colors hover:text-ink', flyout === item.id && 'text-ink')}
                  >
                    {t(item.label)}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-expanded={flyout === item.id}
                    aria-controls="menu-desplegable"
                    onClick={() => (flyout === item.id ? setFlyout(null) : openFlyout(item.id))}
                    className={cn('py-4 transition-colors hover:text-ink', flyout === item.id && 'text-ink')}
                  >
                    {t(item.label)}
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <LocaleSwitcher className="hidden sm:block" />
            <button
              type="button"
              onClick={() => {
                setFlyout(null)
                setSearch((s) => !s)
              }}
              className="grid size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink"
              aria-label={t({ es: 'Buscar en la tienda', en: 'Search the shop' })}
              aria-expanded={search}
            >
              <SearchIcon size={19} />
            </button>
            <Link
              href="/cuenta"
              className="hidden size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink sm:grid"
              aria-label={t({ es: 'Mi cuenta', en: 'My account' })}
            >
              <UserIcon size={20} />
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              className="relative grid size-10 place-items-center rounded-full text-ink/80 transition-colors hover:bg-mist hover:text-ink"
              aria-label={t({ es: `Cesta, ${count} ${count === 1 ? 'producto' : 'productos'}`, en: `Bag, ${count} ${count === 1 ? 'item' : 'items'}` })}
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
              aria-label={mobile ? t({ es: 'Cerrar menú', en: 'Close menu' }) : t({ es: 'Abrir menú', en: 'Open menu' })}
              aria-expanded={mobile}
              aria-controls="menu-movil"
            >
              {mobile ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>

        {/* Menús desplegables de escritorio, uno por enlace */}
        <AnimatePresence>
          {flyout && (
            <motion.div
              id="menu-desplegable"
              key="flyout"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease }}
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleClose}
              onClick={closeOnLink}
              className="absolute inset-x-0 top-full hidden overflow-hidden bg-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.15)] lg:block"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={flyout}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease }}
                  className="container-page pt-6 pb-10"
                >
                  <MenuPanel id={flyout} categories={categories} menu={menu} />
                </motion.div>
              </AnimatePresence>
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
              <nav aria-label={t({ es: 'Menú móvil', en: 'Mobile menu' })} className="container-page pt-4 pb-12">
                <ul className="space-y-1">
                  {[{ href: '/tienda', label: t({ es: 'Tienda', en: 'Shop' }) }, ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: c.name })), ...links]
                    .filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i)
                    .map(
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
                    <UserIcon /> {t({ es: 'Mi cuenta', en: 'My account' })}
                  </Link>
                  <Link href="/cesta" className="flex items-center gap-3 py-2 text-[17px]">
                    <BagIcon /> {t({ es: 'Cesta', en: 'Bag' })}
                  </Link>
                  <LocaleSwitcher variant="segmented" className="mt-6" />
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
              setFlyout(null)
              setSearch(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function MenuHeading({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs text-ash-ink">{children}</p>
}

function BigLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="font-display text-2xl font-bold hover:text-teja">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function SmallLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <MenuHeading>{title}</MenuHeading>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[15px] font-semibold text-ink/85 hover:text-teja">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stagger({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease }}>
      {children}
    </motion.li>
  )
}

function KitTiles({ kits }: { kits: MenuKit[] }) {
  const { t } = useI18n()
  return (
    <ul className="grid grid-cols-4 gap-4">
      {kits.map((k, i) => (
        <Stagger key={k.slug} i={i}>
          <Link href={`/producto/${k.slug}`} className="group block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mist">
              {k.image && (
                <Image src={k.image} alt="" fill sizes="220px" className="object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-105" />
              )}
            </div>
            <p className="mt-3 text-[11px] font-semibold tracking-wide text-teja uppercase">
              {k.level ? t({ es: `Nivel ${k.level}`, en: `Level ${k.level}` }) : t({ es: 'Cada mes', en: 'Every month' })}
            </p>
            <p className="text-sm font-semibold">{k.name}</p>
            <p className="text-xs text-ash-ink tabular-nums">{t({ es: `Desde ${k.price}`, en: `From ${k.price}` })}</p>
          </Link>
        </Stagger>
      ))}
    </ul>
  )
}

function MenuPanel({ id, categories, menu }: { id: MenuId; categories: NavCategory[]; menu: MenuData }) {
  const { locale, t } = useI18n()
  const shopLinks = [
    { href: '/tienda', label: t({ es: 'Ver toda la tienda', en: 'Shop all kits' }) },
    { href: '/tienda?nuevos=1', label: t({ es: 'Novedades', en: 'New arrivals' }) },
    { href: '/tienda?orden=populares', label: t({ es: 'Los más vendidos', en: 'Best sellers' }) },
  ]

  if (id === 'niveles') {
    return (
      <div className="grid grid-cols-[1fr_2.5fr] gap-12">
        <div>
          <MenuHeading>{t({ es: 'Comprar kits', en: 'Shop kits' })}</MenuHeading>
          <BigLinks links={shopLinks} />
        </div>
        <ul className="grid grid-cols-4 gap-4">
          {categories.map((c, i) => (
            <Stagger key={c.slug} i={i}>
              <Link href={`/categoria/${c.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mist">
                  {c.imageUrl && (
                    <Image src={c.imageUrl} alt="" fill sizes="220px" className="object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-105" />
                  )}
                </div>
                <p className="mt-3 text-[11px] font-semibold tracking-wide text-teja uppercase">
                  {c.level ? t({ es: `Nivel ${c.level}`, en: `Level ${c.level}` }) : t({ es: 'Cada mes', en: 'Every month' })}
                </p>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-ash-ink">{c.tagline}</p>
              </Link>
            </Stagger>
          ))}
        </ul>
      </div>
    )
  }

  if (id === 'tienda') {
    const label = (o: { label: string; labelEn: string }) => (locale === 'en' ? o.labelEn : o.label)
    return (
      <div className="grid grid-cols-[1fr_2.5fr] gap-12">
        <div>
          <MenuHeading>{t({ es: 'Tienda', en: 'Shop' })}</MenuHeading>
          <BigLinks
            links={[
              ...shopLinks,
              { href: '/tienda?destacados=1', label: t({ es: 'Destacados', en: 'Featured' }) },
              { href: '/tienda?dieta=alto-en-proteina', label: t({ es: 'Para el gym', en: 'For the gym' }) },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-8">
          <SmallLinks title={t({ es: 'Por nivel', en: 'By level' })} links={categories.map((c) => ({ href: `/categoria/${c.slug}`, label: c.name }))} />
          <SmallLinks title={t({ es: 'Por dieta y sabor', en: 'By diet and flavour' })} links={dietOptions.map((o) => ({ href: `/tienda?dieta=${o.value}`, label: label(o) }))} />
          <SmallLinks title={t({ es: 'Por tiempo', en: 'By time' })} links={timeOptions.map((o) => ({ href: `/tienda?tiempo=${o.value}`, label: label(o) }))} />
        </div>
      </div>
    )
  }

  if (id === 'novedades' || id === 'destacados') {
    const isNew = id === 'novedades'
    return (
      <div className="grid grid-cols-[1fr_2.5fr] gap-12">
        <div>
          <MenuHeading>{isNew ? t({ es: 'Novedades', en: 'New arrivals' }) : t({ es: 'Destacados', en: 'Featured' })}</MenuHeading>
          <p className="font-display text-2xl leading-tight font-bold">
            {isNew ? t({ es: 'Recién salidos del horno.', en: 'Fresh out of the oven.' }) : t({ es: 'Los que más os flipan.', en: 'The ones you love most.' })}
          </p>
          <Link
            href={isNew ? '/tienda?nuevos=1' : '/tienda?destacados=1'}
            className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-teja hover:underline"
          >
            {isNew ? t({ es: 'Ver todas las novedades', en: 'See all new kits' }) : t({ es: 'Ver todos los destacados', en: 'See all featured kits' })}
            <ArrowRightIcon size={15} />
          </Link>
        </div>
        <KitTiles kits={isNew ? menu.newest : menu.featured} />
      </div>
    )
  }

  if (id === 'caja') {
    return (
      <div className="grid grid-cols-[1fr_2.5fr] gap-12">
        <div>
          <MenuHeading>{t({ es: 'Caja sorpresa', en: 'Surprise box' })}</MenuHeading>
          <p className="font-display text-2xl leading-tight font-bold">{t({ es: 'Cocina algo distinto cada mes.', en: 'Cook something different every month.' })}</p>
          {menu.box?.subtitle && <p className="mt-2 text-sm text-ash-ink">{menu.box.subtitle}</p>}
          <Link href="/categoria/caja-sorpresa" className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-teja hover:underline">
            {t({ es: 'Elegir mi caja', en: 'Choose my box' })} <ArrowRightIcon size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-6">
          <Link href="/categoria/caja-sorpresa" className="group relative block aspect-[16/8] overflow-hidden rounded-2xl bg-mist">
            {menu.box?.image && (
              <Image src={menu.box.image} alt="" fill sizes="480px" className="object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-105" />
            )}
          </Link>
          <ul className="space-y-2.5">
            {menu.box?.options.map((o, i) => (
              <Stagger key={o.name} i={i}>
                <Link href="/categoria/caja-sorpresa" className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3 transition-colors hover:bg-almendra-soft">
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <GiftIcon size={16} className="text-teja" /> {o.name}
                  </span>
                  <span className="text-sm text-ash-ink tabular-nums">{o.price}</span>
                </Link>
              </Stagger>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[1fr_2.5fr] gap-12">
      <div>
        <MenuHeading>{t({ es: 'Cómo funciona', en: 'How it works' })}</MenuHeading>
        <p className="font-display text-2xl leading-tight font-bold">{t({ es: 'Aprender a cocinar como si fuera un videojuego.', en: 'Learn to cook like it’s a video game.' })}</p>
        <Link href="/#como-funciona" className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-teja hover:underline">
          {t({ es: 'Ver cómo funciona', en: 'See how it works' })} <ArrowRightIcon size={15} />
        </Link>
      </div>
      <ol className="grid grid-cols-3 gap-4">
        {howItWorksSteps.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease }}
            className="rounded-[22px] bg-almendra-soft p-5"
          >
            <span className="grid size-10 place-items-center rounded-full bg-chef-ink font-display text-lg font-extrabold text-white">{s.n}</span>
            <p className="mt-4 font-display text-lg font-bold text-teja">{t(s.title)}</p>
            <p className="mt-1 text-sm text-ink/80">{t(s.text)}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
