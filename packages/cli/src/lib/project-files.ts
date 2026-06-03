import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.keel', '.git',
  '.next', '.nuxt', '.svelte-kit', 'coverage', '.turbo',
  'out', '.cache', '__pycache__', '.venv',
])

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs',
  '.py', '.pyi',
])

export function walkProjectFiles(projectRoot: string): string[] {
  const ignored = loadGitignorePatterns(projectRoot)
  const results: string[] = []
  walk(projectRoot, projectRoot, ignored, results)
  return results
}

function walk(root: string, dir: string, ignored: RegExp[], results: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const rel = relative(root, fullPath)

    if (isIgnored(rel, entry, ignored)) continue

    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) walk(root, fullPath, ignored, results)
    } else if (SUPPORTED_EXTENSIONS.has(extname(entry))) {
      results.push(fullPath)
    }
  }
}

function isIgnored(relativePath: string, name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(relativePath) || p.test(name))
}

function loadGitignorePatterns(projectRoot: string): RegExp[] {
  const gitignorePath = join(projectRoot, '.gitignore')
  if (!existsSync(gitignorePath)) return []

  try {
    const lines = readFileSync(gitignorePath, 'utf-8').split('\n')
    return lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('!'))
      .map(gitignorePatternToRegex)
      .filter((r): r is RegExp => r !== null)
  } catch {
    return []
  }
}

function gitignorePatternToRegex(pattern: string): RegExp | null {
  try {
    // Strip trailing slash (directory marker — we treat dirs and files the same)
    const p = pattern.replace(/\/$/, '')

    const escaped = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars
      .replace(/\\\*\\\*/g, '.+')             // ** → match anything including /
      .replace(/\\\*/g, '[^/]*')              // * → match anything except /
      .replace(/\?/g, '[^/]')                // ? → match single non-slash char

    // Patterns without / match anywhere in the path; patterns with / are root-anchored
    const anchored = pattern.includes('/') ? `^${escaped}` : `(^|/)${escaped}`
    return new RegExp(`${anchored}($|/)`)
  } catch {
    return null
  }
}
