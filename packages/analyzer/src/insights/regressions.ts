import type { ArchViolation } from '@keelcode/core'
import { computeScore } from '../metrics/score.js'
import type { NodeAnalysisRecord, FileViolations } from './types.js'

export interface ScorePoint {
  nodeId: string
  timestamp: number
  score: number
  violationCount: number
}

// A point in a file's history where its score dropped, attributed to the exact
// node (edit) that caused it — "git blame" for code-quality regressions.
export interface RegressionEvent {
  path: string
  nodeId: string
  nodeType: string
  timestamp: number
  fromScore: number
  toScore: number
  delta: number
  introducedViolations: ArchViolation[]
  resolvedViolations: ArchViolation[]
}

export interface FileTimeline {
  path: string
  points: ScorePoint[]
  firstScore: number
  currentScore: number
  bestScore: number
  worstScore: number
  regressions: RegressionEvent[]
}

// Stable identity for a violation within a single file, so we can diff the
// violation set between two consecutive snapshots of the same file.
function violationKey(v: ArchViolation): string {
  return `${v.type}:${v.line ?? 0}:${v.message}`
}

function diffViolations(
  before: ArchViolation[],
  after: ArchViolation[],
): { introduced: ArchViolation[]; resolved: ArchViolation[] } {
  const beforeKeys = new Set(before.map(violationKey))
  const afterKeys = new Set(after.map(violationKey))
  return {
    introduced: after.filter((v) => !beforeKeys.has(violationKey(v))),
    resolved: before.filter((v) => !afterKeys.has(violationKey(v))),
  }
}

interface FileSnapshot {
  record: NodeAnalysisRecord
  file: FileViolations
}

// Groups records into a per-file, time-ordered list of snapshots. A node can
// touch several files; each contributes one snapshot to its file's timeline.
function groupByFile(records: NodeAnalysisRecord[]): Map<string, FileSnapshot[]> {
  const ordered = [...records].sort((a, b) => a.timestamp - b.timestamp)
  const byFile = new Map<string, FileSnapshot[]>()

  for (const record of ordered) {
    for (const file of record.files) {
      const list = byFile.get(file.path) ?? []
      list.push({ record, file })
      byFile.set(file.path, list)
    }
  }

  return byFile
}

export function buildFileTimelines(records: NodeAnalysisRecord[]): FileTimeline[] {
  const byFile = groupByFile(records)
  const timelines: FileTimeline[] = []

  for (const [path, snapshots] of byFile) {
    const points: ScorePoint[] = snapshots.map(({ record, file }) => ({
      nodeId: record.nodeId,
      timestamp: record.timestamp,
      score: computeScore(file.violations),
      violationCount: file.violations.length,
    }))

    const regressions: RegressionEvent[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1]!
      const curr = snapshots[i]!
      const fromScore = points[i - 1]!.score
      const toScore = points[i]!.score
      if (toScore >= fromScore) continue

      const { introduced, resolved } = diffViolations(
        prev.file.violations,
        curr.file.violations,
      )
      regressions.push({
        path,
        nodeId: curr.record.nodeId,
        nodeType: curr.record.type,
        timestamp: curr.record.timestamp,
        fromScore,
        toScore,
        delta: toScore - fromScore,
        introducedViolations: introduced,
        resolvedViolations: resolved,
      })
    }

    const scores = points.map((p) => p.score)
    timelines.push({
      path,
      points,
      firstScore: scores[0] ?? 100,
      currentScore: scores[scores.length - 1] ?? 100,
      bestScore: scores.length ? Math.max(...scores) : 100,
      worstScore: scores.length ? Math.min(...scores) : 100,
      regressions,
    })
  }

  // Files with the steepest open regressions first.
  return timelines.sort((a, b) => a.currentScore - b.currentScore)
}

// All regression events across all files, worst (largest drop) first.
export function detectRegressions(records: NodeAnalysisRecord[]): RegressionEvent[] {
  return buildFileTimelines(records)
    .flatMap((t) => t.regressions)
    .sort((a, b) => a.delta - b.delta)
}

export interface ViolationChurn {
  introducedCount: number
  resolvedCount: number
  introducedByType: Map<string, number>
  resolvedByType: Map<string, number>
}

// Total violations introduced and resolved across every consecutive snapshot of
// every file — counting fixes (improvements) as well as regressions. Use this
// for session-level tallies rather than the regression list, which only covers
// score drops.
export function buildViolationChurn(records: NodeAnalysisRecord[]): ViolationChurn {
  const byFile = groupByFile(records)
  const churn: ViolationChurn = {
    introducedCount: 0,
    resolvedCount: 0,
    introducedByType: new Map(),
    resolvedByType: new Map(),
  }

  const bump = (map: Map<string, number>, type: string): void => {
    map.set(type, (map.get(type) ?? 0) + 1)
  }

  for (const snapshots of byFile.values()) {
    for (let i = 1; i < snapshots.length; i++) {
      const { introduced, resolved } = diffViolations(
        snapshots[i - 1]!.file.violations,
        snapshots[i]!.file.violations,
      )
      churn.introducedCount += introduced.length
      churn.resolvedCount += resolved.length
      for (const v of introduced) bump(churn.introducedByType, v.type)
      for (const v of resolved) bump(churn.resolvedByType, v.type)
    }
  }

  return churn
}
