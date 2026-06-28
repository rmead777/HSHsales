import { motion } from 'motion/react'
import { Spinner } from './ui/Spinner'

/** Full-viewport branded loader for auth bootstrap + route suspense. Transform/opacity only. */
export function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <motion.div
        className="glass-strong grid size-16 place-items-center rounded-3xl"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Spinner className="size-7 text-primary-500" />
      </motion.div>
      <p className="text-sm font-medium text-slate-400">{label}…</p>
    </div>
  )
}
