import type { DbClient } from '@keelcode/core'
import type { ArchViolation } from '@keelcode/core'
import type { NodeAnalysisRecord, FileViolations } from '@keelcode/analyzer'

interface RawFileMetrics {
  path: string
  violations?: ArchViolation[]
}

interface RawFileChange {
  path: string
  type: 'created' | 'modified' | 'deleted'
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const SELECT = `
  SELECT n.id AS node_id, n.type AS type, n.timestamp AS timestamp,
         n.branch_id AS branch_id, n.files_changed AS files_changed,
         q.files_analyzed AS files_analyzed
  FROM execution_nodes n
  LEFT JOIN quality_metrics q ON q.id = n.quality_metrics_id
`

// Builds the shared NodeAnalysisRecord[] the analyzer's insight functions
// consume, from the local .keel/keel.db. Pass a sessionId to scope to one
// session, or omit for the whole project history (used by `keel blame`).
export function loadAnalysisRecords(db: DbClient, sessionId?: string): NodeAnalysisRecord[] {
  const rows = (sessionId
    ? db.prepare(`${SELECT} WHERE n.session_id = ? ORDER BY n.timestamp ASC`).all(sessionId)
    : db.prepare(`${SELECT} ORDER BY n.timestamp ASC`).all()) as Record<string, unknown>[]

  return rows.map((row) => {
    const fileMetrics = safeParse<RawFileMetrics[]>(row['files_analyzed'], [])
    const filesChanged = safeParse<RawFileChange[]>(row['files_changed'], [])
    const files: FileViolations[] = fileMetrics.map((f) => ({
      path: f.path,
      violations: f.violations ?? [],
    }))

    return {
      nodeId: row['node_id'] as string,
      type: row['type'] as string,
      timestamp: row['timestamp'] as number,
      branchId: (row['branch_id'] as string) ?? 'main',
      filesChanged: filesChanged.map((c) => ({
        path: c.path,
        type: c.type,
        lineCountBefore: null,
        lineCountAfter: null,
      })),
      files,
    }
  })
}

// Most recent session id, or null if none recorded yet.
export function latestSessionId(db: DbClient): string | null {
  const row = db
    .prepare('SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1')
    .get() as { id?: string } | undefined
  return row?.id ?? null
}
