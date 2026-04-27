import type { DbClient } from '@keelcode/core'

export function getAllSessions(db: DbClient) {
  return db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as Record<string, unknown>[]
}

export function getSessionById(db: DbClient, id: string) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function getNodesBySession(db: DbClient, sessionId: string) {
  return db.prepare('SELECT * FROM execution_nodes WHERE session_id = ?').all(sessionId) as Record<string, unknown>[]
}

export function getMetricsForNode(db: DbClient, metricsId: string) {
  return db.prepare('SELECT * FROM quality_metrics WHERE id = ?').get(metricsId) as Record<string, unknown> | undefined
}

export function getBranchesBySession(db: DbClient, sessionId: string) {
  return db.prepare('SELECT * FROM branches WHERE session_id = ?').all(sessionId) as Record<string, unknown>[]
}
