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

/** Catches render-time throws anywhere in the tree and shows a recovery screen instead of a
 *  white page. (Does not catch async/event errors — those are handled where they occur.) */
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
        <div className="grid size-16 place-items-center rounded-3xl bg-danger-50 text-danger-500 ring-1 ring-danger-100">
          <AlertTriangle className="size-8" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
            {this.state.message || 'An unexpected error occurred. Reloading usually fixes it.'}
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')}>Reload app</Button>
      </div>
    )
  }
}
