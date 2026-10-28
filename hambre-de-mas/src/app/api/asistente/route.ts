import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { faqReply } from '@/lib/assistant/faq'
import { assistantSystemPrompt } from '@/lib/assistant/prompt'
import { company } from '@/lib/config/site'
import { serverEnv } from '@/lib/env'
import { getI18n } from '@/lib/i18n/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(20)
    .refine((m) => m.at(-1)?.role === 'user'),
})

let client: Anthropic | null = null

/**
 * Asistente de ayuda del panel flotante. Con ANTHROPIC_API_KEY responde con
 * Claude a partir de los datos de la tienda; sin ella, con la pregunta
 * frecuente que mejor encaje. Las conversaciones no se guardan.
 */
export async function POST(request: NextRequest) {
  const { locale, t } = await getI18n()
  if (!rateLimit(`assistant:${clientIp(request.headers)}`, 15, 60_000)) {
    return NextResponse.json(
      { error: t({ es: 'Vas muy rápido. Espera un momento y vuelve a preguntar.', en: "You're going a bit fast. Wait a moment and ask again." }) },
      { status: 429 },
    )
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: t({ es: 'No he entendido la pregunta.', en: "I didn't understand the question." }) }, { status: 400 })
  }
  const messages = parsed.data.messages
  const question = messages.at(-1)!.content
  const headers = { 'Cache-Control': 'no-store' }

  const apiKey = serverEnv.anthropicApiKey()
  if (!apiKey) return NextResponse.json({ reply: faqReply(question, locale), source: 'faq' }, { headers })

  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 30_000 })
  const unavailable = t({
    es: `Ahora mismo no puedo responder. Escríbenos a ${company.email} y te ayudamos.`,
    en: `I can't answer right now. Write to us at ${company.email} and we'll help you.`,
  })

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      // Si el modelo declina una petición, la API la reintenta con el modelo de respaldo recomendado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: await assistantSystemPrompt(locale), cache_control: { type: 'ephemeral' } }],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        {
          reply: t({
            es: `Con eso no te puedo ayudar. Si es sobre tu pedido o un kit, escríbenos a ${company.email}.`,
            en: `I can't help with that one. If it's about your order or a kit, write to us at ${company.email}.`,
          }),
          source: 'ai',
        },
        { headers },
      )
    }
    const reply = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim()
    return NextResponse.json({ reply: reply || unavailable, source: 'ai' }, { headers })
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`[asistente] ${error.status ?? ''} ${error.name}`)
    else console.error('[asistente]', error)
    return NextResponse.json({ reply: unavailable, source: 'error' }, { headers })
  }
}
