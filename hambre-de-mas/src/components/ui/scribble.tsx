'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * Trazos de rotulador hechos a mano: subrayado, círculo y flecha. Se dibujan
 * solos la primera vez que aparecen en pantalla (sin animación si el usuario
 * pide reducir el movimiento: MotionProvider).
 */
const shapes = {
  underline: { viewBox: '0 0 300 24', paths: ['M4 15 C 70 6, 170 4, 296 11', 'M28 20 C 110 13, 200 12, 270 16'] },
  circle: { viewBox: '0 0 220 90', paths: ['M160 10 C 70 -4, 6 20, 10 48 C 14 76, 130 88, 192 66 C 222 54, 214 18, 150 9 C 128 6, 100 8, 78 14'] },
  arrow: { viewBox: '0 0 90 70', paths: ['M8 10 C 34 2, 66 18, 72 56', 'M56 46 L 72 58 L 80 40'] },
} as const

export function Scribble({ shape, className, delay = 0.2 }: { shape: keyof typeof shapes; className?: string; delay?: number }) {
  const { viewBox, paths } = shapes[shape]
  return (
    <svg aria-hidden viewBox={viewBox} fill="none" preserveAspectRatio="none" className={cn('pointer-events-none overflow-visible', className)}>
      {paths.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={shape === 'circle' ? 3.5 : 4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ pathLength: { duration: 0.7, delay: delay + i * 0.35, ease: 'easeInOut' }, opacity: { duration: 0.1, delay: delay + i * 0.35 } }}
        />
      ))}
    </svg>
  )
}

/** Nota escrita a mano, ligeramente torcida, con flecha opcional. */
export function HandNote({
  children,
  arrow,
  className,
}: {
  children: React.ReactNode
  /** Hacia dónde apunta la flecha, si la hay. */
  arrow?: 'down-left' | 'down-right'
  className?: string
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6, rotate: -6 }}
      whileInView={{ opacity: 1, y: 0, rotate: -4 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className={cn('pointer-events-none inline-flex items-end gap-1 font-[family-name:var(--font-hand)] text-[26px] leading-none font-bold text-chef', className)}
    >
      {arrow === 'down-left' && <Scribble shape="arrow" delay={0.7} className="mb-[-26px] h-10 w-12 -scale-x-100" />}
      {children}
      {arrow === 'down-right' && <Scribble shape="arrow" delay={0.7} className="mb-[-26px] h-10 w-12" />}
    </motion.span>
  )
}
