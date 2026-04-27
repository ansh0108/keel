import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'
import { SyntaxKind } from 'ts-morph'

export function checkConsoleLogs(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const violations: ArchViolation[] = []

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  for (const call of calls) {
    const expr = call.getExpression()
    const text = expr.getText()
    if (text === 'console.log' || text === 'console.debug' || text === 'console.warn') {
      violations.push({
        type: 'console_log',
        severity: 'warning',
        file: filePath,
        line: call.getStartLineNumber(),
        message: `${displayPath}:${call.getStartLineNumber()} — ${text}() left in production code`,
        suggestion: `Remove ${text}() from ${displayPath}. Use a proper logger or delete debug output before shipping.`,
      })
    }
  }

  return violations
}
