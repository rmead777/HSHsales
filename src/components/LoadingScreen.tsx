import { motion } from 'motion/react'
import { BrandMark } from './BrandMark'
import { Spinner } from './ui/Spinner'

/** Full-viewport branded loader for auth bootstrap + route suspense. */
export function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
      <motion.div
        className="glass-strong grid size-20 place-items-center rounded-[8px]"
        animate={{ opacity: [0.86, 1, 0.86], scale: [1, 1.025, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      >
        <BrandMark className="size-12" />
      </motion.div>
      <div className="flex items-center gap-2 text-sm font-bold text-white/52">
        <Spinner className="size-4 text-demo-300" />
        <span>{label}...</span>
      </div>
    </div>
  )
}
