export * from './rules/file-size.js'
export * from './rules/mixed-responsibilities.js'
export * from './rules/hallucinated-imports.js'
export * from './rules/orphaned-exports.js'
export * from './metrics/score.js'
export * from './metrics/file-analyzer.js'
export * from './insights/types.js'
export * from './insights/regressions.js'
export * from './insights/report-card.js'
export { analyzePythonFile, PYTHON_EXTENSIONS } from './python/analyze.js'

import { resetHallucinatedImportsCache } from './rules/hallucinated-imports.js'
import { resetOrphanedExportsCache } from './rules/orphaned-exports.js'
import { resetPythonCaches } from './python/analyze.js'

/**
 * Clears all per-process analysis caches (dependency manifests, project corpus).
 * Call before re-analyzing in a long-lived process so results reflect the
 * current state of disk rather than a stale snapshot.
 */
export function resetAnalyzerCaches(): void {
  resetHallucinatedImportsCache()
  resetOrphanedExportsCache()
  resetPythonCaches()
}
