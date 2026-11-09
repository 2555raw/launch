'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/session'
import { isDemoMode } from '@/lib/catalog'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { emailSchema } from '@/lib/validation/schemas'

/**
 * Seguimiento de clientes en el CRM: notas, tareas y etiquetas. Solo para
 * administradores (y la base de datos lo vuelve a comprobar con RLS). En la
 * vista previa no hay base de datos: el CRM las guarda en el navegador.
 */

export type CrmActionResult = { ok: boolean; message?: string }

const noteSchema = z.object({ email: emailSchema, body: z.string().trim().min(1, 'Escribe la nota').max(2000) })
const taskSchema = z.object({
  email: emailSchema,
  title: z.string().trim().min(1, 'Escribe la tarea').max(200),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})
const tagSchema = z.object({ email: emailSchema, tag: z.string().trim().toLowerCase().min(1).max(40) })

async function guard(): Promise<{ author: string } | CrmActionResult> {
  if (isDemoMode()) return { ok: false, message: 'En la vista previa el seguimiento se guarda solo en este navegador.' }
  const { profile } = await requireAdmin('/crm')
  return { author: profile.fullName ?? profile.email ?? 'Equipo' }
}

async function done(error: { message: string } | null): Promise<CrmActionResult> {
  if (error) return { ok: false, message: 'No se ha podido guardar. Inténtalo de nuevo.' }
  revalidatePath('/crm', 'layout')
  return { ok: true }
}

export async function addCrmNote(input: { email: string; body: string }): Promise<CrmActionResult> {
  const who = await guard()
  if ('ok' in who) return who
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('crm_notes').insert({ email: parsed.data.email, body: parsed.data.body, author: who.author })
  return done(error)
}

export async function addCrmTask(input: { email: string; title: string; dueDate: string | null }): Promise<CrmActionResult> {
  const who = await guard()
  if ('ok' in who) return who
  const parsed = taskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('crm_tasks').insert({ email: parsed.data.email, title: parsed.data.title, due_date: parsed.data.dueDate })
  return done(error)
}

export async function setCrmTaskDone(input: { id: string; done: boolean }): Promise<CrmActionResult> {
  const who = await guard()
  if ('ok' in who) return who
  const parsed = z.object({ id: z.uuid(), done: z.boolean() }).safeParse(input)
  if (!parsed.success) return { ok: false }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('crm_tasks')
    .update({ done: parsed.data.done, done_at: parsed.data.done ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
  return done(error)
}

export async function setCrmTag(input: { email: string; tag: string; on: boolean }): Promise<CrmActionResult> {
  const who = await guard()
  if ('ok' in who) return who
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const supabase = await createSupabaseServerClient()
  const { error } = input.on
    ? await supabase.from('crm_tags').upsert({ email: parsed.data.email, tag: parsed.data.tag }, { onConflict: 'email,tag', ignoreDuplicates: true })
    : await supabase.from('crm_tags').delete().eq('email', parsed.data.email).eq('tag', parsed.data.tag)
  return done(error)
}
