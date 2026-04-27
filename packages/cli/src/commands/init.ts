import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RECORD_COMMAND = 'keel record'
const VALIDATE_COMMAND = 'keel validate'

interface PostToolUseHook {
  matcher: string
  command: string
  description: string
}

interface StopHook {
  command: string
  description: string
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: PostToolUseHook[]
    Stop?: StopHook[]
  }
}

export function runInit(projectRoot: string): void {
  ensureKeelDir(projectRoot)
  injectClaudeHooks(projectRoot)
  ensureClaudeMdInclude(projectRoot)
  console.log('Keel initialized. Sessions will be recorded automatically.')
  console.log('Run `keel ui` to inspect execution graphs.')
}

function ensureKeelDir(projectRoot: string): void {
  mkdirSync(join(projectRoot, '.keel'), { recursive: true })
}

function injectClaudeHooks(projectRoot: string): void {
  const settingsPath = join(projectRoot, '.claude', 'settings.json')
  mkdirSync(join(projectRoot, '.claude'), { recursive: true })
  const settings = loadSettings(settingsPath)
  const updated = addHooks(settings)
  writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8')
  console.log(`Hooks registered in ${settingsPath}`)
}

function addHooks(settings: ClaudeSettings): ClaudeSettings {
  return {
    ...settings,
    hooks: {
      ...settings.hooks,
      PostToolUse: addPostToolUseHook(settings.hooks?.PostToolUse ?? []),
      Stop: addStopHook(settings.hooks?.Stop ?? []),
    },
  }
}

function addPostToolUseHook(existing: PostToolUseHook[]): PostToolUseHook[] {
  if (existing.some((h) => h.command === RECORD_COMMAND)) return existing
  return [
    ...existing,
    {
      matcher: 'Write|Edit|Bash',
      command: RECORD_COMMAND,
      description: 'Keel: record execution node and analyze architecture',
    },
  ]
}

function addStopHook(existing: StopHook[]): StopHook[] {
  if (existing.some((h) => h.command === VALIDATE_COMMAND)) return existing
  return [
    ...existing,
    {
      command: VALIDATE_COMMAND,
      description: 'Keel: validate replay constraints and promote to CLAUDE.md',
    },
  ]
}

// Add @.keel/constraints.md to CLAUDE.md so Claude reads active constraints
function ensureClaudeMdInclude(projectRoot: string): void {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md')
  const include = '@.keel/constraints.md'
  const current = existsSync(claudeMdPath)
    ? (readFileSafe(claudeMdPath) ?? '')
    : ''

  if (current.includes(include)) return

  const updated = current.trimEnd()
    ? `${current.trimEnd()}\n\n${include}\n`
    : `${include}\n`

  writeFileSync(claudeMdPath, updated, 'utf-8')
  console.log(`CLAUDE.md updated to include .keel/constraints.md`)
}

function loadSettings(path: string): ClaudeSettings {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ClaudeSettings
  } catch {
    return {}
  }
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}
