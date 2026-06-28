import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { springs, exitTween } from '../../lib/motion'

/**
 * Bottom sheet on mobile, centered dialog on >=sm. Choreographed: scrim fades first,
 * the surface follows by 40ms (functional spring, bounce 0). Esc + scrim-click close;
 * body scroll locked while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-slate-900/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitTween }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-4xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-4xl sm:pb-6"
            initial={{ opacity: 0, y: 48, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springs.standardFunctional, delay: 0.04 } }}
            exit={{ opacity: 0, y: 28, transition: exitTween }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300/80 sm:hidden" />
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-slate-900">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
