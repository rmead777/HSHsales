import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'primary' | 'money' | 'demo' | 'warn' | 'danger' | 'neutral'

const tones: Record<Tone, string> = {
  primary: 'bg-primary-500/18 text-primary-100 ring-primary-300/30',
  money: 'bg-money-400/16 text-money-100 ring-money-300/28',
  demo: 'bg-demo-400/16 text-demo-100 ring-demo-300/30',
  warn: 'bg-warn-400/16 text-warn-100 ring-warn-400/26',
  danger: 'bg-danger-500/16 text-danger-100 ring-danger-400/30',
  neutral: 'bg-white/[0.07] text-white/68 ring-white/12',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-[0.02em] ring-1 ring-inset [&_svg]:-mt-px',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
