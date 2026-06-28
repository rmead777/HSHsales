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
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-white/48">{label}</span>
      {children}
      {error ? (
        <span className="mt-2 block text-xs font-semibold text-danger-400">{error}</span>
      ) : hint ? (
        <span className="mt-2 block text-xs leading-relaxed text-white/42">{hint}</span>
      ) : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-[8px] border border-white/12 bg-black/28 px-4 text-[0.95rem] text-white ' +
  'placeholder:text-white/28 outline-none transition-[border-color,background-color,box-shadow] duration-150 ' +
  'hover:border-white/20 focus-visible:border-demo-400 focus-visible:bg-black/38 focus-visible:ring-4 focus-visible:ring-demo-400/15'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'min-h-[88px] py-3 leading-relaxed', className)} {...props} />
}
