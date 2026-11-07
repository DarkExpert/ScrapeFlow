import { useEffect, useState } from 'react'

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, keys: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    load(controller.signal).then((value) => {
      if (!controller.signal.aborted) setData(value)
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setData(null)
        setError(reason instanceof Error ? reason.message : 'Unexpected request failure')
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
    // Dependency changes intentionally trigger an abort and a fresh request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys)

  return { data, error, loading }
}

