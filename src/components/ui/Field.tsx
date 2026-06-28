import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-danger-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-[0.95rem] text-slate-900 ' +
  'placeholder:text-slate-400 outline-none transition ' +
  'focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-500/15'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'min-h-[88px] py-3 leading-relaxed', className)} {...props} />
}
