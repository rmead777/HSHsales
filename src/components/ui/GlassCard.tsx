import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  strong?: boolean
}

/** Frosted-glass surface that floats over the aurora. `strong` = more opaque + bigger lift. */
export function GlassCard({ strong, className, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(strong ? 'glass-strong' : 'glass', 'glass-hi rounded-3xl', className)}
      {...props}
    />
  )
}
