import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  strong?: boolean
}

/** Cabinet-glass surface. `strong` = more opaque + stronger arcade-cabinet lift. */
export function GlassCard({ strong, className, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(strong ? 'glass-strong' : 'glass', 'glass-hi rounded-[8px]', className)}
      {...props}
    />
  )
}
