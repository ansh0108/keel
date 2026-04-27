import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'
import { SyntaxKind } from 'ts-morph'

const MAX_USE_STATE = 5
const MAX_PROPS = 8

export function checkGodComponent(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const filePath = sourceFile.getFilePath()
  if (!filePath.match(/\.(tsx|jsx)$/)) return []

  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const violations: ArchViolation[] = []

  const functions = [
    ...sourceFile.getFunctions(),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ]

  for (const fn of functions) {
    const body = fn.getBody()
    if (!body) continue

    // Count useState calls
    const useStateCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c) => c.getExpression().getText() === 'useState')

    if (useStateCalls.length > MAX_USE_STATE) {
      const line = fn.getStartLineNumber()
      const name = 'getName' in fn && typeof (fn as { getName?: () => string }).getName === 'function'
        ? (fn as { getName: () => string }).getName() || 'component'
        : 'component'

      violations.push({
        type: 'god_component',
        severity: useStateCalls.length > 8 ? 'error' : 'warning',
        file: filePath,
        line,
        message: `${displayPath}:${line} — "${name}" has ${useStateCalls.length} useState hooks (limit: ${MAX_USE_STATE})`,
        suggestion: `Break "${name}" into smaller components or extract state into a custom hook. Too many state variables is a sign of mixed concerns.`,
      })
    }
  }

  return violations
}
