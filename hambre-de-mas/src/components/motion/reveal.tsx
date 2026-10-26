'use client'
import { motion, type HTMLMotionProps } from 'framer-motion'

/**
 * Aparición suave al entrar en pantalla. Con prefers-reduced-motion la
 * MotionConfig global (reducedMotion="user") elimina el desplazamiento.
 */
export function Reveal({ delay = 0, y = 24, ...props }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.28, 0.11, 0.32, 1] }}
      {...props}
    />
  )
}

/** Igual que Reveal pero como elemento de lista, para no romper <ul>/<ol>. */
export function RevealLi({ delay = 0, y = 24, ...props }: HTMLMotionProps<'li'> & { delay?: number; y?: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.28, 0.11, 0.32, 1] }}
      {...props}
    />
  )
}
