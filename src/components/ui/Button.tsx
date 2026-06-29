import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'
import { springs } from '../../lib/motion'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'money' | 'demo' | 'danger' | 'subtle' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

// Filled variants carry accent-tinted shadows so CTAs feel lifted, never default.
const variants: Record<Variant, string> = {
  primary:
    'bg-primary-500 text-white shadow-[0_12px_32px_-14px_rgba(75,34,255,0.9)] hover:bg-primary-400',
  money:
    'bg-money-500 text-[#03110c] shadow-[0_12px_32px_-14px_rgba(0,201,139,0.9)] hover:bg-money-400',
  demo:
    'bg-demo-400 text-[#031014] shadow-[0_12px_32px_-14px_rgba(46,234,255,0.9)] hover:bg-demo-300',
  danger:
    'bg-danger-500 text-white shadow-[0_12px_32px_-14px_rgba(255,36,72,0.85)] hover:bg-danger-400',
  subtle:
    'border border-white/10 bg-white/[0.08] text-white shadow-[0_10px_24px_-18px_rgba(46,234,255,0.75)] hover:bg-white/[0.13]',
  outline:
    'border border-white/15 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-demo-400/45 hover:bg-demo-400/10',
  ghost: 'text-white/72 hover:bg-white/[0.08] hover:text-white',
}

// sm/md are 44px+ so every visible action clears mobile touch-target minimums.
const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-sm gap-1.5 rounded-[8px]',
  md: 'h-11 px-4 text-[0.95rem] gap-2 rounded-[8px]',
  lg: 'h-14 px-5 text-base gap-2.5 rounded-[8px]',
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
        'relative inline-flex select-none items-center justify-center font-bold tracking-[0.01em]',
        'transition-colors duration-150 will-change-transform [&_svg]:-mt-px [&_svg]:shrink-0',
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
