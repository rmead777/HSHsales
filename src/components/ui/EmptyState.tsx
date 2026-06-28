import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Empty states are onboarding moments — always a glyph + a next step, never just "No items". */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="cabinet-panel scanline-mask flex flex-col items-center justify-center rounded-[8px] border border-dashed border-white/14 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-[8px] bg-white/[0.08] text-demo-300 ring-1 ring-white/10">
        <Icon className="size-7" />
      </div>
      <h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.01em] text-white">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/52">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
