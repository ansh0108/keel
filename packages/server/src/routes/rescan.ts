import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import type { AppEnv } from '../index.js'
import { analyzeFiles } from '@keelcode/analyzer'

export const rescanRouter = new Hono<AppEnv>()

const EXCLUDED = new Set(['node_modules', 'dist', 'build', '.keel', '.git', '.next', 'coverage', 'out'])
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

function walkFiles(dir: string, results: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return results }
  for (const entry of entries) {
    if (EXCLUDED.has(entry)) continue
    const full = join(dir, entry)
    let stat
    try { stat = statSync(full) } catch { continue }
    if (stat.isDirectory()) walkFiles(full, results)
    else if (EXTENSIONS.has(extname(entry))) results.push(full)
  }
  return results
}

const BASELINE_BRANCH = 'baseline'

rescanRouter.post('/rescan', async (c) => {
  const db = c.var.db
  const projectRoot = c.var.projectRoot

  const files = walkFiles(projectRoot)
  if (files.length === 0) return c.json({ error: 'No files found' }, 400)

  // Clear existing sessions
  const sessions = db.prepare('SELECT id FROM sessions').all() as { id: string }[]
  for (const s of sessions) {
    db.prepare('DELETE FROM quality_metrics WHERE node_id IN (SELECT id FROM execution_nodes WHERE session_id = ?)').run(s.id)
    db.prepare('DELETE FROM execution_nodes WHERE session_id = ?').run(s.id)
    db.prepare('DELETE FROM branches WHERE session_id = ?').run(s.id)
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id)
  }

  const sessionId = randomUUID()
  const rootNodeId = randomUUID()
  const now = new Date().toISOString()

  // Create session with all required fields
  db.prepare(`INSERT INTO sessions (id, project_id, started_at, ended_at, root_node_id, files_modified, quality_summary)
    VALUES (?, ?, ?, ?, ?, ?, NULL)`).run(
    sessionId, projectRoot, now, now, rootNodeId,
    JSON.stringify(files.map((f: string) => f.replace(projectRoot, '').replace(/^\//, '')))
  )

  // Create root node
  db.prepare(`INSERT INTO execution_nodes (id, session_id, parent_id, branch_id, type, timestamp, input, output, files_changed, quality_metrics_id)
    VALUES (?, ?, NULL, ?, 'session_start', ?, '{}', '{}', '[]', NULL)`).run(
    rootNodeId, sessionId, BASELINE_BRANCH, now
  )

  // Analyze each file
  for (const filePath of files) {
    const nodeId = randomUUID()
    const relPath = filePath.replace(projectRoot, '').replace(/^\//, '')

    db.prepare(`INSERT INTO execution_nodes (id, session_id, parent_id, branch_id, type, timestamp, input, output, files_changed, quality_metrics_id)
      VALUES (?, ?, ?, ?, 'file_write', ?, ?, '{}', ?, NULL)`).run(
      nodeId, sessionId, rootNodeId, BASELINE_BRANCH, now,
      JSON.stringify({ path: relPath }),
      JSON.stringify([{ path: relPath, type: 'created', lineCountBefore: null, lineCountAfter: null }])
    )

    const metrics = analyzeFiles(nodeId, [filePath], projectRoot)
    const metricsId = randomUUID()
    db.prepare(`INSERT INTO quality_metrics (id, node_id, overall_score, files_analyzed, violations) VALUES (?, ?, ?, ?, ?)`).run(
      metricsId, nodeId, metrics.overallScore,
      JSON.stringify(metrics.filesAnalyzed),
      JSON.stringify(metrics.violations)
    )
    db.prepare('UPDATE execution_nodes SET quality_metrics_id = ? WHERE id = ?').run(metricsId, nodeId)
  }

  return c.json({ sessionId, filesScanned: files.length })
})
