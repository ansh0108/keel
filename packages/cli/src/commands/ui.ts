import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { startServer } from '@keelcode/server'

const DEFAULT_PORT = 2701

export function runUi(projectRoot: string): void {
  const dbPath = join(projectRoot, '.keel', 'keel.db')

  if (!existsSync(dbPath)) {
    console.error('No Keel database found. Run `keel init` first.')
    process.exit(1)
  }

  const uiDistPath = resolveUiDist()
  startServer(dbPath, uiDistPath, DEFAULT_PORT, projectRoot)
}

function resolveUiDist(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // Installed: packages/cli/dist/commands/ui.js → ../../ui-dist
  return join(here, '..', '..', 'ui-dist')
}
