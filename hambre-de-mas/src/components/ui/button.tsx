import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'link'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--ease-apple)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45'

const variants: Record<Variant, string> = {
  primary: 'bg-chef-ink text-white hover:bg-teja shadow-[0_1px_0_rgb(0_0_0/0.04)]',
  dark: 'bg-ink text-white hover:bg-black',
  secondary: 'bg-white text-ink ring-1 ring-inset ring-line-strong hover:ring-ink/40 hover:bg-mist',
  ghost: 'text-ink hover:bg-mist',
  link: 'text-teja hover:underline underline-offset-4 !px-0 !h-auto active:scale-100',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-full',
  md: 'h-11 px-6 text-[15px] rounded-full',
  lg: 'h-13 px-8 text-[17px] rounded-full',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
