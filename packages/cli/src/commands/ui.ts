import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { startServer } from '@keelcode/server'

declare const __dirname: string

const DEFAULT_PORT = 2701

export function runUi(projectRoot: string, port: number = DEFAULT_PORT): void {
  const dbPath = join(projectRoot, '.keel', 'keel.db')

  if (!existsSync(dbPath)) {
    console.error('No Keel database found. Run `keel init` first.')
    process.exit(1)
  }

  const uiDistPath = join(__dirname, '..', 'ui-dist')
  startServer(dbPath, uiDistPath, port, projectRoot)
}
