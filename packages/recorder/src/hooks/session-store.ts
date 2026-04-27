import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface ActiveSession {
  sessionId: string
  lastNodeId: string | null
  branchId: string
}

interface PendingBranch {
  branchId: string
}

export function loadActiveSession(statePath: string): ActiveSession | null {
  if (!existsSync(statePath)) return null
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as ActiveSession
  } catch {
    return null
  }
}

export function saveActiveSession(statePath: string, session: ActiveSession): void {
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(session), 'utf-8')
}

// Checks for a pending replay branch written by the server's replay endpoint.
// Consumes it (deletes the file) so only the first new session picks it up.
export function consumePendingBranch(keelDir: string): string | null {
  const pendingPath = join(keelDir, 'pending-branch.json')
  if (!existsSync(pendingPath)) return null
  try {
    const { branchId } = JSON.parse(readFileSync(pendingPath, 'utf-8')) as PendingBranch
    rmSync(pendingPath)
    return branchId
  } catch {
    return null
  }
}

export function createActiveSession(keelDir: string): ActiveSession {
  const branchId = consumePendingBranch(keelDir) ?? 'main'
  return {
    sessionId: randomUUID(),
    lastNodeId: null,
    branchId,
  }
}

export function advanceSession(session: ActiveSession, newNodeId: string): ActiveSession {
  return { ...session, lastNodeId: newNodeId }
}
