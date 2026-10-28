'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/ui/icons'
import { FAQS } from '@/lib/assistant/faq'
import { cn } from '@/lib/cn'
import { company } from '@/lib/config/site'
import { useI18n } from '@/lib/i18n/client'

const ease = [0.28, 0.11, 0.32, 1] as const

type View = 'home' | 'chat' | 'help'
type Message = { role: 'user' | 'assistant'; content: string }

const ChatIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.5-4.3A7.5 7.5 0 1 1 20 11.5Z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.4} />
  </svg>
)

const HomeIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m4 10.5 8-6.5 8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
  </svg>
)

const HelpIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 16.8h.01" />
  </svg>
)

const MailIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </svg>
)

const SendIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
)

/** Convierte en enlaces las rutas de la tienda y el email que aparezcan en una respuesta. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\/(?:producto|categoria|legal|cuenta|tienda|contacto|buscar)(?:\/[\w-]+)*|[\w.+-]+@[\w-]+\.[\w.]+)/g)
  return parts.map((part, i) => {
    if (i % 2 === 0) return part
    const isEmail = part.includes('@')
    const clean = part.replace(/\.$/, '')
    return isEmail ? (
      <a key={i} href={`mailto:${clean}`} className="font-medium underline underline-offset-2">
        {part}
      </a>
    ) : (
      <Link key={i} href={clean} className="font-medium underline underline-offset-2">
        {part}
      </Link>
    )
  })
}

function Avatar({ size = 36 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-line" style={{ width: size, height: size }}>
      <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="h-[70%] w-auto" />
    </span>
  )
}

/**
 * Botón de ayuda flotante (abajo a la derecha) con un panel: inicio,
 * chat con el asistente de IA, preguntas frecuentes y email de atención al
 * cliente. La conversación vive en memoria mientras navegas; no se guarda.
 */
