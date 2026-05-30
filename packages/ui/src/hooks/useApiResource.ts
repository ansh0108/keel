import { useState, useEffect } from 'react'

export type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

// Generic single-fetch resource hook. Re-fetches whenever `key` changes; a null
// key resets to idle (nothing selected). Guards against setting state after the
// key has moved on, so a slow response never clobbers a newer one.
export function useApiResource<T>(
  key: string | null,
  fetcher: (key: string) => Promise<T>,
): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'idle' })

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle' })
      return
    }

    let active = true
    setState({ status: 'loading' })

    fetcher(key)
      .then((data) => { if (active) setState({ status: 'success', data }) })
      .catch((err: unknown) => {
        if (!active) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      })

    return () => { active = false }
  }, [key, fetcher])

  return state
}
