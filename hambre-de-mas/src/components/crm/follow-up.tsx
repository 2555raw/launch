'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { addCrmNote, addCrmTask, setCrmTag, setCrmTaskDone } from '@/app/actions/crm'
import { Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { CloseIcon } from '@/components/ui/icons'
import type { CrmNote, CrmTask } from '@/lib/crm/types'
import { cn } from '@/lib/cn'

const SUGGESTED_TAGS = ['vegetariano', 'alergia frutos secos', 'sin gluten', 'compra para su hijo/a', 'regalo', 'gym', 'colegio']

type State = { notes: CrmNote[]; tasks: CrmTask[]; tags: string[] }

/**
 * Seguimiento del cliente: etiquetas, tareas y notas. Con base de datos se
 * guarda en Supabase; en la vista previa, en este navegador (localStorage),
 * para poder enseñar el CRM sin cuenta.
 */
export function FollowUp({ email, customerId, initial, demo }: { email: string; customerId: string; initial: State; demo: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<State>(initial)
  const [note, setNote] = useState('')
  const [task, setTask] = useState('')
  const [due, setDue] = useState('')
  const [tag, setTag] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const key = `hdm:crm:${customerId}`

  // Vista previa: lo que se añadió en este navegador
  useEffect(() => {
    if (!demo) return
    try {
      const saved = localStorage.getItem(key)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización con localStorage tras montar
      if (saved) setState(JSON.parse(saved) as State)
    } catch {
      // Sin localStorage: se queda con los datos de ejemplo
    }
  }, [demo, key])

  const update = (next: State, save: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null)
    setState(next)
    if (demo) {
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Sin localStorage: el cambio dura hasta recargar
      }
      return
    }
    start(async () => {
      const result = await save()
      if (!result.ok) setError(result.message ?? 'No se ha podido guardar.')
      router.refresh()
    })
  }

  const now = () => new Date().toISOString()
  const localId = () => `local-${Date.now().toString(36)}`

  const addNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    const body = note.trim()
    setNote('')
    update({ ...state, notes: [{ id: localId(), body, author: demo ? 'Tú' : 'Equipo', createdAt: now() }, ...state.notes] }, () => addCrmNote({ email, body }))
  }
  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!task.trim()) return
    const title = task.trim()
    const dueDate = due || null
    setTask('')
    setDue('')
    update({ ...state, tasks: [{ id: localId(), title, dueDate, done: false, createdAt: now() }, ...state.tasks] }, () => addCrmTask({ email, title, dueDate }))
  }
  const toggleTask = (t: CrmTask) =>
    update({ ...state, tasks: state.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }, () => setCrmTaskDone({ id: t.id, done: !t.done }))
  const toggleTag = (value: string, on: boolean) => {
    const clean = value.trim().toLowerCase()
    if (!clean || (on && state.tags.includes(clean))) return
    update({ ...state, tags: on ? [...state.tags, clean] : state.tags.filter((x) => x !== clean) }, () => setCrmTag({ email, tag: clean, on }))
  }

  const openTasks = state.tasks.filter((t) => !t.done)
  const doneTasks = state.tasks.filter((t) => t.done)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl bg-almendra-soft px-3 py-2 text-sm text-teja" role="alert">
          {error}
        </p>
      )}

      <Card title="Etiquetas">
        <div className="flex flex-wrap gap-1.5">
          {state.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">
              {t}
              <button type="button" onClick={() => toggleTag(t, false)} aria-label={`Quitar ${t}`} className="text-white/70 hover:text-white">
                <CloseIcon size={12} />
              </button>
            </span>
          ))}
          {state.tags.length === 0 && <span className="text-sm text-ash-ink">Sin etiquetas.</span>}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            toggleTag(tag, true)
            setTag('')
          }}
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={40}
            placeholder="Nueva etiqueta"
            aria-label="Nueva etiqueta"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong px-3 text-sm focus:border-ink focus:outline-none"
          />
          <Button type="submit" size="sm" variant="secondary">
            Añadir
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1">
          {SUGGESTED_TAGS.filter((t) => !state.tags.includes(t)).map((t) => (
            <button key={t} type="button" onClick={() => toggleTag(t, true)} className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-ash-ink hover:text-ink">
              + {t}
            </button>
          ))}
        </div>
      </Card>

      <Card title={`Tareas${openTasks.length ? ` (${openTasks.length})` : ''}`}>
        <form onSubmit={addTask} className="flex flex-wrap gap-2">
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            maxLength={200}
            placeholder="Ej.: llamarle para ofrecer la caja sorpresa"
            aria-label="Nueva tarea"
            className="h-9 min-w-0 flex-1 basis-48 rounded-lg border border-line-strong px-3 text-sm focus:border-ink focus:outline-none"
          />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fecha" className="h-9 rounded-lg border border-line-strong px-2 text-sm" />
          <Button type="submit" size="sm" disabled={pending}>
            Crear
          </Button>
        </form>
        <ul className="mt-4 space-y-2">
          {[...openTasks, ...doneTasks].map((t) => (
            <li key={t.id} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} aria-label={`Hecha: ${t.title}`} className="mt-0.5 size-4 accent-hoja-ink" />
              <span className={cn('min-w-0 flex-1', t.done && 'text-ash line-through')}>
                {t.title}
                {t.dueDate && !t.done && (
                  <span className={cn('ml-1.5 text-xs', t.dueDate < today ? 'font-semibold text-teja' : 'text-ash-ink')}>
                    · {t.dueDate < today ? 'vencida' : new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </span>
            </li>
          ))}
          {state.tasks.length === 0 && <li className="text-sm text-ash-ink">No hay tareas.</li>}
        </ul>
      </Card>

      <Card title="Notas">
        <form onSubmit={addNote}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Qué ha pasado: una llamada, un email, una queja, lo que le gusta…"
            aria-label="Nueva nota"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              Guardar nota
            </Button>
          </div>
        </form>
        <ul className="mt-4 space-y-3">
          {state.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-mist px-3 py-2.5 text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-xs text-ash-ink">
                {n.author} · {new Date(n.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </li>
          ))}
          {state.notes.length === 0 && <li className="text-sm text-ash-ink">Sin notas todavía.</li>}
        </ul>
      </Card>

      {demo && <p className="text-xs text-ash-ink">Vista previa: lo que añadas aquí se guarda solo en este navegador.</p>}
    </div>
  )
}
