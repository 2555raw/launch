'use client'

import { useActionState, useEffect, useRef } from 'react'
import { updateImage, uploadProductImage } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { ChevronDownIcon, TrashIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { Label, Notice, field } from './ui'

type Img = { id: string; url: string; alt: string; position: number }

export function ImageManager({ productId, images }: { productId: string; images: Img[] }) {
  const [state, action, pending] = useActionState(uploadProductImage, null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <div className="space-y-5">
      {images.length === 0 ? (
        <p className="text-sm text-ash-ink">Sin imágenes. La primera será la principal.</p>
      ) : (
        <ul className="space-y-3">
          {images.map((img, i) => (
            <li key={img.id} className="flex gap-3 rounded-xl bg-mist p-2">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
                <ProductImage src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <form action={updateImage} className="flex gap-1.5">
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="intent" value="alt" />
                  <label htmlFor={`alt-${img.id}`} className="sr-only">
                    Texto alternativo
                  </label>
                  <input id={`alt-${img.id}`} name="alt" defaultValue={img.alt} placeholder="Texto alternativo" className={`${field} h-8 text-xs`} />
                  <button className="rounded-lg bg-white px-2 text-xs hover:bg-line">Guardar</button>
                </form>
                <div className="flex items-center gap-1 text-xs">
                  {i === 0 && <span className="mr-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">Principal</span>}
                  <form action={updateImage}>
                    <input type="hidden" name="id" value={img.id} />
                    <input type="hidden" name="intent" value="up" />
                    <button disabled={i === 0} className="grid size-7 place-items-center rounded-full hover:bg-white disabled:opacity-30" aria-label="Subir posición">
                      <ChevronDownIcon size={14} className="rotate-180" />
                    </button>
                  </form>
                  <form action={updateImage}>
                    <input type="hidden" name="id" value={img.id} />
                    <input type="hidden" name="intent" value="down" />
                    <button disabled={i === images.length - 1} className="grid size-7 place-items-center rounded-full hover:bg-white disabled:opacity-30" aria-label="Bajar posición">
                      <ChevronDownIcon size={14} />
                    </button>
                  </form>
                  <form
                    action={updateImage}
                    onSubmit={(e) => {
                      if (!confirm('¿Borrar esta imagen?')) e.preventDefault()
                    }}
                  >
                    <input type="hidden" name="id" value={img.id} />
                    <input type="hidden" name="intent" value="delete" />
                    <button className="grid size-7 place-items-center rounded-full text-ash-ink hover:bg-white hover:text-teja" aria-label="Borrar imagen">
                      <TrashIcon size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={action} className="space-y-3 border-t border-line pt-4">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <Label htmlFor="file">Subir imagen (JPG, PNG, WebP o AVIF · máx. 5 MB)</Label>
          <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-mist file:px-4 file:py-2 file:text-sm" />
        </div>
        <div>
          <Label htmlFor="alt">Texto alternativo</Label>
          <input id="alt" name="alt" placeholder="Describe la foto para lectores de pantalla" className={`${field} mt-1`} />
        </div>
        <Notice state={state} />
        <Button size="sm" disabled={pending}>
          {pending ? 'Subiendo…' : 'Subir imagen'}
        </Button>
      </form>
    </div>
  )
}
