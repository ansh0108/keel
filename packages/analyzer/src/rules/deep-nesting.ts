import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'
import { SyntaxKind } from 'ts-morph'

const MAX_DEPTH = 4

export function checkDeepNesting(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const violations: ArchViolation[] = []
  const NESTING_KINDS = new Set([
    SyntaxKind.IfStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.ForInStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.SwitchStatement,
    SyntaxKind.TryStatement,
    SyntaxKind.ArrowFunction,
    SyntaxKind.FunctionExpression,
  ])

  const reported = new Set<number>()

  function walk(node: ReturnType<SourceFile['getDescendants']>[number], depth: number) {
    if (NESTING_KINDS.has(node.getKind())) depth++

    if (depth > MAX_DEPTH) {
      const line = node.getStartLineNumber()
      if (!reported.has(line)) {
        reported.add(line)
        violations.push({
          type: 'deep_nesting',
          severity: depth > 6 ? 'error' : 'warning',
          file: filePath,
          line,
          message: `${displayPath}:${line} — nesting depth ${depth} exceeds limit of ${MAX_DEPTH}`,
          suggestion: `Refactor deeply nested code in ${displayPath} using early returns, extracted functions, or guard clauses.`,
        })
      }
    }

    for (const child of node.getChildren()) {
      walk(child, depth)
    }
  }

  walk(sourceFile as unknown as ReturnType<SourceFile['getDescendants']>[number], 0)
  return violations.slice(0, 3) // cap at 3 per file to avoid noise
}
