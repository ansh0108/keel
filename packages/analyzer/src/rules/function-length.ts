import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keel/core'

const MAX_LINES = 50

export function checkFunctionLength(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const functions = [
    ...sourceFile.getFunctions(),
    ...sourceFile.getClasses().flatMap((c) => c.getMethods()),
    ...sourceFile.getVariableDeclarations().flatMap((v) => {
      const init = v.getInitializer()
      if (!init) return []
      const text = init.getKindName()
      return text === 'ArrowFunction' || text === 'FunctionExpression' ? [init] : []
    }),
  ]

  for (const fn of functions) {
    const start = fn.getStartLineNumber()
    const end = fn.getEndLineNumber()
    const lines = end - start

    if (lines > MAX_LINES) {
      const name = 'getName' in fn && typeof (fn as { getName?: () => string }).getName === 'function'
        ? (fn as { getName: () => string }).getName()
        : 'anonymous'

      violations.push({
        type: 'long_function',
        severity: lines > 100 ? 'error' : 'warning',
        file: filePath,
        line: start,
        message: `Function "${name}" in ${displayPath} is ${lines} lines long (limit: ${MAX_LINES})`,
        suggestion: `Break "${name}" into smaller functions, each doing one thing. Aim for under ${MAX_LINES} lines per function.`,
      })
    }
  }

  return violations
}
