import type { ArchViolation } from '@keelcode/core'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { PySource } from '../source.js'
import { PY_STDLIB, IMPORT_TO_DISTRIBUTION, normalizeDistribution } from '../stdlib.js'

interface PyProjectDeps {
  // Normalised distribution names declared across the project's manifests.
  declared: Set<string>
  // True when at least one dependency manifest was found. With no manifest we
  // can't tell a real dependency from a hallucinated one, so the rule no-ops
  // (mirrors the TS rule skipping when there's no package.json/node_modules).
  hasManifest: boolean
  projectRoot: string
}

const depsCache = new Map<string, PyProjectDeps>()

export function resetPyHallucinatedImportsCache(): void {
  depsCache.clear()
}

const MANIFESTS = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg', 'environment.yml']

/**
 * Flags imports of third-party packages that are not declared in any dependency
 * manifest, not part of the standard library, and not a local module — the
 * Python signature of an AI-hallucinated (or "slopsquatted") dependency.
 *
 * Conservative by design: stdlib, relative imports, local modules/packages,
 * known import→distribution aliases, and anything declared in a manifest are
 * all exempt, and the rule does nothing when no manifest exists at all.
 */
export function checkPyHallucinatedImports(src: PySource, projectRoot?: string): ArchViolation[] {
  if (!projectRoot) return []

  const deps = loadDeps(projectRoot)
  if (!deps.hasManifest) return []

  const displayPath = src.path.startsWith(projectRoot)
    ? src.path.slice(projectRoot.length).replace(/^\//, '')
    : src.path.split('/').slice(-2).join('/')

  const localModules = collectLocalModules(src.path, projectRoot)
  const violations: ArchViolation[] = []
  const seen = new Set<string>()

  for (const imp of src.imports) {
    if (imp.isRelative) continue
    const mod = imp.module
    if (!mod || seen.has(mod)) continue
    if (PY_STDLIB.has(mod)) continue
    if (localModules.has(mod)) continue
    if (isDeclared(mod, deps.declared)) continue

    seen.add(mod)
    violations.push({
      type: 'hallucinated_import',
      severity: 'error',
      file: src.path,
      line: imp.line,
      message: `${displayPath}:${imp.line} — imports '${mod}', which is not in the standard library or any dependency manifest (likely an AI-hallucinated package)`,
      suggestion: `Confirm '${mod}' is a real package. If it is, add it to requirements.txt / pyproject.toml and install it. If it was hallucinated, replace it with a real dependency or remove the import.`,
    })
  }

  return violations
}

function isDeclared(mod: string, declared: Set<string>): boolean {
  const norm = normalizeDistribution(mod)
  if (declared.has(norm)) return true
  // The import name may differ from its distribution (e.g. cv2 ← opencv-python).
  const aliases = IMPORT_TO_DISTRIBUTION[mod]
  if (aliases && aliases.some((a) => declared.has(normalizeDistribution(a)))) return true
  return false
}

function loadDeps(projectRoot: string): PyProjectDeps {
  const cached = depsCache.get(projectRoot)
  if (cached) return cached

  const declared = new Set<string>()
  let hasManifest = false

  for (const manifest of MANIFESTS) {
    const path = join(projectRoot, manifest)
    if (!existsSync(path)) continue
    hasManifest = true
    try {
      collectFromManifest(manifest, readFileSync(path, 'utf-8'), declared)
    } catch {
      // Unreadable/malformed manifest — keep going; other manifests may cover it.
    }
  }

  const result: PyProjectDeps = { declared, hasManifest, projectRoot }
  depsCache.set(projectRoot, result)
  return result
}

const PEP508_NAME_RE = /^([A-Za-z0-9][A-Za-z0-9._-]*)/

function addDeclared(raw: string, declared: Set<string>): void {
  const match = raw.trim().match(PEP508_NAME_RE)
  if (match) declared.add(normalizeDistribution(match[1]!))
}

function collectFromManifest(name: string, text: string, declared: Set<string>): void {
  if (name === 'requirements.txt') {
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
      addDeclared(trimmed, declared)
    }
    return
  }

  if (name === 'pyproject.toml' || name === 'setup.cfg' || name === 'Pipfile' || name === 'setup.py') {
    // Lightweight extraction without a full TOML/INI parser. Covers PEP 621
    // [project] dependencies (multi-line and inline arrays), Poetry
    // [tool.poetry.dependencies] keyed form, optional-dependency/dev groups,
    // setup.cfg install_requires, Pipfile, and setup.py install_requires.
    //
    // Two passes per line: (1) every quoted requirement token anywhere on the
    // line — catches inline arrays like `dev = ["pytest>=8.0", "ruff"]`; and
    // (2) the Poetry `name = "^1.0"` keyed form, where the name is the key.
    // Over-collecting names here is safe: it can only miss a hallucination, it
    // can never cause a false positive.
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      for (const match of trimmed.matchAll(/['"]([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:[<>=!~;,\[\]'"\s)]|$)/g)) {
        addDeclared(match[1]!, declared)
      }

      const keyed = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/)
      if (keyed && keyed[1] !== 'python') addDeclared(keyed[1]!, declared)
    }
    return
  }

  if (name === 'environment.yml') {
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('-')) continue
      addDeclared(trimmed.replace(/^-\s*/, ''), declared)
    }
  }
}

// Top-level module names that resolve locally: sibling .py files and package
// directories (those containing __init__.py) near the file and at the root.
function collectLocalModules(filePath: string, projectRoot: string): Set<string> {
  const names = new Set<string>()
  const dirs = new Set<string>([dirname(filePath), projectRoot])
  // Also consider common source roots, since imports are absolute from there.
  for (const sub of ['src', 'app', 'lib']) {
    const candidate = join(projectRoot, sub)
    if (existsSync(candidate)) dirs.add(candidate)
  }

  for (const dir of dirs) {
    let entries: string[]
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) =>
        e.isDirectory() ? `dir:${e.name}` : `file:${e.name}`,
      )
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.startsWith('file:') && entry.endsWith('.py')) {
        names.add(entry.slice('file:'.length, -3))
      } else if (entry.startsWith('dir:')) {
        const dirName = entry.slice('dir:'.length)
        if (existsSync(join(dir, dirName, '__init__.py'))) names.add(dirName)
        else names.add(dirName) // namespace package or source dir
      }
    }
  }

  return names
}
