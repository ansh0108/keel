import type { ArchViolation } from '@keelcode/core'
import type { ReviewResult, ScanSummary } from './analysis.js'

interface RuleInfo {
  type: string
  penalty: number
  severity: 'error' | 'warning' | 'varies'
  catches: string
}

// Reference catalog of every rule Keel enforces. Kept in sync with the
// analyzer's PENALTY map and rule set.
const RULES: RuleInfo[] = [
  { type: 'hallucinated_import', penalty: 25, severity: 'error', catches: "Imports of packages neither declared in package.json nor present in node_modules — the signature of an AI-hallucinated dependency." },
  { type: 'god_object', penalty: 30, severity: 'error', catches: 'A class or module that concentrates too many responsibilities.' },
  { type: 'circular_dependency', penalty: 25, severity: 'error', catches: 'Modules that import each other directly or transitively.' },
  { type: 'business_logic_in_ui', penalty: 20, severity: 'error', catches: 'Data access or business rules embedded directly in UI components.' },
  { type: 'file_too_large', penalty: 15, severity: 'varies', catches: 'Files over the line-count threshold (default 300).' },
  { type: 'god_component', penalty: 12, severity: 'varies', catches: 'React components with too many useState hooks or props.' },
  { type: 'mixed_responsibilities', penalty: 10, severity: 'warning', catches: 'A file mixing UI, data fetching, and business logic.' },
  { type: 'orphaned_export', penalty: 8, severity: 'warning', catches: 'Exported symbols never imported anywhere else — likely AI-generated dead code.' },
  { type: 'deep_nesting', penalty: 8, severity: 'warning', catches: 'Control-flow nested beyond 4 levels.' },
  { type: 'long_function', penalty: 8, severity: 'warning', catches: 'Functions longer than 50 lines.' },
  { type: 'missing_error_handling', penalty: 6, severity: 'warning', catches: '`await` calls without surrounding try/catch.' },
  { type: 'too_many_imports', penalty: 5, severity: 'warning', catches: 'More than 12 imports in one file.' },
  { type: 'console_log', penalty: 3, severity: 'warning', catches: '`console.log` / `console.error` left in source.' },
  { type: 'todo_comment', penalty: 2, severity: 'warning', catches: 'TODO / FIXME / HACK comments.' },
]

const SEVERITY_LABEL: Record<string, string> = { error: 'ERROR', warning: 'WARN' }

function sortViolations(violations: ArchViolation[]): ArchViolation[] {
  return [...violations].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return (a.line ?? 0) - (b.line ?? 0)
  })
}

// Strips the leading "path:line — " that rule messages embed, since we render
// the location separately.
function trimMessage(message: string): string {
  return message.replace(/^.*?\s—\s/, '')
}

export function formatReview(result: ReviewResult): string {
  if (!result.analyzed) {
    return `${result.displayPath} — not analyzed (${result.reason ?? 'unknown reason'})`
  }
  if (result.violations.length === 0) {
    return `OK  ${result.displayPath} — score ${result.score}/100, no issues.`
  }

  const lines = [`${result.displayPath} — score ${result.score}/100, ${result.violations.length} issue(s):`]
  for (const v of sortViolations(result.violations)) {
    const sev = SEVERITY_LABEL[v.severity] ?? v.severity.toUpperCase()
    const loc = v.line ? `line ${v.line}` : ''
    lines.push(`  ${sev.padEnd(5)} ${loc.padEnd(9)} ${v.type} — ${trimMessage(v.message)}`)
    lines.push(`        fix: ${v.suggestion}`)
  }
  return lines.join('\n')
}

export function formatReviewBatch(results: ReviewResult[]): string {
  return results.map(formatReview).join('\n\n')
}

export function formatScan(summary: ScanSummary): string {
  if (summary.totalFiles === 0) {
    return `No TypeScript/JavaScript files found under ${summary.root}.`
  }

  const header = [
    `Keel project scan — ${summary.root}`,
    `${summary.totalFiles} files  ·  ${summary.errorFiles} with errors  ·  ${summary.warningFiles} with warnings  ·  ${summary.cleanFiles} clean`,
    `Overall project score: ${summary.overallScore}/100`,
  ]

  if (summary.worst.length === 0) {
    header.push('', 'No violations found. Clean project.')
    return header.join('\n')
  }

  header.push('', `Lowest-scoring files (showing ${summary.worst.length}):`)
  for (const r of summary.worst) {
    const errs = r.violations.filter((v) => v.severity === 'error').length
    const warns = r.violations.length - errs
    header.push(`  ${r.displayPath.padEnd(48)} score ${String(r.score).padStart(3)}  (${errs} err, ${warns} warn)`)
  }
  header.push('', 'Use keel_review_file on any path above for line-level detail and fixes.')
  return header.join('\n')
}

export function formatRules(): string {
  const lines = ['Keel enforces these rules (penalty = points deducted from a file\'s 0–100 score):', '']
  for (const r of RULES) {
    lines.push(`  ${r.type.padEnd(24)} -${String(r.penalty).padStart(2)}  [${r.severity}]`)
    lines.push(`      ${r.catches}`)
  }
  return lines.join('\n')
}
