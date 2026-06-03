import { readFileSync, existsSync } from 'node:fs'
import type { FileMetrics } from '@keelcode/core'
import { parsePython } from './source.js'
import { checkFileSize } from '../rules/file-size.js'
import {
  checkLongFunctions,
  checkDeepNesting,
  checkImportCount,
  checkGodObject,
} from './rules/structure.js'
import {
  checkBareExcept,
  checkMutableDefaultArgs,
  checkPrintStatements,
  checkWildcardImports,
  checkTodoComments,
} from './rules/smells.js'
import {
  checkPyHallucinatedImports,
  resetPyHallucinatedImportsCache,
} from './rules/hallucinated-imports.js'

export const PYTHON_EXTENSIONS = /\.(py|pyi)$/

// Clears Python analysis caches (dependency manifests) so a long-lived process
// re-reads source/manifests after edits instead of reporting stale results.
export function resetPythonCaches(): void {
  resetPyHallucinatedImportsCache()
}

function displayPathFor(filePath: string, projectRoot: string): string {
  return filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')
}

/**
 * Analyzes a single Python file against Keel's Python rule set, returning the
 * same FileMetrics shape the TypeScript analyzer produces so the score, DB, and
 * dashboard treat both languages uniformly.
 */
export function analyzePythonFile(filePath: string, projectRoot: string): FileMetrics | null {
  if (!existsSync(filePath)) return null

  let text: string
  try {
    text = readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const src = parsePython(filePath, text)
  const displayPath = displayPathFor(filePath, projectRoot)

  const violations = [
    checkFileSize(filePath, src.lineCount, projectRoot),
    checkImportCount(src, displayPath),
    ...checkLongFunctions(src, displayPath),
    ...checkDeepNesting(src, displayPath),
    ...checkGodObject(src, displayPath),
    ...checkBareExcept(src, displayPath),
    ...checkMutableDefaultArgs(src, displayPath),
    ...checkPrintStatements(src, displayPath),
    ...checkWildcardImports(src, displayPath),
    ...checkTodoComments(src, displayPath),
    ...checkPyHallucinatedImports(src, projectRoot),
  ].filter((v): v is NonNullable<typeof v> => v !== null)

  return {
    path: filePath,
    lineCount: src.lineCount,
    responsibilities: extractResponsibilities(src),
    dependencyCount: src.imports.length,
    violations,
  }
}

function extractResponsibilities(src: ReturnType<typeof parsePython>): string[] {
  const responsibilities: string[] = []
  if (src.classes.length > 0) responsibilities.push('class definitions')
  if (src.functions.some((f) => !f.isMethod)) responsibilities.push('functions')
  const modules = src.imports.map((i) => i.module)
  if (modules.some((m) => ['flask', 'fastapi', 'django', 'starlette', 'aiohttp', 'tornado'].includes(m))) {
    responsibilities.push('web/API')
  }
  if (modules.some((m) => ['sqlalchemy', 'psycopg2', 'pymongo', 'redis', 'sqlite3', 'asyncpg'].includes(m))) {
    responsibilities.push('data access')
  }
  if (modules.some((m) => ['numpy', 'pandas', 'torch', 'tensorflow', 'sklearn'].includes(m))) {
    responsibilities.push('data/ML')
  }
  return responsibilities
}
