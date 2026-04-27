import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keel/core'
import { SyntaxKind } from 'ts-morph'

export function checkMissingErrorHandling(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const violations: ArchViolation[] = []

  const asyncFunctions = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ].filter((fn) => fn.isAsync?.())

  for (const fn of asyncFunctions) {
    const body = fn.getBody()
    if (!body) continue

    const hasTryCatch = body.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0
    const hasAwait = body.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0

    if (hasAwait && !hasTryCatch) {
      const line = fn.getStartLineNumber()
      const name = 'getName' in fn && typeof (fn as { getName?: () => string }).getName === 'function'
        ? (fn as { getName: () => string }).getName() || 'anonymous'
        : 'anonymous'

      violations.push({
        type: 'missing_error_handling',
        severity: 'warning',
        file: filePath,
        line,
        message: `${displayPath}:${line} — async function "${name}" uses await without try/catch`,
        suggestion: `Wrap the await calls in "${name}" with try/catch to handle failures gracefully instead of crashing silently.`,
      })
    }
  }

  return violations.slice(0, 4)
}
