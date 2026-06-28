import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
  message: string | null
}

/** Catches render-time throws and shows a recoverable branded screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="glass-strong grid size-16 place-items-center rounded-[8px] text-danger-300">
          <AlertTriangle className="size-8" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-white">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/56">
            {this.state.message || 'An unexpected error occurred. Reloading usually fixes it.'}
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')}>Reload app</Button>
      </div>
    )
  }
}
