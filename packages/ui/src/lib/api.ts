import type { Session, SessionGraph } from './types.js'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

interface ReplayResponse { branchId: string; message: string }
interface AutofixResponse { fixed: boolean; linesRemoved?: number; message: string }
interface RescanResponse { sessionId: string; filesScanned: number }

export const api = {
  sessions: {
    list: () => get<Session[]>('/sessions'),
    graph: (id: string) => get<SessionGraph>(`/sessions/${id}/graph`),
  },
  replay: (sessionId: string, nodeId: string, body: { rule: string; prompt: string }) =>
    post<ReplayResponse>(`/sessions/${sessionId}/nodes/${nodeId}/replay`, body),
  autofix: (sessionId: string, nodeId: string, body: { filePath: string; violationType: string }) =>
    post<AutofixResponse>(`/sessions/${sessionId}/nodes/${nodeId}/autofix`, body),
  rescan: () => post<RescanResponse>('/rescan', {}),
}
