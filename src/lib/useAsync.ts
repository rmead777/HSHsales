import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncOptions {
  /** Refetch when the window regains focus (cheap freshness for gated config). Default true. */
  refetchOnFocus?: boolean
}

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Minimal data-loading hook. Pass the dependency values that should re-trigger the fetch.
 * Refetches on window focus by default — matches the spec's "fetch on load + on focus" rule.
 *
 * `run` is intentionally STABLE (empty deps). The caller's `deps` drive the *effect* that calls it,
 * NOT `run`'s identity — otherwise a fresh `[]` literal each render would recreate `run`, refire the
 * effect, setData, re-render… i.e. an infinite refetch loop. The latest `fn` is read via a ref so an
 * inline `fn` doesn't go stale without retriggering.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  opts: AsyncOptions = {},
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fnRef.current())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps])

  useEffect(() => {
    if (opts.refetchOnFocus === false) return
    const onFocus = () => void run()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [run, opts.refetchOnFocus])

  return { data, loading, error, reload: run }
}
