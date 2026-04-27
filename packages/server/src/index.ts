import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createDbClient, type DbClient } from '@keelcode/core'
import { sessionsRouter } from './routes/sessions.js'
import { replayRouter } from './routes/replay.js'
import { autofixRouter } from './routes/autofix.js'
import { rescanRouter } from './routes/rescan.js'

export type AppEnv = {
  Variables: {
    db: DbClient
    projectRoot: string
  }
}

export function startServer(dbPath: string, uiDistPath: string, port: number, projectRoot: string) {
  const db = createDbClient(dbPath)
  const app = new Hono<AppEnv>()

  app.use('*', cors())

  app.use('*', (c, next) => {
    c.set('db', db)
    c.set('projectRoot', projectRoot)
    return next()
  })

  app.route('/api/sessions', sessionsRouter)
  app.route('/api/sessions', replayRouter)
  app.route('/api/sessions', autofixRouter)
  app.route('/api', rescanRouter)

  app.use('*', serveStatic({ root: uiDistPath }))

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Keel UI running at http://localhost:${port}`)
  })
}
