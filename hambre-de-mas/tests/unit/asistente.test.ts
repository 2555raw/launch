import { describe, expect, it } from 'vitest'
import { FAQS, faqReply, matchFaq } from '@/lib/assistant/faq'

describe('asistente sin IA', () => {
  it('encuentra la pregunta frecuente por palabras clave, con o sin tildes', () => {
    expect(matchFaq('¿Cuánto tarda el envío a Mallorca?')?.id).toBe('envio')
    expect(matchFaq('quiero devolver un kit roto')?.id).toBe('devoluciones')
    expect(matchFaq('soy celiaco, ¿hay algo sin gluten?')?.id).toBe('alergenos')
    expect(matchFaq('Can I pay by card?')?.id).toBe('pago')
  })

  it('si no encaja ninguna, invita a escribir al email de la tienda', () => {
    expect(matchFaq('hola')).toBeNull()
    expect(faqReply('¿qué tiempo hace hoy?', 'es')).toContain('HambreDeMas@gmail.com')
    expect(faqReply('what is the weather like?', 'en')).toMatch(/^I'm not sure/)
  })

  it('todas las preguntas están en los dos idiomas', () => {
    for (const faq of FAQS) {
      expect(faq.question.es && faq.question.en && faq.answer.es && faq.answer.en).toBeTruthy()
    }
  })
})
