import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { SessionGraph } from '../lib/types.js'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: SessionGraph }
  | { status: 'error'; message: string }

export function useSessionGraph(sessionId: string | null): State {
  const [state, setState] = useState<State>({ status: 'idle' })

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading' })

    api.sessions
      .graph(sessionId)
      .then((data) => setState({ status: 'success', data }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setState({ status: 'error', message })
      })
  }, [sessionId])

  return state
}
