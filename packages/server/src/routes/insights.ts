import { Hono } from 'hono'
import { buildFileTimelines, detectRegressions, buildReportCard } from '@keelcode/analyzer'
import type { AppEnv } from '../index.js'
import { getSessionById } from '../db/queries.js'
import { loadSessionRecords } from '../db/insight-queries.js'

// Read-only insight endpoints for the dashboard: causal regression attribution
// (#4) and the session report card (#5).
export const insightsRouter = new Hono<AppEnv>()

insightsRouter.get('/:id/regressions', (c) => {
  const sessionId = c.req.param('id')
  if (!getSessionById(c.var.db, sessionId)) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const records = loadSessionRecords(c.var.db, sessionId)
  return c.json({
    timelines: buildFileTimelines(records),
    regressions: detectRegressions(records),
  })
})

insightsRouter.get('/:id/report', (c) => {
  const sessionId = c.req.param('id')
  if (!getSessionById(c.var.db, sessionId)) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const records = loadSessionRecords(c.var.db, sessionId)
  return c.json(buildReportCard(records))
})
