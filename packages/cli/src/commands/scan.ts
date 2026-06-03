import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createDbClient } from '@keelcode/core'
import { analyzeFiles } from '@keelcode/analyzer'
import { walkProjectFiles } from '../lib/project-files.js'
import type { QualityMetrics } from '@keelcode/core'

const BASELINE_BRANCH = 'baseline'

export function runScan(projectRoot: string): void {
  const dbPath = join(projectRoot, '.keel', 'keel.db')
  const db = createDbClient(dbPath)

  const files = walkProjectFiles(projectRoot)
  if (files.length === 0) {
    console.log('No supported source files (TypeScript/JavaScript/Python) found.')
    return
  }

  console.log(`\nKeel Scan — baseline analysis`)
  console.log(`${'─'.repeat(40)}`)
  console.log(`Scanning ${files.length} files...\n`)

  // Each scan replaces the previous baseline
  const existingSessions = db.prepare(`SELECT id FROM sessions`).all() as { id: string }[]
  for (const s of existingSessions) {
    db.prepare(`DELETE FROM quality_metrics WHERE node_id IN (SELECT id FROM execution_nodes WHERE session_id = ?)`).run(s.id)
    db.prepare(`DELETE FROM execution_nodes WHERE session_id = ?`).run(s.id)
    db.prepare(`DELETE FROM branches WHERE session_id = ?`).run(s.id)
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(s.id)
  }

  const sessionId = randomUUID()
  const rootNodeId = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO sessions (id, project_id, started_at, ended_at, root_node_id, files_modified, quality_summary)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `).run(sessionId, projectRoot, now, now, rootNodeId, JSON.stringify(files))

  db.prepare(`
    INSERT INTO execution_nodes (id, session_id, parent_id, branch_id, type, timestamp, input, output, files_changed, quality_metrics_id)
    VALUES (?, ?, NULL, ?, 'session_start', ?, '{}', '{}', '[]', NULL)
  `).run(rootNodeId, sessionId, BASELINE_BRANCH, now)

  const allMetrics: Array<{ file: string; metrics: QualityMetrics }> = []

  for (const file of files) {
    const nodeId = randomUUID()
    const metricsId = randomUUID()

    db.prepare(`
      INSERT INTO execution_nodes (id, session_id, parent_id, branch_id, type, timestamp, input, output, files_changed, quality_metrics_id)
      VALUES (?, ?, ?, ?, 'file_write', ?, ?, '{}', ?, NULL)
    `).run(
      nodeId, sessionId, rootNodeId, BASELINE_BRANCH, now,
      JSON.stringify({ path: file }),
      JSON.stringify([{ path: file, type: 'created', lineCountBefore: null, lineCountAfter: null }]),
    )

    try {
      const metrics = analyzeFiles(nodeId, [file], projectRoot)

      db.prepare(`
        INSERT INTO quality_metrics (id, node_id, overall_score, files_analyzed, violations)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        metricsId, nodeId, metrics.overallScore,
        JSON.stringify(metrics.filesAnalyzed),
        JSON.stringify(metrics.violations),
      )

      db.prepare('UPDATE execution_nodes SET quality_metrics_id = ? WHERE id = ?')
        .run(metricsId, nodeId)

      if (metrics.violations.length > 0) {
        allMetrics.push({ file, metrics })
      }
    } catch {
      // skip unanalyzable files
    }
  }

  printReport(allMetrics, files.length)
  console.log(`\nBaseline saved. Run \`keel ui\` to explore the full graph.`)
}

interface FileResult { file: string; metrics: QualityMetrics }

function printReport(results: FileResult[], totalFiles: number): void {
  if (results.length === 0) {
    console.log('✓ No violations found across all files.\n')
    return
  }

  const errors = results.filter((r) => r.metrics.violations.some((v) => v.severity === 'error'))
  const warnings = results.filter((r) => !errors.includes(r) && r.metrics.violations.length > 0)

  if (errors.length > 0) {
    console.log('ERRORS  (fix these first)')
    for (const { file, metrics } of sortByScore(errors)) {
      printFileLine(file, metrics)
      for (const v of metrics.violations.filter((v) => v.severity === 'error')) {
        console.log(`    → ${v.suggestion}`)
      }
    }
    console.log()
  }

  if (warnings.length > 0) {
    console.log('WARNINGS')
    for (const { file, metrics } of sortByScore(warnings)) {
      printFileLine(file, metrics)
    }
    console.log()
  }

  const clean = totalFiles - results.length
  const overallScore = computeOverallScore(results, totalFiles)
  console.log(`${'─'.repeat(40)}`)
  console.log(`${totalFiles} files scanned  ·  ${errors.length} errors  ·  ${warnings.length} warnings  ·  ${clean} clean`)
  console.log(`Overall project score: ${overallScore}/100`)
}

function printFileLine(file: string, metrics: QualityMetrics): void {
  const shortPath = file.split('/').slice(-3).join('/')
  const fileInfo = metrics.filesAnalyzed[0]
  const lines = fileInfo ? `${fileInfo.lineCount}L` : ''
  const score = `score: ${metrics.overallScore}`
  console.log(`  ${shortPath.padEnd(45)} ${lines.padStart(6)}  ${score}`)
}

function sortByScore(results: FileResult[]): FileResult[] {
  return [...results].sort((a, b) => a.metrics.overallScore - b.metrics.overallScore)
}

function computeOverallScore(violated: FileResult[], totalFiles: number): number {
  if (totalFiles === 0) return 100
  const violationPenalty = violated.reduce((acc, { metrics }) => acc + (100 - metrics.overallScore), 0)
  return Math.max(0, Math.round(100 - violationPenalty / totalFiles))
}
