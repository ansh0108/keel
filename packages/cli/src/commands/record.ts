import { join } from 'node:path'
import { createDbClient } from '@keelcode/core'
import {
  parseHookEvent,
  loadActiveSession,
  saveActiveSession,
  createActiveSession,
  advanceSession,
  buildNodeFromEvent,
} from '@keelcode/recorder'
import { analyzeFiles } from '@keelcode/analyzer'

export async function runRecord(projectRoot: string): Promise<void> {
  const raw = await readStdin()
  const parsed = safeParseJson(raw)
  if (parsed === null) return

  const event = parseHookEvent(parsed)
  if (event === null) return

  const keelDir = join(projectRoot, '.keel')
  const statePath = join(keelDir, 'session.json')
  const dbPath = join(keelDir, 'keel.db')

  const activeSession = loadActiveSession(statePath) ?? createActiveSession(keelDir)
  const db = createDbClient(dbPath)

  const node = buildNodeFromEvent(
    event,
    activeSession.sessionId,
    activeSession.lastNodeId,
    activeSession.branchId,
  )

  db.prepare(`
    INSERT INTO execution_nodes (id, session_id, parent_id, branch_id, type, timestamp, input, output, files_changed, quality_metrics_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    node.id,
    node.sessionId,
    node.parentId,
    node.branchId,
    node.type,
    node.timestamp,
    JSON.stringify(node.input),
    JSON.stringify(node.output),
    JSON.stringify(node.filesChanged),
  )

  const changedFiles = node.filesChanged.map((f) => f.path)
  if (changedFiles.length > 0) {
    try {
      const metrics = analyzeFiles(node.id, changedFiles, projectRoot)

      db.prepare(`
        INSERT INTO quality_metrics (id, node_id, overall_score, files_analyzed, violations)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        metrics.id,
        metrics.nodeId,
        metrics.overallScore,
        JSON.stringify(metrics.filesAnalyzed),
        JSON.stringify(metrics.violations),
      )

      db.prepare('UPDATE execution_nodes SET quality_metrics_id = ? WHERE id = ?')
        .run(metrics.id, node.id)

      if (metrics.violations.length > 0) {
        printViolations(metrics.overallScore, metrics.violations.map((v) => v.message))
      }
    } catch {
      // Analysis failure should never crash the recorder
    }
  }

  const updated = advanceSession(activeSession, node.id)
  saveActiveSession(statePath, updated)
}

function printViolations(score: number, messages: string[]): void {
  console.error(`\n[Keel] Architecture score: ${score}/100`)
  for (const msg of messages) {
    console.error(`  ⚠ ${msg}`)
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => { data += chunk })
    process.stdin.on('end', () => resolve(data))
  })
}

function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return null }
}
