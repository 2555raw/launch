import { describe, expect, it } from 'vitest'
import { customerId } from '@/lib/crm/id'
import { crmKpis, nextAction, segmentsOf } from '@/lib/crm/segments'
import type { CrmCustomer } from '@/lib/crm/types'

const now = new Date('2026-11-09T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
const order = (d: number, totalCents = 3000) => ({ id: `o${d}`, number: `HDM-${d}`, date: daysAgo(d), totalCents, items: [] })
const customer = (orders: CrmCustomer['orders'], over: Partial<CrmCustomer> = {}): CrmCustomer => ({
  id: 'x',
  email: 'ana@example.com',
  name: 'Ana Pérez',
  phone: null,
  city: null,
  province: null,
  hasAccount: true,
  newsletter: false,
  since: daysAgo(400),
  orders,
  tags: [],
  notes: [],
  tasks: [],
  ...over,
})

describe('segmentos del CRM', () => {
  it('clasifica por gasto, repetición y tiempo desde la última compra', () => {
    expect(segmentsOf(customer([]), now)).toEqual(['sin-compras'])
    expect(segmentsOf(customer([order(5)]), now)).toEqual(['nuevo'])
    expect(segmentsOf(customer([order(40)]), now)).toEqual(['una-compra'])
    expect(segmentsOf(customer([order(90)]), now)).toEqual(['en-riesgo'])
    expect(segmentsOf(customer([order(10), order(50)]), now)).toEqual(['recurrente'])
    expect(segmentsOf(customer([order(10, 9000), order(50, 7000)]), now)).toEqual(['vip', 'recurrente'])
  })

  it('propone el siguiente paso con el email ya escrito', () => {
    expect(nextAction(customer([order(90)]), now)?.body).toContain('HAMBRE5')
    expect(nextAction(customer([]), now)?.body).toContain('BIENVENIDA10')
    expect(nextAction(customer([order(10), order(50)]), now)).toBeNull()
  })

  it('calcula las cifras generales', () => {
    const k = crmKpis([customer([order(10), order(50)]), customer([order(5)], { email: 'b@example.com' }), customer([], { email: 'c@example.com' })], now)
    expect(k.customers).toBe(3)
    expect(k.buyers).toBe(2)
    expect(k.repeatRate).toBe(0.5)
    expect(k.avgTicketCents).toBe(3000)
  })

  it('el identificador no depende de mayúsculas ni espacios', () => {
    expect(customerId(' Ana@Example.com ')).toBe(customerId('ana@example.com'))
  })
})
