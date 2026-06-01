import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename, dirname, resolve } from 'node:path'

// Directories that never contain first-party source worth indexing.
const IGNORED_DIRS = new Set<string>([
  'node_modules', 'dist', 'build', 'out', '.next', '.keel',
  '.git', 'coverage', 'ui-dist', '.turbo', '.cache',
])

const SOURCE_RE = /\.(ts|tsx|js|jsx)$/
// Files whose exports are a public/framework surface — consumed from outside the
// repo (package entry points, framework route conventions), so "unused locally"
// is expected and must NOT be flagged.
const ENTRYPOINT_BASENAMES = new Set<string>([
  'index', 'main', 'bin', 'cli', 'server', 'app',
  'page', 'layout', 'route', 'middleware', 'loading', 'error', 'not-found',
])
const FRAMEWORK_DIRS = new Set<string>(['pages', 'app', 'routes'])

interface SourceCorpus {
  files: { path: string; text: string }[]
  // Files that some other module re-exports via `export … from './x'`. Their
  // symbols are a public surface (barrels), consumed across package boundaries
  // where a name-grep can't see them — so they must not be flagged.
  reExportTargets: Set<string>
}

// Matches `export * from '...'`, `export * as ns from '...'`, and
// `export { a, b } from '...'`.
const RE_EXPORT_RE = /export\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']

// The whole-project corpus is read once per root, not per analyzed file.
const corpusCache = new Map<string, SourceCorpus>()

// Drops the cached project corpus so a long-lived process (e.g. the MCP server)
// re-reads source after edits instead of reporting stale orphans.
export function resetOrphanedExportsCache(): void {
  corpusCache.clear()
}

/**
 * Flags exported symbols that are never referenced anywhere in the project —
 * the signature of AI-generated code that was produced but never wired up
 * (orphaned helpers, dead components, unused types).
 *
 * Conservative by design: a symbol is only flagged when its name appears in NO
 * other source file AND is not used locally within its own file beyond its
 * declaration. The local check matters because a type used only as the
 * parameter or return type of an exported function (e.g. `getX(): XResult`) is
 * public API by inference — consumers receive it without importing the name —
 * so it is not dead code. Any reference anywhere, even a coincidental
 * same-named identifier, suppresses the report, so false positives are rare.
 */
export function checkOrphanedExports(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  if (!projectRoot) return []

  const filePath = sourceFile.getFilePath()
  if (isExcludedFile(filePath)) return []

  const displayPath = filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const exported = collectExportedSymbols(sourceFile)
  if (exported.length === 0) return []

  const corpus = loadCorpus(projectRoot)
  // A barrel re-exports this file: its symbols are public API. Skip it.
  if (corpus.reExportTargets.has(filePath)) return []
  const violations: ArchViolation[] = []
  const seen = new Set<string>()

  for (const { name, line } of exported) {
    if (seen.has(name)) continue
    seen.add(name)
    if (isReferenced(name, filePath, corpus)) continue

    violations.push({
      type: 'orphaned_export',
      severity: 'warning',
      file: filePath,
      line,
      message: `${displayPath}:${line} — exports '${name}', which is never imported anywhere else in the project (likely AI-generated dead code)`,
      suggestion: `Confirm '${name}' is actually needed. If nothing uses it, delete it. If it is internal-only, drop the \`export\`. If it is public API, this warning is safe to ignore.`,
    })
  }

  return violations
}

interface ExportedSymbol {
  name: string
  line: number
}

// Extracts locally-declared exported names without relying on the type checker,
// so it works in both tsconfig-backed and in-memory analysis modes.
function collectExportedSymbols(sourceFile: SourceFile): ExportedSymbol[] {
  const symbols: ExportedSymbol[] = []

  const pushNamed = (
    decls: { isExported: () => boolean; isDefaultExport?: () => boolean; getName: () => string | undefined; getStartLineNumber: () => number }[],
  ): void => {
    for (const decl of decls) {
      if (!decl.isExported()) continue
      if (decl.isDefaultExport?.()) continue
      const name = decl.getName()
      if (name) symbols.push({ name, line: decl.getStartLineNumber() })
    }
  }

  pushNamed(sourceFile.getFunctions())
  pushNamed(sourceFile.getClasses())
  pushNamed(sourceFile.getInterfaces())
  pushNamed(sourceFile.getTypeAliases())
  pushNamed(sourceFile.getEnums())

  for (const stmt of sourceFile.getVariableStatements()) {
    if (!stmt.isExported()) continue
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName()
      if (name) symbols.push({ name, line: decl.getStartLineNumber() })
    }
  }

  // Local re-exports: `export { foo }`. Skip `export { foo } from './x'` (barrel
  // re-exports are an intentional public surface, not a local declaration).
  for (const exp of sourceFile.getExportDeclarations()) {
    if (exp.getModuleSpecifierValue()) continue
    for (const spec of exp.getNamedExports()) {
      const name = spec.getNameNode().getText()
      if (name && name !== 'default') symbols.push({ name, line: exp.getStartLineNumber() })
    }
  }

  return symbols
}

