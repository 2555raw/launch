'use client'

import { useActionState } from 'react'
import { refundOrder, updateFulfillment } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { fulfillmentStatusLabel } from '@/lib/orders/mapper'
import type { Order } from '@/lib/types'
import { Label, Notice, field } from './ui'

export function FulfillmentForm({ order }: { order: Order }) {
  const [state, action, pending] = useActionState(updateFulfillment, null)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={order.id} />
      <div>
        <Label htmlFor="fulfillmentStatus">Estado del envío</Label>
        <select id="fulfillmentStatus" name="fulfillmentStatus" defaultValue={order.fulfillmentStatus} className={`${field} mt-1`}>
          {Object.entries(fulfillmentStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="trackingCarrier">Transportista</Label>
          <input id="trackingCarrier" name="trackingCarrier" defaultValue={order.trackingCarrier ?? ''} className={`${field} mt-1`} />
        </div>
        <div>
          <Label htmlFor="trackingNumber">Nº de seguimiento</Label>
          <input id="trackingNumber" name="trackingNumber" defaultValue={order.trackingNumber ?? ''} className={`${field} mt-1`} />
        </div>
      </div>
      <div>
        <Label htmlFor="trackingUrl">URL de seguimiento</Label>
        <input id="trackingUrl" name="trackingUrl" type="url" defaultValue={order.trackingUrl ?? ''} className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor="adminNotes">Notas internas</Label>
        <textarea id="adminNotes" name="adminNotes" rows={3} defaultValue={order.adminNotes ?? ''} className={`${field} mt-1 h-auto py-2`} />
      </div>
      <Notice state={state} />
      <Button size="sm" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar envío'}
      </Button>
    </form>
  )
}

export function RefundButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(refundOrder, null)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('¿Reembolsar el importe total de este pedido en Stripe?')) e.preventDefault()
      }}
      className="space-y-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Button variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Solicitando…' : 'Reembolsar pedido completo'}
      </Button>
      <Notice state={state} />
    </form>
  )
}
