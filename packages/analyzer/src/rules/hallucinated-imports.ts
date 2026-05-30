import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { builtinModules } from 'node:module'

// Node builtins, both bare ("fs") and prefixed ("node:fs") forms.
const BUILTINS = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
])

interface ProjectDeps {
  declared: Set<string>
  aliasPrefixes: string[]
  // Ancestor directories (file dir → project root) whose node_modules are
  // searched. Makes the check correct in pnpm/npm/yarn workspaces, where deps
  // live in a sub-package's package.json and a nested node_modules.
  searchRoots: string[]
}

// Keyed by the importing file's directory, not the project root, so each
// package in a monorepo resolves against its own manifest + node_modules.
const depsCache = new Map<string, ProjectDeps>()

// Drops cached manifests so a long-lived process (e.g. the MCP server) sees
// freshly installed deps instead of reporting stale false positives.
export function resetHallucinatedImportsCache(): void {
  depsCache.clear()
}

/**
 * Flags imports of packages that are neither declared in package.json nor
 * present in node_modules — the signature of an AI-hallucinated dependency.
 *
 * Conservative by design: a package is only flagged when BOTH checks fail,
 * so real (if uninstalled) deps and local/aliased imports are never reported.
 */
export function checkHallucinatedImports(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  if (!projectRoot) return []

  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const { declared, aliasPrefixes, searchRoots } = loadDepsForFile(filePath, projectRoot)
  const violations: ArchViolation[] = []
  const seen = new Set<string>()

  const specifiers = [
    ...sourceFile.getImportDeclarations(),
    ...sourceFile.getExportDeclarations(),
  ]

  for (const decl of specifiers) {
    const specifier = decl.getModuleSpecifierValue()
    if (!specifier) continue
    if (isLocalOrBuiltin(specifier, aliasPrefixes)) continue

    const pkg = getPackageName(specifier)
    if (!pkg || BUILTINS.has(pkg)) continue
    if (declared.has(pkg)) continue
    if (existsInNodeModules(searchRoots, pkg)) continue
    if (seen.has(pkg)) continue
    seen.add(pkg)

    const line = decl.getStartLineNumber()
    violations.push({
      type: 'hallucinated_import',
      severity: 'error',
      file: filePath,
      line,
      message: `${displayPath}:${line} — imports '${pkg}', which is not installed or listed in package.json (likely an AI-hallucinated package)`,
      suggestion: `Confirm '${pkg}' is a real package. If it is, run \`npm install ${pkg}\`. If it was hallucinated, swap it for a real dependency or remove the import.`,
    })
  }

  return violations
}

function loadDepsForFile(filePath: string, projectRoot: string): ProjectDeps {
  const fileDir = dirname(filePath)
  const cached = depsCache.get(fileDir)
  if (cached) return cached

  const searchRoots = ancestorDirs(fileDir, projectRoot)
  const declared = new Set<string>()
  const aliasPrefixes: string[] = []

  // Merge manifests from the file's package up to the workspace root, so a
  // sub-package's deps and a hoisted root tsconfig are both honored.
  for (const root of searchRoots) {
    collectDeclaredDeps(root, declared)
    collectAliasPrefixes(root, aliasPrefixes)
  }

  const result: ProjectDeps = { declared, aliasPrefixes, searchRoots }
  depsCache.set(fileDir, result)
  return result
}

// Directories from `fileDir` up to and including `projectRoot`. If the file
// sits outside the root, falls back to [fileDir, projectRoot].
function ancestorDirs(fileDir: string, projectRoot: string): string[] {
  const roots: string[] = []
  let cur = fileDir
  while (true) {
    roots.push(cur)
    if (cur === projectRoot) break
    const parent = dirname(cur)
    if (parent === cur || !cur.startsWith(projectRoot)) {
      if (!roots.includes(projectRoot)) roots.push(projectRoot)
      break
    }
    cur = parent
  }
  return roots
}

function collectDeclaredDeps(dir: string, declared: Set<string>): void {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>
    const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    for (const field of fields) {
      const deps = pkg[field]
      if (deps && typeof deps === 'object') {
        for (const name of Object.keys(deps as Record<string, unknown>)) declared.add(name)
      }
    }
  } catch {
    // Malformed package.json — treat as no declared deps (node_modules still checked).
  }
}

function collectAliasPrefixes(dir: string, prefixes: string[]): void {
  const tsconfigPath = join(dir, 'tsconfig.json')
  if (!existsSync(tsconfigPath)) return

  try {
    const raw = readFileSync(tsconfigPath, 'utf-8')
    const parsed = JSON.parse(stripJsonish(raw)) as {
      compilerOptions?: { paths?: Record<string, unknown> }
    }
    const paths = parsed.compilerOptions?.paths
    if (paths && typeof paths === 'object') {
      for (const key of Object.keys(paths)) {
        // "@/*" -> "@/", "@components/*" -> "@components/"
        prefixes.push(key.replace(/\*$/, ''))
      }
    }
  } catch {
    // tsconfig with `extends`/exotic syntax — fall back to the built-in prefix heuristics.
  }
}

function isLocalOrBuiltin(specifier: string, aliasPrefixes: string[]): boolean {
  if (specifier.startsWith('.')) return true   // relative
  if (specifier.startsWith('/')) return true   // absolute path
  if (specifier.startsWith('#')) return true   // package.json "imports" subpaths
  if (specifier.startsWith('~')) return true   // common alias
  if (specifier.startsWith('@/')) return true  // common alias
  if (specifier.startsWith('node:')) return true
  if (BUILTINS.has(specifier)) return true
  for (const prefix of aliasPrefixes) {
    if (prefix && specifier.startsWith(prefix)) return true
  }
  return false
}

function getPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    // scoped: @scope/name[/subpath] -> @scope/name
    return specifier.split('/').slice(0, 2).join('/')
  }
  // unscoped: name[/subpath] -> name
  return specifier.split('/')[0] ?? ''
}

function existsInNodeModules(searchRoots: string[], pkg: string): boolean {
  for (const root of searchRoots) {
    if (existsSync(join(root, 'node_modules', pkg))) return true
  }
  return false
}

// Best-effort JSONC normaliser for tsconfig: strips comments and trailing commas.
function stripJsonish(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1')
}
