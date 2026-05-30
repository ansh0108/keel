import type { ArchViolation } from '@keelcode/core'

const PENALTY: Record<string, number> = {
  file_too_large: 15,
  mixed_responsibilities: 10,
  business_logic_in_ui: 20,
  circular_dependency: 25,
  god_object: 30,
  deep_nesting: 8,
  long_function: 8,
  too_many_imports: 5,
  console_log: 3,
  todo_comment: 2,
  missing_error_handling: 6,
  god_component: 12,
  hallucinated_import: 25,
  orphaned_export: 8,
}

const SEVERITY_MULTIPLIER: Record<string, number> = {
  error: 1.0,
  warning: 0.5,
}

export function computeScore(violations: ArchViolation[]): number {
  const totalPenalty = violations.reduce((acc, v) => {
    const base = PENALTY[v.type] ?? 10
    const multiplier = SEVERITY_MULTIPLIER[v.severity] ?? 1
    return acc + base * multiplier
  }, 0)

  return Math.max(0, Math.round(100 - totalPenalty))
}
