import { Hono } from 'hono'
import type { AppEnv } from '../index.js'
import {
  getAllSessions,
  getSessionById,
  getNodesBySession,
  getMetricsForNode,
  getBranchesBySession,
} from '../db/queries.js'

export const sessionsRouter = new Hono<AppEnv>()

sessionsRouter.get('/', (c) => {
  const rows = getAllSessions(c.var.db)
  return c.json(rows.map(serializeSession))
})

sessionsRouter.get('/:id', (c) => {
  const row = getSessionById(c.var.db, c.req.param('id'))
  if (!row) return c.json({ error: 'Session not found' }, 404)
  return c.json(serializeSession(row))
})

sessionsRouter.get('/:id/graph', (c) => {
  const sessionId = c.req.param('id')
  const sessionRow = getSessionById(c.var.db, sessionId)
  if (!sessionRow) return c.json({ error: 'Session not found' }, 404)

  const nodeRows = getNodesBySession(c.var.db, sessionId)
  const branchRows = getBranchesBySession(c.var.db, sessionId)

  const nodes = nodeRows.map((node) => {
    const metricsRow = node['quality_metrics_id']
      ? (getMetricsForNode(c.var.db, node['quality_metrics_id'] as string) ?? null)
      : null

    return {
      id: node['id'] as string,
      sessionId: node['session_id'] as string,
      parentId: (node['parent_id'] as string | null) ?? null,
      branchId: node['branch_id'] as string,
      type: node['type'] as string,
      timestamp: node['timestamp'] as number,
      input: safeJsonParse(node['input'] as string | null, {}),
      output: safeJsonParse(node['output'] as string | null, {}),
      filesChanged: safeJsonParse(node['files_changed'] as string | null, []),
      metrics: metricsRow ? serializeMetrics(metricsRow) : null,
    }
  })

  const branches = branchRows.map((b) => ({
    id: b['id'] as string,
    sessionId: b['session_id'] as string,
    forkNodeId: b['fork_node_id'] as string,
    parentBranchId: b['parent_branch_id'] as string,
    label: b['label'] as string,
    createdAt: b['created_at'] as number,
  }))

  return c.json({ session: serializeSession(sessionRow), nodes, branches })
})

function serializeSession(row: Record<string, unknown>) {
  return {
    id: row['id'] as string,
    projectId: row['project_id'] as string,
    startedAt: row['started_at'] as number,
    endedAt: row['ended_at'] as number | null,
    rootNodeId: row['root_node_id'] as string,
    filesModified: safeJsonParse(row['files_modified'] as string | null, []),
  }
}

function serializeMetrics(row: Record<string, unknown>) {
  return {
    id: row['id'] as string,
    nodeId: row['node_id'] as string,
    overallScore: row['overall_score'] as number,
    filesAnalyzed: safeJsonParse(row['files_analyzed'] as string | null, []),
    violations: safeJsonParse(row['violations'] as string | null, []),
  }
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}
