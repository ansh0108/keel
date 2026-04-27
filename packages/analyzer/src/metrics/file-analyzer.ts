import { Project } from 'ts-morph'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { checkFileSize } from '../rules/file-size.js'
import { checkMixedResponsibilities } from '../rules/mixed-responsibilities.js'
import { checkFunctionLength } from '../rules/function-length.js'
import { checkImportCount } from '../rules/import-count.js'
import { checkConsoleLogs } from '../rules/console-logs.js'
import { checkDeepNesting } from '../rules/deep-nesting.js'
import { checkTodoComments } from '../rules/todo-comments.js'
import { checkMissingErrorHandling } from '../rules/missing-error-handling.js'
import { checkGodComponent } from '../rules/god-component.js'
import { computeScore } from './score.js'
import type { FileMetrics, QualityMetrics } from '@keelcode/core'

export function analyzeFiles(
  nodeId: string,
  filePaths: string[],
  projectRoot: string,
): QualityMetrics {
  const fileMetrics: FileMetrics[] = []

  for (const filePath of filePaths) {
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) continue
    const metrics = analyzeFile(filePath, projectRoot)
    if (metrics) fileMetrics.push(metrics)
  }

  const allViolations = fileMetrics.flatMap((f) => f.violations)

  return {
    id: randomUUID(),
    nodeId,
    overallScore: computeScore(allViolations),
    filesAnalyzed: fileMetrics,
    violations: allViolations,
  }
}

function analyzeFile(filePath: string, projectRoot: string): FileMetrics | null {
  if (!existsSync(filePath)) return null

  // Try AST-based analysis first; fall back to line-count only if tsconfig missing
  try {
    const tsconfigPath = `${projectRoot}/tsconfig.json`
    const hasTsConfig = existsSync(tsconfigPath)
    const project = hasTsConfig
      ? new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true })
      : new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true })

    const content = readFileSync(filePath, 'utf-8')
    const sourceFile = hasTsConfig
      ? project.addSourceFileAtPath(filePath)
      : project.createSourceFile(filePath, content)

    const lineCount = sourceFile.getEndLineNumber()

    return {
      path: filePath,
      lineCount,
      responsibilities: extractResponsibilities(sourceFile),
      dependencyCount: sourceFile.getImportDeclarations().length,
      violations: [
        checkFileSize(filePath, lineCount, projectRoot),
        checkMixedResponsibilities(sourceFile),
        checkImportCount(sourceFile, projectRoot),
        ...checkFunctionLength(sourceFile, projectRoot),
        ...checkConsoleLogs(sourceFile, projectRoot),
        ...checkDeepNesting(sourceFile, projectRoot),
        ...checkTodoComments(sourceFile, projectRoot),
        ...checkMissingErrorHandling(sourceFile, projectRoot),
        ...checkGodComponent(sourceFile, projectRoot),
      ].filter((v): v is NonNullable<typeof v> => v !== null),
    }
  } catch {
    // If ts-morph fails, fall back to raw line count only
    return fallbackAnalyze(filePath, projectRoot)
  }
}

function fallbackAnalyze(filePath: string, projectRoot?: string): FileMetrics | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lineCount = content.split('\n').length
    return {
      path: filePath,
      lineCount,
      responsibilities: [],
      dependencyCount: 0,
      violations: [checkFileSize(filePath, lineCount, projectRoot)].filter((v): v is NonNullable<typeof v> => v !== null),
    }
  } catch {
    return null
  }
}

function extractResponsibilities(sourceFile: ReturnType<Project['addSourceFileAtPath']>): string[] {
  const responsibilities: string[] = []
  if (sourceFile.getClasses().length > 0) responsibilities.push('class definitions')
  if (sourceFile.getFunctions().length > 0) responsibilities.push('functions')
  const imports = sourceFile.getImportDeclarations().map((d) => d.getModuleSpecifierValue())
  if (imports.some((i) => i.includes('react'))) responsibilities.push('UI rendering')
  if (imports.some((i) => ['axios', 'fetch', 'prisma', 'drizzle'].some((d) => i.includes(d)))) {
    responsibilities.push('data access')
  }
  return responsibilities
}
