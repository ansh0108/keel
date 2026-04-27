import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keel/core'

const MAX_IMPORTS = 12

export function checkImportCount(sourceFile: SourceFile, projectRoot?: string): ArchViolation | null {
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const count = sourceFile.getImportDeclarations().length
  if (count <= MAX_IMPORTS) return null

  return {
    type: 'too_many_imports',
    severity: count > 20 ? 'error' : 'warning',
    file: filePath,
    line: 1,
    message: `${displayPath} has ${count} imports (limit: ${MAX_IMPORTS}) — likely doing too many things`,
    suggestion: `Split ${displayPath} into smaller, focused modules. Group related functionality and reduce cross-cutting dependencies.`,
  }
}
