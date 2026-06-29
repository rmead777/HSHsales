import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

export function LoadError({
  title = 'Could not load this panel',
  message,
  onRetry,
}: {
  title?: string
  message?: string | null
  onRetry?: () => void
}) {
  return (
    <div className="cabinet-panel scanline-mask flex flex-col items-center justify-center rounded-[8px] border border-danger-400/24 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-[8px] bg-danger-500/12 text-danger-300 ring-1 ring-danger-400/24">
        <AlertTriangle className="size-7" />
      </div>
      <h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.01em] text-white">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/52">
        {message ?? 'Refresh the panel. If it keeps failing, check your connection or app permissions.'}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-5">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      )}
    </div>
  )
}
