'use client'

import { useEffect, useState } from 'react'

/**
 * Hora actual que se renueva cada `intervalMs` en el navegador. Devuelve null
 * en el servidor y en el primer render, así el HTML (que puede estar en caché
 * de otro día) no se da por bueno: al montar se recalcula con la hora real.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
