import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'primary' | 'money' | 'demo' | 'warn' | 'danger' | 'neutral'

const tones: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
  money: 'bg-money-50 text-money-700 ring-money-100',
  demo: 'bg-demo-50 text-demo-600 ring-demo-100',
  warn: 'bg-warn-50 text-warn-600 ring-warn-100',
  danger: 'bg-danger-50 text-danger-600 ring-danger-100',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
