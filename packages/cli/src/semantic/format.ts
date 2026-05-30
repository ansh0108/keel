import type { SemanticReview, SemanticFinding } from './judge.js'

const SEVERITY_LABEL: Record<SemanticFinding['severity'], string> = {
  error: 'ERROR',
  warning: 'WARN',
  info: 'INFO',
}

const SEVERITY_RANK: Record<SemanticFinding['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
}

function sortFindings(findings: SemanticFinding[]): SemanticFinding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    return (a.line ?? 0) - (b.line ?? 0)
  })
}

// Human/agent-readable rendering of a semantic review. Shared by the `keel
// judge` CLI command and the keel_semantic_review MCP tool.
export function formatSemanticReview(review: SemanticReview): string {
  if (!review.analyzed) {
    return `Semantic review skipped for ${review.displayPath}: ${review.reason ?? 'unavailable'}`
  }

  const header = `Semantic review of ${review.displayPath}${review.model ? ` (${review.model})` : ''}`
  if (review.findings.length === 0) {
    return `${header}\nNo semantic issues found — naming, logic, comments, and error handling look sound.`
  }

  const lines = [`${header} — ${review.findings.length} finding${review.findings.length === 1 ? '' : 's'}:`]
  for (const f of sortFindings(review.findings)) {
    const loc = f.line ? `:${f.line}` : ''
    lines.push(`  [${SEVERITY_LABEL[f.severity]}] ${f.category}${loc} — ${f.message}`)
    if (f.suggestion) lines.push(`         fix: ${f.suggestion}`)
  }
  return lines.join('\n')
}
