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
