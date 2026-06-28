import type { ReactNode } from 'react'

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-medium text-white/52">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
