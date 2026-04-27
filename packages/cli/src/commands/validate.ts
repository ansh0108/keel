import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createDbClient } from '@keelcode/core'
import { loadActiveSession } from '@keelcode/recorder'
import {
  getBranchForSession,
  getForkScore,
  getReplayScore,
  updateConstraintDelta,
  parseConstraintIds,
} from '../db/validation-queries.js'
import { promoteConstraintToClaudeMd } from './promote-constraint.js'

export function runValidate(projectRoot: string): void {
  const keelDir = join(projectRoot, '.keel')
  const statePath = join(keelDir, 'session.json')
  const dbPath = join(keelDir, 'keel.db')

  if (!existsSync(dbPath)) return

  const activeSession = loadActiveSession(statePath)
  if (!activeSession) return

  // Only replay branches have meaningful validation — skip main
  if (activeSession.branchId === 'main') return

  const db = createDbClient(dbPath)

  const branch = getBranchForSession(db, activeSession.sessionId, activeSession.branchId)
  if (!branch) return

  const forkNodeId = branch['fork_node_id'] as string
  const injectedConstraints = branch['injected_constraints'] as string

  const forkScore = getForkScore(db, forkNodeId)
  const replayScore = getReplayScore(db, activeSession.sessionId, activeSession.branchId)

  if (!forkScore || !replayScore) {
    console.log('[Keel] Not enough data to validate this replay.')
    return
  }

  const delta = replayScore.avgScore - forkScore.score
  const constraintIds = parseConstraintIds(injectedConstraints)

  for (const constraintId of constraintIds) {
    updateConstraintDelta(db, constraintId, delta)
  }

  printResult(forkScore.score, replayScore.avgScore, delta)

  if (delta > 0) {
    promoteConstraintToClaudeMd(projectRoot, keelDir, injectedConstraints, delta)
  }
}

function printResult(before: number, after: number, delta: number): void {
  const sign = delta >= 0 ? '+' : ''
  const verdict = delta > 10
    ? '✓ Constraint validated — promoted to CLAUDE.md'
    : delta > 0
      ? '~ Marginal improvement — constraint recorded but not promoted'
      : '✗ No improvement — constraint did not help'

  console.log(`\n[Keel] Validation complete`)
  console.log(`  Before: ${before}/100  →  After: ${after}/100  (${sign}${delta})`)
  console.log(`  ${verdict}`)
}
