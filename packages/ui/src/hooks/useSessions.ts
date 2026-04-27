import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'
import type { Session } from '../lib/types.js'

type State =
  | { status: 'loading' }
  | { status: 'success'; sessions: Session[] }
  | { status: 'error'; message: string }

export function useSessions(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    api.sessions
      .list()
      .then((sessions) => setState({ status: 'success', sessions }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setState({ status: 'error', message })
      })
  }, [tick])

  const reload = useCallback(() => setTick(t => t + 1), [])

  return { ...state, reload }
}
