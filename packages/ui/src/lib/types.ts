export interface ArchViolation {
  type: string
  severity: 'error' | 'warning'
  file: string
  line?: number
  message: string
  suggestion: string
}

export interface FileMetrics {
  path: string
  lineCount: number
  responsibilities: string[]
  dependencyCount: number
  violations: ArchViolation[]
}

export interface NodeMetrics {
  id: string
  nodeId: string
  overallScore: number
  filesAnalyzed: FileMetrics[]
  violations: ArchViolation[]
}

export interface FileChange {
  path: string
  type: 'created' | 'modified' | 'deleted'
  lineCountBefore: number | null
  lineCountAfter: number | null
}

export interface GraphNode {
  id: string
  sessionId: string
  parentId: string | null
  branchId: string
  type: string
  timestamp: number
  input: unknown
  output: unknown
  filesChanged: FileChange[]
  metrics: NodeMetrics | null
}

export interface Branch {
  id: string
  sessionId: string
  forkNodeId: string
  parentBranchId: string
  label: string
  createdAt: number
}

export interface Session {
  id: string
  projectId: string
  startedAt: number
  endedAt: number | null
  filesModified: string[]
}

export interface SessionGraph {
  session: Session
  nodes: GraphNode[]
  branches: Branch[]
}

// ── Insights: report card (#5) + regression attribution (#4) ──

export interface ViolationTally {
  type: string
  count: number
}

export interface FileScore {
  path: string
  score: number
}

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

export interface ScorePoint {
  nodeId: string
  timestamp: number
  score: number
  violationCount: number
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

export interface RegressionsResponse {
  timelines: FileTimeline[]
  regressions: RegressionEvent[]
}
