'use client'

import { useActionState } from 'react'
import { saveCategory } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Label, Notice, field } from './ui'

/* eslint-disable @typescript-eslint/no-explicit-any -- fila sin tipar */

export function CategoryForm({ category }: { category?: any }) {
  const [state, action, pending] = useActionState(saveCategory, null)
  const k = category?.id ?? 'nueva'
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div>
        <Label htmlFor={`name-${k}`}>Nombre</Label>
        <input id={`name-${k}`} name="name" defaultValue={category?.name ?? ''} required className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor={`slug-${k}`}>Slug</Label>
        <input id={`slug-${k}`} name="slug" defaultValue={category?.slug ?? ''} required className={`${field} mt-1 font-mono`} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`tagline-${k}`}>Lema</Label>
        <input id={`tagline-${k}`} name="tagline" defaultValue={category?.tagline ?? ''} className={`${field} mt-1`} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`description-${k}`}>Descripción</Label>
        <textarea id={`description-${k}`} name="description" rows={2} defaultValue={category?.description ?? ''} className={`${field} mt-1 h-auto py-2`} />
      </div>
      <div>
        <Label htmlFor={`level-${k}`}>Nivel (vacío si no aplica)</Label>
        <input id={`level-${k}`} name="level" inputMode="numeric" defaultValue={category?.level ?? ''} className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor={`accent-${k}`}>Color</Label>
        <select id={`accent-${k}`} name="accent" defaultValue={category?.accent ?? 'chef'} className={`${field} mt-1`}>
          <option value="chef">Rojo Chef</option>
          <option value="teja">Rojo Teja</option>
          <option value="hoja">Verde Hoja</option>
          <option value="almendra">Almendra</option>
        </select>
      </div>
      <div>
        <Label htmlFor={`imageUrl-${k}`}>URL de imagen</Label>
        <input id={`imageUrl-${k}`} name="imageUrl" defaultValue={category?.image_url ?? ''} className={`${field} mt-1`} />
      </div>
      <div>
        <Label htmlFor={`position-${k}`}>Orden</Label>
        <input id={`position-${k}`} name="position" type="number" defaultValue={category?.position ?? 0} className={`${field} mt-1`} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isPublished" defaultChecked={category?.is_published ?? true} className="size-4 accent-chef-ink" /> Visible en la tienda
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" disabled={pending}>{pending ? 'Guardando…' : category ? 'Guardar' : 'Crear categoría'}</Button>
        <Notice state={state} />
      </div>
    </form>
  )
}
