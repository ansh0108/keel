import type { DbClient } from '@keelcode/core'
import type { ArchViolation } from '@keelcode/core'
import type { NodeAnalysisRecord, FileViolations } from '@keelcode/analyzer'

interface RawFileMetrics {
  path: string
  violations?: ArchViolation[]
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// Builds the analyzer's NodeAnalysisRecord[] for a session from execution_nodes
// joined with their quality_metrics, time-ordered. Mirrors the CLI loader but
// over the server's request-scoped DbClient.
export function loadSessionRecords(db: DbClient, sessionId: string): NodeAnalysisRecord[] {
  const rows = db
    .prepare(
      `SELECT n.id AS node_id, n.type AS type, n.timestamp AS timestamp,
              n.branch_id AS branch_id, n.files_changed AS files_changed,
              q.files_analyzed AS files_analyzed
       FROM execution_nodes n
       LEFT JOIN quality_metrics q ON q.id = n.quality_metrics_id
       WHERE n.session_id = ?
       ORDER BY n.timestamp ASC`,
    )
    .all(sessionId) as Record<string, unknown>[]

  return rows.map((row) => {
    const fileMetrics = safeParse<RawFileMetrics[]>(row['files_analyzed'], [])
    const files: FileViolations[] = fileMetrics.map((f) => ({
      path: f.path,
      violations: f.violations ?? [],
    }))

    return {
      nodeId: row['node_id'] as string,
      type: row['type'] as string,
      timestamp: row['timestamp'] as number,
      branchId: (row['branch_id'] as string) ?? 'main',
      filesChanged: [],
      files,
    }
  })
}
