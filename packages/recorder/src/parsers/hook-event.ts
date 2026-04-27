import { z } from 'zod'

// Claude Code sends hook payloads via stdin as JSON
// Shape matches Claude Code's PostToolUse hook contract

const BaseHookEventSchema = z.object({
  session_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_response: z.unknown().optional(),
})

export const WriteEventSchema = BaseHookEventSchema.extend({
  tool_name: z.literal('Write'),
  tool_input: z.object({
    file_path: z.string(),
    content: z.string(),
  }),
})

export const EditEventSchema = BaseHookEventSchema.extend({
  tool_name: z.literal('Edit'),
  tool_input: z.object({
    file_path: z.string(),
    old_string: z.string(),
    new_string: z.string(),
  }),
})

export const BashEventSchema = BaseHookEventSchema.extend({
  tool_name: z.literal('Bash'),
  tool_input: z.object({
    command: z.string(),
    description: z.string().optional(),
  }),
})

export const HookEventSchema = z.discriminatedUnion('tool_name', [
  WriteEventSchema,
  EditEventSchema,
  BashEventSchema,
])

export type HookEvent = z.infer<typeof HookEventSchema>
export type WriteEvent = z.infer<typeof WriteEventSchema>
export type EditEvent = z.infer<typeof EditEventSchema>
export type BashEvent = z.infer<typeof BashEventSchema>

export function parseHookEvent(raw: unknown): HookEvent | null {
  const result = HookEventSchema.safeParse(raw)
  return result.success ? result.data : null
}
