import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'
import { springs } from '../../lib/motion'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'money' | 'demo' | 'danger' | 'subtle' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

// Filled variants carry an accent-tinted shadow (never gray) so the CTA feels lifted.
const variants: Record<Variant, string> = {
  primary: 'bg-primary-500 text-white shadow-[0_10px_28px_-10px_rgba(47,107,255,0.65)] hover:bg-primary-600',
  money: 'bg-money-500 text-white shadow-[0_10px_28px_-10px_rgba(16,185,129,0.6)] hover:bg-money-600',
  demo: 'bg-demo-500 text-white shadow-[0_10px_28px_-10px_rgba(6,182,212,0.55)] hover:bg-demo-600',
  danger: 'bg-danger-500 text-white shadow-[0_10px_28px_-10px_rgba(244,63,94,0.55)] hover:bg-danger-600',
  subtle: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  outline: 'border border-slate-200/80 bg-white/55 text-slate-700 hover:bg-white/80',
  ghost: 'text-slate-600 hover:bg-slate-900/[0.06]',
}

// md = 44px (the iOS minimum touch target); lg = 56px for primary field actions.
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[0.95rem] gap-2 rounded-2xl',
  lg: 'h-14 px-5 text-base gap-2.5 rounded-2xl',
}

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={springs.press}
      className={cn(
        'relative inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em]',
        'transition-colors duration-150 will-change-transform',
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </motion.button>
  )
}
