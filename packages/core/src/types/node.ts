import { z } from 'zod'

export const NodeTypeSchema = z.enum([
  'session_start',
  'llm_call',
  'tool_use',
  'file_write',
  'file_edit',
  'bash_exec',
  'session_end',
])

export const FileChangeSchema = z.object({
  path: z.string(),
  type: z.enum(['created', 'modified', 'deleted']),
  lineCountBefore: z.number().int().nonnegative().nullable(),
  lineCountAfter: z.number().int().nonnegative().nullable(),
})

export const ExecutionNodeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  branchId: z.string(),
  type: NodeTypeSchema,
  timestamp: z.number().int(),
  input: z.unknown(),
  output: z.unknown(),
  filesChanged: z.array(FileChangeSchema),
  qualityMetricsId: z.string().uuid().nullable(),
})

export type NodeType = z.infer<typeof NodeTypeSchema>
export type FileChange = z.infer<typeof FileChangeSchema>
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>
