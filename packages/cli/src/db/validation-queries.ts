import type { DbClient } from '@keel/core'

export interface ForkScore {
  nodeId: string
  score: number
}

export interface ReplayScore {
  branchId: string
  avgScore: number
  nodeCount: number
}

export function getBranchForSession(db: DbClient, sessionId: string, branchId: string) {
  return db
    .prepare('SELECT * FROM branches WHERE session_id = ? AND id = ?')
    .get(sessionId, branchId) as Record<string, unknown> | undefined
}

export function getForkScore(db: DbClient, forkNodeId: string): ForkScore | null {
  const row = db
    .prepare('SELECT overall_score FROM quality_metrics WHERE node_id = ?')
    .get(forkNodeId) as { overall_score: number } | undefined

  if (!row) return null
  return { nodeId: forkNodeId, score: row.overall_score }
}

export function getReplayScore(db: DbClient, sessionId: string, branchId: string): ReplayScore | null {
  const nodes = db
    .prepare('SELECT id, quality_metrics_id FROM execution_nodes WHERE session_id = ? AND branch_id = ?')
    .all(sessionId, branchId) as Array<{ id: string; quality_metrics_id: string | null }>

  if (nodes.length === 0) return null

  const scores: number[] = []
  for (const node of nodes) {
    if (!node.quality_metrics_id) continue
    const m = db
      .prepare('SELECT overall_score FROM quality_metrics WHERE id = ?')
      .get(node.quality_metrics_id) as { overall_score: number } | undefined
    if (m) scores.push(m.overall_score)
  }

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  return { branchId, avgScore: Math.round(avgScore), nodeCount: nodes.length }
}

export function updateConstraintDelta(db: DbClient, constraintId: string, deltaScore: number): void {
  db.prepare('UPDATE constraints SET delta_score = ?, validated_at = ? WHERE id = ?')
    .run(deltaScore, Date.now(), constraintId)
}

export function parseConstraintIds(injectedConstraints: string): string[] {
  try {
    const parsed = JSON.parse(injectedConstraints) as Array<{ id: string }>
    return parsed.map((c) => c.id)
  } catch {
    return []
  }
}
