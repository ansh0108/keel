import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { z } from 'zod'
import type { AppEnv } from '../index.js'
import { getSessionById, getNodesBySession, getMetricsForNode } from '../db/queries.js'
import { analyzeFiles } from '@keelcode/analyzer'
import { randomUUID } from 'node:crypto'

export const autofixRouter = new Hono<AppEnv>()

const BodySchema = z.object({
  filePath: z.string().min(1),
  violationType: z.string().min(1),
})

autofixRouter.post('/:sessionId/nodes/:nodeId/autofix', async (c) => {
  const { sessionId, nodeId } = c.req.param()
  const body = await c.req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400)

  const session = getSessionById(c.var.db, sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const { filePath, violationType } = parsed.data
  const projectRoot = c.var.projectRoot

  if (!existsSync(filePath)) return c.json({ error: 'File not found' }, 404)

  if (violationType === 'console_log') {
    const result = fixConsoleLogs(filePath)
    if (result.fixed) {
      // Re-analyze and update quality_metrics in DB
      const metrics = analyzeFiles(nodeId, [filePath], projectRoot)
      const metricsId = randomUUID()
      c.var.db.prepare(`
        INSERT INTO quality_metrics (id, node_id, overall_score, files_analyzed, violations)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(metricsId, nodeId, metrics.overallScore, JSON.stringify(metrics.filesAnalyzed), JSON.stringify(metrics.violations))
      c.var.db.prepare('UPDATE execution_nodes SET quality_metrics_id = ? WHERE id = ?').run(metricsId, nodeId)
    }
    return c.json({ fixed: result.fixed, linesRemoved: result.linesRemoved, message: result.message })
  }

  return c.json({ fixed: false, message: 'This violation type requires manual fixing with Claude.' }, 400)
})

function fixConsoleLogs(filePath: string): { fixed: boolean; linesRemoved: number; message: string } {
  const content = readFileSync(filePath, 'utf-8')
  const CONSOLE_RE = /^\s*console\.(log|debug|warn)\s*\(.*\)[\s;]*$/gm
  const matches = content.match(CONSOLE_RE)
  if (!matches) return { fixed: false, linesRemoved: 0, message: 'No console statements found.' }

  const cleaned = content.replace(CONSOLE_RE, '').replace(/\n{3,}/g, '\n\n')
  writeFileSync(filePath, cleaned, 'utf-8')
  return { fixed: true, linesRemoved: matches.length, message: `Removed ${matches.length} console statement${matches.length > 1 ? 's' : ''}.` }
}
