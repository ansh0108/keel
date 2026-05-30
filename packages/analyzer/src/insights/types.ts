import type { ArchViolation, FileChange } from '@keelcode/core'

// Per-file violations captured at a single execution node, sourced from
// quality_metrics.files_analyzed. Score is derived on demand from violations.
export interface FileViolations {
  path: string
  violations: ArchViolation[]
}

// One recorded analysis event: a single execution node that touched files,
// along with the per-file violations Keel captured at that moment. This is the
// shared input shape that both the CLI (.keel/keel.db) and the server build
// from raw DB rows before handing it to the pure insight functions below.
export interface NodeAnalysisRecord {
  nodeId: string
  type: string
  timestamp: number
  branchId: string
  filesChanged: FileChange[]
  files: FileViolations[]
}
