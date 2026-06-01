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

// Latest timestamp at which each file was recorded as deleted, sourced from
// nodes' files_changed. A deleted file has no analysis snapshot of its own (you
// can't analyze a file that no longer exists), so deletions are tracked here
// separately from the violation snapshots in `record.files`.
function lastDeletionByFile(records: NodeAnalysisRecord[]): Map<string, number> {
  const deletions = new Map<string, number>()
  for (const record of records) {
    for (const change of record.filesChanged) {
      if (change.type !== 'deleted') continue
      const prev = deletions.get(change.path)
      if (prev === undefined || record.timestamp > prev) {
        deletions.set(change.path, record.timestamp)
      }
    }
  }
  return deletions
}

// Total violations introduced and resolved across every consecutive snapshot of
// every file — counting fixes (improvements) as well as regressions. Use this
// for session-level tallies rather than the regression list, which only covers
// score drops.
//
// Deleting a file also resolves its outstanding violations: removing dead code
// is a fix, not a non-event. So a deleted file's last-known violations (from its
// final snapshot before the deletion) are credited as resolved — unless the file
// was recreated afterwards, in which case the later snapshots speak for it.
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

  const deletions = lastDeletionByFile(records)
  for (const [path, deletedAt] of deletions) {
    const snapshots = byFile.get(path)
    if (!snapshots || snapshots.length === 0) continue
    // A snapshot after the deletion means the file was recreated; its later
    // snapshots already account for any remaining violations, so skip it.
    if (snapshots.some((s) => s.record.timestamp > deletedAt)) continue
    const last = snapshots[snapshots.length - 1]!
    for (const v of last.file.violations) {
      churn.resolvedCount += 1
      bump(churn.resolvedByType, v.type)
    }
  }

  return churn
}
