import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { springs, exitTween } from '../../lib/motion'

type Tone = 'success' | 'info' | 'error'
interface ToastItem {
  id: number
  message: string
  tone: Tone
}
interface ToastApi {
  show: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastApi | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const toneConfig: Record<Tone, { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: 'text-money-600' },
  info: { icon: Info, accent: 'text-primary-600' },
  error: { icon: XCircle, accent: 'text-danger-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {toasts.map((t) => {
            const cfg = toneConfig[t.tone]
            const Icon = cfg.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: springs.standardExpressive }}
                exit={{ opacity: 0, y: 10, scale: 0.98, transition: exitTween }}
                className="glass-strong pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800"
              >
                <Icon className={cn('size-5 shrink-0', cfg.accent)} />
                <span>{t.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
