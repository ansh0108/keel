import { resolve, dirname, relative, isAbsolute, join } from 'node:path'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { analyzeFiles, resetAnalyzerCaches } from '@keelcode/analyzer'
import type { ArchViolation } from '@keelcode/core'
import { walkProjectFiles } from '../lib/project-files.js'

const SOURCE_RE = /\.(ts|tsx|js|jsx)$/

export interface ReviewResult {
  displayPath: string
  absPath: string
  analyzed: boolean
  score: number
  violations: ArchViolation[]
  reason?: string
}

export interface ScanSummary {
  root: string
  totalFiles: number
  cleanFiles: number
  errorFiles: number
  warningFiles: number
  overallScore: number
  worst: ReviewResult[]
}

// Resolves a user-supplied path against the server's working directory.
export function resolveInputPath(input: string, cwd: string): string {
  return isAbsolute(input) ? input : resolve(cwd, input)
}

// Walks up from a file to the nearest package.json / .git, so analysis runs
// against the right project root (correct deps + corpus) in monorepos.
export function findProjectRoot(fromFile: string, fallback: string): string {
  let cur = dirname(fromFile)
  while (true) {
    if (existsSync(join(cur, 'package.json')) || existsSync(join(cur, '.git'))) return cur
    const parent = dirname(cur)
    if (parent === cur) return fallback
    cur = parent
  }
}

// Analyzes one file. Caller is responsible for clearing caches beforehand when
// it wants fresh results (see reviewFiles / scanProject).
function analyzeOne(absPath: string, projectRoot: string): ReviewResult {
  const displayPath = absPath.startsWith(projectRoot)
    ? relative(projectRoot, absPath)
    : absPath

  if (!existsSync(absPath)) {
    return { displayPath, absPath, analyzed: false, score: 0, violations: [], reason: 'file not found' }
  }
  if (!SOURCE_RE.test(absPath)) {
    return { displayPath, absPath, analyzed: false, score: 0, violations: [], reason: 'unsupported file type (only .ts/.tsx/.js/.jsx)' }
  }

  try {
    const metrics = analyzeFiles(randomUUID(), [absPath], projectRoot)
    return {
      displayPath,
      absPath,
      analyzed: true,
      score: metrics.overallScore,
      violations: metrics.violations,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'analysis failed'
    return { displayPath, absPath, analyzed: false, score: 0, violations: [], reason }
  }
}

// Reviews a batch of files with a single cache reset, so freshly installed deps
// and just-edited source are reflected.
export function reviewFiles(inputs: string[], cwd: string): ReviewResult[] {
  resetAnalyzerCaches()
  return inputs.map((input) => {
    const absPath = resolveInputPath(input, cwd)
    const projectRoot = findProjectRoot(absPath, cwd)
    return analyzeOne(absPath, projectRoot)
  })
}

// Scans an entire project directory and returns an aggregate health summary.
export function scanProject(rootInput: string | undefined, cwd: string, worstLimit = 10): ScanSummary {
  const root = rootInput ? resolveInputPath(rootInput, cwd) : cwd
  resetAnalyzerCaches()

  const files = walkProjectFiles(root)
  const results: ReviewResult[] = []
  for (const file of files) {
    results.push(analyzeOne(file, root))
  }

  const violated = results.filter((r) => r.analyzed && r.violations.length > 0)
  const errorFiles = violated.filter((r) => r.violations.some((v) => v.severity === 'error'))
  const warningFiles = violated.filter((r) => !r.violations.some((v) => v.severity === 'error'))
  const cleanFiles = results.filter((r) => r.analyzed && r.violations.length === 0).length

  const overallScore = files.length === 0
    ? 100
    : Math.max(0, Math.round(100 - violated.reduce((acc, r) => acc + (100 - r.score), 0) / files.length))

  const worst = [...violated].sort((a, b) => a.score - b.score).slice(0, worstLimit)

  return {
    root,
    totalFiles: files.length,
    cleanFiles,
    errorFiles: errorFiles.length,
    warningFiles: warningFiles.length,
    overallScore,
    worst,
  }
}
