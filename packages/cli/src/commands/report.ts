import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { createDbClient } from '@keelcode/core'
import { buildReportCard, type ReportCard } from '@keelcode/analyzer'
import { loadAnalysisRecords, latestSessionId } from '../insights/records.js'

// `keel report` — an "agent report card" grading the quality of a session's
// work: where the code started, where it ended, what it broke, what it fixed.
export function runReport(projectRoot: string, sessionArg?: string): void {
  const dbPath = join(projectRoot, '.keel', 'keel.db')
  if (!existsSync(dbPath)) {
    console.log('No Keel history found. Run `keel init` and use Claude Code first.')
    return
  }

  const db = createDbClient(dbPath)
  const sessionId = sessionArg ?? latestSessionId(db)
  if (!sessionId) {
    console.log('No sessions recorded yet.')
    return
  }

  const records = loadAnalysisRecords(db, sessionId)
  const card = buildReportCard(records)
  printReportCard(projectRoot, sessionId, card)
}

function scoreLabel(score: number | null): string {
  return score === null ? 'n/a' : `${score}/100`
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function printReportCard(projectRoot: string, sessionId: string, card: ReportCard): void {
  console.log(`\n  Keel Report Card — session ${sessionId.slice(0, 8)}`)
  console.log('  ' + '─'.repeat(44))
  console.log(`  Grade:        ${card.grade}   (avg ${card.avgScore}/100)`)
  console.log(`  Trajectory:   ${scoreLabel(card.startScore)} → ${scoreLabel(card.endScore)}  (${signed(card.netDelta)})`)
  console.log(`  Files touched: ${card.filesTouched}   ·   Analyzed edits: ${card.nodesAnalyzed}`)
  console.log(`  Issues:        ${card.totalViolations} total · ${card.resolvedCount} resolved · ${card.regressions.length} regressions`)

  if (card.hallucinatedImports > 0 || card.orphanedExports > 0) {
    console.log(`  AI slop:       ${card.hallucinatedImports} hallucinated import(s) · ${card.orphanedExports} orphaned export(s)`)
  }

  if (card.violationsByType.length > 0) {
    console.log('\n  Top issues:')
    for (const t of card.violationsByType.slice(0, 5)) {
      console.log(`    ${String(t.count).padStart(3)}  ${t.type}`)
    }
  }

  if (card.worstFiles.length > 0) {
    console.log('\n  Lowest-scoring files:')
    for (const f of card.worstFiles) {
      const shortPath = f.path.startsWith(projectRoot) ? relative(projectRoot, f.path) : f.path
      console.log(`    ${String(f.score).padStart(3)}/100  ${shortPath}`)
    }
  }

  console.log(`\n  ${card.verdict}\n`)
}
