import { randomUUID } from 'node:crypto'
import type { DbClient } from '@keel/core'

export interface ReplayInput {
  sessionId: string
  forkNodeId: string
  rule: string
  prompt: string
  projectId: string
}

export interface ReplayResult {
  branchId: string
  constraintId: string
}

export function createReplay(db: DbClient, input: ReplayInput): ReplayResult {
  const branchId = randomUUID()
  const constraintId = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO constraints (id, project_id, rule, prompt, validated_at, delta_score)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(constraintId, input.projectId, input.rule, input.prompt, now)

  const injectedConstraints = JSON.stringify([{ id: constraintId, rule: input.rule, prompt: input.prompt }])

  db.prepare(`
    INSERT INTO branches (id, session_id, fork_node_id, parent_branch_id, injected_constraints, label, created_at)
    VALUES (?, ?, ?, 'main', ?, ?, ?)
  `).run(branchId, input.sessionId, input.forkNodeId, injectedConstraints, `Replay: ${input.rule.slice(0, 40)}`, now)

  return { branchId, constraintId }
}
