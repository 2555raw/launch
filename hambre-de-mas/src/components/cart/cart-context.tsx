'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { commerce } from '@/lib/config/commerce'

/**
 * Estado del carrito en el navegador. Se guarda en localStorage para que
 * sobreviva a la navegación y se sincroniza entre pestañas. Los precios que
 * se guardan aquí son solo orientativos: el total real lo calcula siempre el
 * servidor (/api/cart/quote) y el pago se crea con precios del servidor.
 */

export type CartItem = {
  variantId: string
  productId: string
  slug: string
  name: string
  variantName: string
  imageUrl: string | null
  priceCents: number
  quantity: number
  maxQuantity: number
}

type State = { items: CartItem[]; promoCode: string | null }

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'add'; item: CartItem }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'sync'; updates: { variantId: string; maxQuantity: number; priceCents?: number }[] }
  | { type: 'promo'; code: string | null }
  | { type: 'clear' }

const STORAGE_KEY = 'hdm-cart-v1'
const clamp = (n: number, max: number) => Math.max(1, Math.min(Math.floor(n), Math.max(1, max), commerce.maxQuantityPerLine))

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'add': {
      const existing = state.items.find((i) => i.variantId === action.item.variantId)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.variantId === action.item.variantId
              ? { ...i, ...action.item, quantity: clamp(i.quantity + action.item.quantity, action.item.maxQuantity) }
              : i,
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.item, quantity: clamp(action.item.quantity, action.item.maxQuantity) }] }
    }
    case 'setQuantity':
      return {
        ...state,
        items: state.items.map((i) => (i.variantId === action.variantId ? { ...i, quantity: clamp(action.quantity, i.maxQuantity) } : i)),
      }
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.variantId !== action.variantId) }
    case 'sync': {
      let changed = false
      const items = state.items.map((i) => {
        const u = action.updates.find((x) => x.variantId === i.variantId)
        if (!u) return i
        const next = {
          ...i,
          maxQuantity: u.maxQuantity,
          priceCents: u.priceCents ?? i.priceCents,
          quantity: u.maxQuantity > 0 ? Math.min(i.quantity, u.maxQuantity) : i.quantity,
        }
        if (next.maxQuantity !== i.maxQuantity || next.priceCents !== i.priceCents || next.quantity !== i.quantity) changed = true
        return next
      })
      return changed ? { ...state, items } : state
    }
    case 'promo':
      return { ...state, promoCode: action.code }
    case 'clear':
      return state.items.length === 0 && state.promoCode === null ? state : { items: [], promoCode: null }
  }
}

function readStorage(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], promoCode: null }
    const parsed = JSON.parse(raw) as Partial<State>
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i): i is CartItem => typeof i?.variantId === 'string' && Number.isFinite(i?.quantity))
      : []
    return { items, promoCode: typeof parsed.promoCode === 'string' ? parsed.promoCode : null }
  } catch {
    return { items: [], promoCode: null }
  }
}

type CartContextValue = {
  items: CartItem[]
  promoCode: string | null
  count: number
  estimatedSubtotal: number
  hydrated: boolean
  drawerOpen: boolean
  lastAdded: CartItem | null
  addItem: (item: CartItem, options?: { openDrawer?: boolean }) => void
  setQuantity: (variantId: string, quantity: number) => void
  removeItem: (variantId: string) => void
  syncFromServer: (updates: { variantId: string; maxQuantity: number; priceCents?: number }[]) => void
  setPromoCode: (code: string | null) => void
  clear: () => void
  openDrawer: () => void
  closeDrawer: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], promoCode: null })
  const [hydrated, setHydrated] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<CartItem | null>(null)
  const skipWrite = useRef(true)

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee tras montar para no
    // romper la hidratación del HTML del servidor.
    dispatch({ type: 'hydrate', state: readStorage() })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización con un sistema externo (localStorage)
    setHydrated(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        skipWrite.current = true
        dispatch({ type: 'hydrate', state: readStorage() })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (skipWrite.current) {
      skipWrite.current = false
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Modo privado o almacenamiento lleno: el carrito sigue en memoria.
    }
  }, [state, hydrated])

  const addItem = useCallback((item: CartItem, options?: { openDrawer?: boolean }) => {
    dispatch({ type: 'add', item })
    setLastAdded(item)
    if (options?.openDrawer !== false) setDrawerOpen(true)
  }, [])

  // Acciones estables (dispatch no cambia) para poder usarlas en efectos.
  const actions = useMemo(
    () => ({
      setQuantity: (variantId: string, quantity: number) => dispatch({ type: 'setQuantity', variantId, quantity }),
      removeItem: (variantId: string) => dispatch({ type: 'remove', variantId }),
      syncFromServer: (updates: { variantId: string; maxQuantity: number; priceCents?: number }[]) => dispatch({ type: 'sync', updates }),
      setPromoCode: (code: string | null) => dispatch({ type: 'promo', code: code ? code.trim().toUpperCase() : null }),
      clear: () => dispatch({ type: 'clear' }),
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      promoCode: state.promoCode,
      count: state.items.reduce((s, i) => s + i.quantity, 0),
      estimatedSubtotal: state.items.reduce((s, i) => s + i.quantity * i.priceCents, 0),
      hydrated,
      drawerOpen,
      lastAdded,
      addItem,
      ...actions,
    }),
    [state, hydrated, drawerOpen, lastAdded, addItem, actions],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}
