import { z } from 'zod'

export const ConstraintSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  rule: z.string(),
  prompt: z.string(),
  validatedAt: z.number().int(),
  deltaScore: z.number(),
})

export const BranchSchema = z.object({
  id: z.string(),
  sessionId: z.string().uuid(),
  forkNodeId: z.string().uuid(),
  parentBranchId: z.string(),
  injectedConstraints: z.array(ConstraintSchema),
  label: z.string(),
  createdAt: z.number().int(),
})

export type Constraint = z.infer<typeof ConstraintSchema>
export type Branch = z.infer<typeof BranchSchema>
