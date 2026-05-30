import { computeScore } from '../metrics/score.js'
import type { NodeAnalysisRecord } from './types.js'
import { buildFileTimelines, buildViolationChurn, type RegressionEvent } from './regressions.js'

export interface ViolationTally {
  type: string
  count: number
}

export interface FileScore {
  path: string
  score: number
}

// A session-level "report card" grading the quality of an agent's work:
// where the code started, where it ended, what it broke, what it fixed.
export interface ReportCard {
  grade: string
  startScore: number | null
  endScore: number | null
  netDelta: number
  avgScore: number
  filesTouched: number
  nodesAnalyzed: number
  totalViolations: number
  violationsByType: ViolationTally[]
  introducedCount: number
  resolvedCount: number
  hallucinatedImports: number
  orphanedExports: number
  regressions: RegressionEvent[]
  cleanFiles: number
  worstFiles: FileScore[]
  verdict: string
}

function gradeFor(score: number): string {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 67) return 'D+'
  if (score >= 60) return 'D'
  return 'F'
}

function buildVerdict(card: Omit<ReportCard, 'verdict'>): string {
  if (card.nodesAnalyzed === 0) return 'No analyzed file changes in this session.'

  const parts: string[] = []
  if (card.netDelta > 5) parts.push(`improved overall quality by ${card.netDelta} points`)
  else if (card.netDelta < -5) parts.push(`degraded overall quality by ${Math.abs(card.netDelta)} points`)
  else parts.push('held quality roughly steady')

  if (card.hallucinatedImports > 0) {
    parts.push(`${card.hallucinatedImports} likely-hallucinated import${card.hallucinatedImports === 1 ? '' : 's'}`)
  }
  if (card.regressions.length > 0) {
    parts.push(`${card.regressions.length} regression${card.regressions.length === 1 ? '' : 's'}`)
  }
  if (card.resolvedCount > 0) {
    parts.push(`${card.resolvedCount} issue${card.resolvedCount === 1 ? '' : 's'} resolved`)
  }

  return `Agent ${parts.join(', ')}.`
}

export function buildReportCard(records: NodeAnalysisRecord[]): ReportCard {
  const ordered = [...records].sort((a, b) => a.timestamp - b.timestamp)
  const analyzed = ordered.filter((r) => r.files.length > 0)

  // Per-node overall score from all violations captured at that node.
  const nodeScores = analyzed.map((r) =>
    computeScore(r.files.flatMap((f) => f.violations)),
  )
  const startScore = nodeScores.length ? nodeScores[0]! : null
  const endScore = nodeScores.length ? nodeScores[nodeScores.length - 1]! : null
  const avgScore = nodeScores.length
    ? Math.round(nodeScores.reduce((a, b) => a + b, 0) / nodeScores.length)
    : 100

  const timelines = buildFileTimelines(records)
  const regressions = timelines
    .flatMap((t) => t.regressions)
    .sort((a, b) => a.delta - b.delta)

  // Net introduced/resolved across the whole session — counts fixes as well as
  // regressions, so resolutions during score improvements are not missed.
  const churn = buildViolationChurn(records)
  const introducedCount = churn.introducedCount
  const resolvedCount = churn.resolvedCount

  // Latest known state of every touched file (last snapshot wins).
  const latestByFile = new Map<string, FileScore>()
  const tallies = new Map<string, number>()
  let hallucinatedImports = 0
  let orphanedExports = 0

  for (const t of timelines) {
    latestByFile.set(t.path, { path: t.path, score: t.currentScore })
  }
  for (const r of analyzed) {
    for (const f of r.files) {
      for (const v of f.violations) {
        tallies.set(v.type, (tallies.get(v.type) ?? 0) + 1)
        if (v.type === 'hallucinated_import') hallucinatedImports++
        if (v.type === 'orphaned_export') orphanedExports++
      }
    }
  }

  const latest = [...latestByFile.values()]
  const cleanFiles = latest.filter((f) => f.score >= 90).length
  const worstFiles = [...latest].sort((a, b) => a.score - b.score).slice(0, 5)
  const violationsByType = [...tallies.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  const totalViolations = [...tallies.values()].reduce((a, b) => a + b, 0)

  const base = {
    grade: gradeFor(avgScore),
    startScore,
    endScore,
    netDelta: startScore !== null && endScore !== null ? endScore - startScore : 0,
    avgScore,
    filesTouched: latestByFile.size,
    nodesAnalyzed: analyzed.length,
    totalViolations,
    violationsByType,
    introducedCount,
    resolvedCount,
    hallucinatedImports,
    orphanedExports,
    regressions,
    cleanFiles,
    worstFiles,
  }

  return { ...base, verdict: buildVerdict(base) }
}
