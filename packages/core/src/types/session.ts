import { z } from 'zod'

export const QualitySummarySchema = z.object({
  averageScore: z.number().min(0).max(100),
  lowestScore: z.number().min(0).max(100),
  decayNodeId: z.string().nullable(),
  totalViolations: z.number().int().nonnegative(),
})

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  rootNodeId: z.string().uuid(),
  filesModified: z.array(z.string()),
  qualitySummary: QualitySummarySchema.nullable(),
})

export type QualitySummary = z.infer<typeof QualitySummarySchema>
export type Session = z.infer<typeof SessionSchema>
