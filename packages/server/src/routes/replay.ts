import { Hono } from 'hono'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { AppEnv } from '../index.js'
import { getSessionById } from '../db/queries.js'
import { createReplay } from '../db/replay-queries.js'

export const replayRouter = new Hono<AppEnv>()

const ReplayBodySchema = z.object({
  rule: z.string().min(1),
  prompt: z.string().min(1),
})

replayRouter.post('/:sessionId/nodes/:nodeId/replay', async (c) => {
  const { sessionId, nodeId } = c.req.param()
  const body = await c.req.json()
  const parsed = ReplayBodySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid body', issues: parsed.error.issues }, 400)
  }

  const session = getSessionById(c.var.db, sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const projectId = session['project_id'] as string

  const { branchId } = createReplay(c.var.db, {
    sessionId,
    forkNodeId: nodeId,
    rule: parsed.data.rule,
    prompt: parsed.data.prompt,
    projectId,
  })

  writePendingBranch(c.var.projectRoot, branchId)
  writeConstraintFile(c.var.projectRoot, parsed.data.prompt)

  return c.json({ branchId, message: 'Constraint applied. Start a new Claude Code session to record the replay.' })
})

function writePendingBranch(projectRoot: string, branchId: string): void {
  const keelDir = join(projectRoot, '.keel')
  mkdirSync(keelDir, { recursive: true })
  writeFileSync(join(keelDir, 'pending-branch.json'), JSON.stringify({ branchId }), 'utf-8')
}

function writeConstraintFile(projectRoot: string, prompt: string): void {
  const path = join(projectRoot, '.keel', 'constraints.md')
  const existing = existsSync(path) ? readFileSafe(path) : null
  const updated = existing
    ? `${existing}\n\n${prompt}`
    : `# Keel Constraints\n\n${prompt}`
  writeFileSync(path, updated, 'utf-8')
}

function readFileSafe(path: string): string | null {
  try { return readFileSync(path, 'utf-8') } catch { return null }
}
