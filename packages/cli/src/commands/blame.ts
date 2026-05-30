import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { createDbClient } from '@keelcode/core'
import { detectRegressions, type RegressionEvent } from '@keelcode/analyzer'
import { loadAnalysisRecords } from '../insights/records.js'

// `keel blame` — git-blame for code-quality regressions. Shows which recorded
// edits dropped a file's score, and exactly which violations each one introduced.
export function runBlame(projectRoot: string, filter?: string): void {
  const dbPath = join(projectRoot, '.keel', 'keel.db')
  if (!existsSync(dbPath)) {
    console.log('No Keel history found. Run `keel init` and use Claude Code, or `keel scan` first.')
    return
  }

  const db = createDbClient(dbPath)
  const records = loadAnalysisRecords(db)
  let regressions = detectRegressions(records)

  if (filter) {
    const needle = filter.toLowerCase()
    regressions = regressions.filter((r) => r.path.toLowerCase().includes(needle))
  }

  if (regressions.length === 0) {
    console.log(filter
      ? `No quality regressions found for files matching "${filter}".`
      : 'No quality regressions found. Every recorded edit held or improved its score.')
    return
  }

  console.log(`\nKeel blame — ${regressions.length} quality regression${regressions.length === 1 ? '' : 's'}\n`)
  for (const r of regressions) {
    printRegression(projectRoot, r)
  }
}

function printRegression(projectRoot: string, r: RegressionEvent): void {
  const shortPath = r.path.startsWith(projectRoot) ? relative(projectRoot, r.path) : r.path
  const when = new Date(r.timestamp).toLocaleString()
  const arrow = `${r.fromScore} → ${r.toScore} (${r.delta})`

  console.log(`  ${shortPath}`)
  console.log(`    ${arrow}  via ${r.nodeType} at ${when}`)
  console.log(`    node ${r.nodeId}`)

  for (const v of r.introducedViolations) {
    const loc = v.line ? `:${v.line}` : ''
    console.log(`    + [${v.severity}] ${v.type}${loc} — ${v.message}`)
  }
  for (const v of r.resolvedViolations) {
    const loc = v.line ? `:${v.line}` : ''
    console.log(`    - resolved ${v.type}${loc}`)
  }
  console.log('')
}