export function HelpWidget() {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [view, setView] = useState<View>('home')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState('')
  const launcherRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const email = company.email

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      launcherRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => {
    if (open && view === 'chat') inputRef.current?.focus()
  }, [open, view])

  const toggle = () => {
    setOpen((o) => !o)
    setSeen(true)
  }

  const ask = async (question: string) => {
    const content = question.trim()
    if (!content || pending) return
    const history = [...messages, { role: 'user' as const, content }]
    setMessages(history)
    setDraft('')
    setView('chat')
    setPending(true)
    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20) }),
      })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string }
      const reply =
        data.reply ??
        data.error ??
        t({ es: `Ahora mismo no puedo responder. Escríbenos a ${email}.`, en: `I can't answer right now. Write to us at ${email}.` })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: t({ es: 'No hay conexión. Prueba otra vez en un momento.', en: 'No connection. Try again in a moment.' }) },
      ])
    } finally {
      setPending(false)
    }
  }

  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const faqs = normalized
    ? FAQS.filter((f) =>
        `${f.question[locale]} ${f.answer[locale]} ${f.keywords.join(' ')}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .includes(normalized),
      )
    : FAQS

  const EmailCard = (
    <a
      href={`mailto:${email}`}
      className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgb(0_0_0/0.06)] ring-1 ring-line transition-colors hover:bg-mist"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-almendra text-teja">
        <MailIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t({ es: 'Escríbenos un email', en: 'Send us an email' })}</span>
        <span className="block truncate text-[13px] text-ash-ink">{email}</span>
      </span>
      <ChevronRightIcon size={18} className="text-chef" />
    </a>
  )

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            id="panel-ayuda"
            role="dialog"
            aria-label={t({ es: 'Ayuda', en: 'Help' })}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed inset-x-3 top-3 bottom-[88px] z-[60] flex flex-col overflow-hidden rounded-[28px] bg-mist shadow-[0_24px_80px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5 sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-24 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[392px]"
          >
            {view === 'home' && (
              <div className="flex-1 overflow-y-auto">
                <div className="relative overflow-hidden bg-[#141110] px-6 pt-7 pb-24 text-white">
                  <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-chef/50 blur-3xl" />
                  <div aria-hidden className="absolute -bottom-28 -left-10 size-60 rounded-full bg-teja/40 blur-3xl" />
                  <div className="relative flex items-center justify-between">
                    <Avatar size={40} />
                    <button
                      type="button"
                      onClick={toggle}
                      className="grid size-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={t({ es: 'Cerrar ayuda', en: 'Close help' })}
                    >
                      <ChevronDownIcon size={20} />
                    </button>
                  </div>
                  <p className="relative mt-10 font-display text-[28px] leading-tight font-bold text-white/55">{t({ es: 'Hola 👋', en: 'Hi there 👋' })}</p>
                  <p className="relative font-display text-[28px] leading-tight font-bold">{t({ es: '¿Cómo podemos ayudarte?', en: 'How can we help?' })}</p>
                </div>

                <div className="relative -mt-16 space-y-3 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => setView('chat')}
                    className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-[0_2px_12px_rgb(0_0_0/0.06)] ring-1 ring-line transition-colors hover:bg-mist"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{t({ es: 'Pregúntale a nuestro asistente', en: 'Ask our assistant' })}</span>
                      <span className="block text-[13px] text-ash-ink">{t({ es: 'Te responde al momento, 24 h', en: 'Instant answers, 24/7' })}</span>
                    </span>
                    <span className="grid size-10 place-items-center rounded-full bg-chef text-white">
                      <SendIcon />
                    </span>
                  </button>

                  <div className="rounded-2xl bg-white p-2 shadow-[0_2px_12px_rgb(0_0_0/0.06)] ring-1 ring-line">
                    <button
                      type="button"
                      onClick={() => setView('help')}
                      className="flex w-full items-center justify-between rounded-xl bg-mist px-4 py-3 text-left text-[15px] font-semibold"
                    >
                      {t({ es: 'Buscar ayuda', en: 'Search for help' })}
                      <SearchIcon size={18} className="text-chef" />
                    </button>
                    <ul className="mt-1">
                      {FAQS.slice(0, 4).map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => ask(f.question[locale])}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-[14px] text-ink/80 transition-colors hover:bg-mist"
                          >
                            {f.question[locale]}
                            <ChevronRightIcon size={16} className="shrink-0 text-chef" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {EmailCard}
                </div>
              </div>
            )}

            {view === 'chat' && (
              <div className="flex min-h-0 flex-1 flex-col bg-white">
                <div className="flex items-center gap-3 border-b border-line px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setView('home')}
                    className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-mist"
                    aria-label={t({ es: 'Volver', en: 'Back' })}
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                  <Avatar />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{t({ es: 'Asistente de Hambre de Más', en: 'Hambre de Más assistant' })}</p>
                    <p className="flex items-center gap-1.5 text-[12px] text-ash-ink">
                      <span className="size-1.5 rounded-full bg-hoja" /> {t({ es: 'Responde al momento · IA', en: 'Replies instantly · AI' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggle}
                    className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-mist"
                    aria-label={t({ es: 'Cerrar ayuda', en: 'Close help' })}
                  >
                    <ChevronDownIcon size={20} />
                  </button>
                </div>

                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
                  <div className="flex items-end gap-2">
                    <Avatar size={28} />
                    <p className="max-w-[80%] rounded-[20px] rounded-bl-md bg-mist px-4 py-2.5 text-[15px] leading-snug">
                      {t({
                        es: '¡Hola! Soy el asistente de Hambre de Más. Pregúntame por los kits, los niveles, los envíos o tu pedido.',
                        en: "Hi! I'm the Hambre de Más assistant. Ask me about kits, levels, shipping or your order.",
                      })}
                    </p>
                  </div>
                  {messages.map((m, i) =>
                    m.role === 'user' ? (
                      <p key={i} className="ml-auto w-fit max-w-[80%] rounded-[20px] rounded-br-md bg-chef px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line text-white">
                        {m.content}
                      </p>
                    ) : (
                      <div key={i} className="flex items-end gap-2">
                        <Avatar size={28} />
                        <p className="max-w-[80%] rounded-[20px] rounded-bl-md bg-mist px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line">
                          <RichText text={m.content} />
                        </p>
                      </div>
                    ),
                  )}
                  {pending && (
                    <div className="flex items-end gap-2">
                      <Avatar size={28} />
                      <p className="flex gap-1 rounded-[20px] rounded-bl-md bg-mist px-4 py-3.5" aria-label={t({ es: 'Escribiendo…', en: 'Typing…' })}>
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="typing-dot size-1.5 rounded-full bg-ash" style={{ animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </p>
                    </div>
                  )}
                  {messages.length === 0 && (
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      {FAQS.slice(0, 3).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => ask(f.question[locale])}
                          className="rounded-full px-3.5 py-2 text-[13px] font-medium text-chef ring-1 ring-chef/40 transition-colors hover:bg-chef/5"
                        >
                          {f.question[locale]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form
                  className="border-t border-line p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    ask(draft)
                  }}
                >
                  <div className="flex items-end gap-2 rounded-[22px] bg-mist py-1.5 pr-1.5 pl-4 ring-1 ring-transparent focus-within:ring-line-strong">
                    <label htmlFor="pregunta-asistente" className="sr-only">
                      {t({ es: 'Tu pregunta', en: 'Your question' })}
                    </label>
                    <textarea
                      id="pregunta-asistente"
                      ref={inputRef}
                      rows={1}
                      maxLength={1000}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          ask(draft)
                        }
                      }}
                      placeholder={t({ es: 'Escribe tu pregunta…', en: 'Type your question…' })}
                      className="max-h-28 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-ash"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || pending}
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-chef text-white transition-opacity disabled:opacity-30"
                      aria-label={t({ es: 'Enviar', en: 'Send' })}
                    >
                      <SendIcon size={16} />
                    </button>
                  </div>
                  <p className="mt-2 px-1 text-center text-[11px] leading-snug text-ash">
                    {t({ es: 'Respuestas generadas con IA; pueden tener errores. ¿Prefieres a una persona? ', en: 'AI-generated answers may contain mistakes. Prefer a person? ' })}
                    <a href={`mailto:${email}`} className="text-teja hover:underline">
                      {email}
                    </a>
                  </p>
                </form>
              </div>
            )}

            {view === 'help' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-3 bg-white px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setView('home')}
                    className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-mist"
                    aria-label={t({ es: 'Volver', en: 'Back' })}
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                  <p className="flex-1 text-center text-[15px] font-semibold">{t({ es: 'Ayuda', en: 'Help' })}</p>
                  <button
                    type="button"
                    onClick={toggle}
                    className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-mist"
                    aria-label={t({ es: 'Cerrar ayuda', en: 'Close help' })}
                  >
                    <ChevronDownIcon size={20} />
                  </button>
                </div>
                <div className="bg-white px-4 pb-3">
                  <label className="flex items-center gap-2 rounded-xl bg-mist px-4 py-2.5">
                    <SearchIcon size={18} className="text-ash" />
                    <span className="sr-only">{t({ es: 'Buscar ayuda', en: 'Search for help' })}</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t({ es: 'Buscar ayuda', en: 'Search for help' })}
                      className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ash"
                    />
                  </label>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                    {faqs.map((f) => (
                      <li key={f.id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                            {f.question[locale]}
                            <ChevronDownIcon size={16} className="shrink-0 text-chef transition-transform group-open:rotate-180" />
                          </summary>
                          <p className="px-4 pb-4 text-[14px] leading-relaxed text-ash-ink">
                            <RichText text={f.answer[locale]} />
                          </p>
                        </details>
                      </li>
                    ))}
                    {faqs.length === 0 && (
                      <li className="px-4 py-6 text-center text-[14px] text-ash-ink">
                        {t({ es: 'No hay resultados. ', en: 'No results. ' })}
                        <button type="button" onClick={() => ask(query)} className="font-medium text-chef hover:underline">
                          {t({ es: 'Pregúntaselo al asistente', en: 'Ask the assistant' })}
                        </button>
                      </li>
                    )}
                  </ul>
                  {EmailCard}
                </div>
              </div>
            )}

            <nav className="grid grid-cols-3 border-t border-line bg-white" aria-label={t({ es: 'Secciones de ayuda', en: 'Help sections' })}>
              {(
                [
                  ['home', t({ es: 'Inicio', en: 'Home' }), HomeIcon],
                  ['chat', t({ es: 'Mensajes', en: 'Messages' }), ChatIcon],
                  ['help', t({ es: 'Ayuda', en: 'Help' }), HelpIcon],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-current={view === key ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 text-[12px] font-medium transition-colors',
                    view === key ? 'text-chef' : 'text-ash-ink hover:text-ink',
                  )}
                >
                  <Icon size={22} />
                  {label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={launcherRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="panel-ayuda"
        aria-label={open ? t({ es: 'Cerrar ayuda', en: 'Close help' }) : t({ es: '¿Necesitas ayuda?', en: 'Need help?' })}
        data-help-launcher
        className="fixed right-4 bottom-4 z-[60] grid size-14 place-items-center rounded-full bg-chef text-white shadow-[0_12px_32px_-6px_rgb(230_58_46/0.6)] transition-transform hover:scale-105 active:scale-95 sm:right-5 sm:bottom-5"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={open ? 'cerrar' : 'abrir'}
            initial={{ rotate: -45, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 45, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {open ? <ChevronDownIcon size={26} /> : <ChatIcon size={26} />}
          </motion.span>
        </AnimatePresence>
        {!seen && <span aria-hidden className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-hoja ring-[2.5px] ring-white" />}
      </button>
    </>
  )
}
