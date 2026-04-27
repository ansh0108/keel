import { z } from 'zod'

export const ViolationTypeSchema = z.enum([
  'file_too_large',
  'mixed_responsibilities',
  'business_logic_in_ui',
  'circular_dependency',
  'god_object',
  'deep_nesting',
  'long_function',
  'too_many_imports',
  'console_log',
  'todo_comment',
  'missing_error_handling',
  'god_component',
])

export const ArchViolationSchema = z.object({
  type: ViolationTypeSchema,
  severity: z.enum(['error', 'warning']),
  file: z.string(),
  line: z.number().int().positive().optional(),
  message: z.string(),
  suggestion: z.string(),
})

export const FileMetricsSchema = z.object({
  path: z.string(),
  lineCount: z.number().int().nonnegative(),
  responsibilities: z.array(z.string()),
  dependencyCount: z.number().int().nonnegative(),
  violations: z.array(ArchViolationSchema),
})

export const QualityMetricsSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  filesAnalyzed: z.array(FileMetricsSchema),
  violations: z.array(ArchViolationSchema),
})

export type ViolationType = z.infer<typeof ViolationTypeSchema>
export type ArchViolation = z.infer<typeof ArchViolationSchema>
export type FileMetrics = z.infer<typeof FileMetricsSchema>
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>
