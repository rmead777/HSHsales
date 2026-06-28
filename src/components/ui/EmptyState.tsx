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
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200/80 bg-white/40 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-slate-900/[0.04] text-slate-400">
        <Icon className="size-7" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold tracking-[-0.01em] text-slate-700">{title}</h3>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
