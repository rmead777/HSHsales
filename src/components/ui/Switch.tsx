import { motion } from 'motion/react'
import { springs } from '../../lib/motion'
import { cn } from '../../lib/cn'

/** High-trust on/off control (rep activation, content visibility) → functional motion, no bounce. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-11 w-14 shrink-0 rounded-full border transition-colors',
        checked ? 'border-money-300/60 bg-money-400 shadow-[0_0_22px_rgba(0,201,139,0.28)]' : 'border-white/12 bg-white/14',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <motion.span
        layout
        transition={springs.microFunctional}
        className={cn(
          'absolute top-1.5 size-8 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.3)]',
          checked ? 'right-1.5' : 'left-1.5',
        )}
      />
    </button>
  )
}
