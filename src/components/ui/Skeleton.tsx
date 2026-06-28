import { cn } from '../../lib/cn'

/** Shimmering placeholder. Compose these to match the *actual* content geometry —
 *  never a single generic rectangle. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}