// A symbol is "referenced" if its name appears in any other source file, or if
// it appears in its own file more than once — i.e. beyond the single
// declaration site, indicating local use such as an exported function's
// parameter or return type (public API by inference, not dead code).
function isReferenced(name: string, declaringFile: string, corpus: SourceCorpus): boolean {
  const escaped = escapeRegExp(name)
  const testRe = new RegExp(`\\b${escaped}\\b`)
  for (const file of corpus.files) {
    if (file.path === declaringFile) {
      if (countWordMatches(file.text, escaped) > 1) return true
    } else if (testRe.test(file.text)) {
      return true
    }
  }
  return false
}

function countWordMatches(text: string, escapedName: string): number {
  const matches = text.match(new RegExp(`\\b${escapedName}\\b`, 'g'))
  return matches ? matches.length : 0
}

function loadCorpus(projectRoot: string): SourceCorpus {
  const cached = corpusCache.get(projectRoot)
  if (cached) return cached

  const files: { path: string; text: string }[] = []
  walk(projectRoot, files)

  const knownPaths = new Set(files.map((f) => f.path))
  const reExportTargets = collectReExportTargets(files, knownPaths)

  const corpus: SourceCorpus = { files, reExportTargets }
  corpusCache.set(projectRoot, corpus)
  return corpus
}

// Builds the set of files re-exported by some other module. Resolution is
// best-effort: relative specifiers are mapped to real corpus paths, covering
// the common `.js`-extension and bare/index forms used in TS/ESM.
function collectReExportTargets(
  files: { path: string; text: string }[],
  knownPaths: Set<string>,
): Set<string> {
  const targets = new Set<string>()

  for (const file of files) {
    const baseDir = dirname(file.path)
    for (const match of file.text.matchAll(RE_EXPORT_RE)) {
      const spec = match[1]
      if (!spec || !spec.startsWith('.')) continue
      const resolved = resolveSpecifier(baseDir, spec, knownPaths)
      if (resolved) targets.add(resolved)
    }
  }

  return targets
}

function resolveSpecifier(baseDir: string, spec: string, knownPaths: Set<string>): string | null {
  // Drop a written extension (e.g. './x.js') so we can try real source exts.
  const stripped = spec.replace(/\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/, '')
  const base = resolve(baseDir, stripped)

  const candidates = [
    ...RESOLVE_EXTS.map((ext) => base + ext),
    ...RESOLVE_EXTS.map((ext) => join(base, 'index' + ext)),
  ]
  for (const candidate of candidates) {
    if (knownPaths.has(candidate)) return candidate
  }
  return null
}

function walk(dir: string, acc: { path: string; text: string }[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const full = join(dir, entry)
    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(full)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue
      walk(full, acc)
    } else if (SOURCE_RE.test(entry)) {
      try {
        acc.push({ path: full, text: readFileSync(full, 'utf-8') })
      } catch {
        // Unreadable file — skip it rather than failing the whole scan.
      }
    }
  }
}

function isExcludedFile(filePath: string): boolean {
  const base = basename(filePath)
  if (base.endsWith('.d.ts')) return true
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(base)) return true
  if (/(^|\/)__tests__\//.test(filePath) || /(^|\/)__mocks__\//.test(filePath)) return true

  const nameNoExt = base.replace(SOURCE_RE, '')
  if (ENTRYPOINT_BASENAMES.has(nameNoExt)) return true

  const segments = filePath.split('/')
  for (const seg of segments) {
    if (FRAMEWORK_DIRS.has(seg)) return true
  }
  return false
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
