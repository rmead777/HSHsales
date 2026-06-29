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
 * Refetches on window focus by default. Older requests are ignored if a newer one starts.
 *
 * `run` is intentionally stable. The caller's `deps` drive the effect that calls it.
 * The latest `fn` is read via a ref so inline functions do not go stale without
 * retriggering.
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
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  const run = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    if (mountedRef.current) {
      setLoading(true)
      setError(null)
    }
    try {
      const next = await fnRef.current()
      if (mountedRef.current && requestIdRef.current === requestId) {
        setData(next)
      }
    } catch (e) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setLoading(false)
      }
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
