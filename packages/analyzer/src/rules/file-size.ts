import type { ArchViolation } from '@keel/core'

const LINE_LIMIT = 300

export function checkFileSize(filePath: string, lineCount: number, projectRoot?: string): ArchViolation | null {
  if (lineCount <= LINE_LIMIT) return null

  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  return {
    type: 'file_too_large',
    severity: lineCount > 500 ? 'error' : 'warning',
    file: filePath,
    message: `${displayPath} has ${lineCount} lines (limit: ${LINE_LIMIT})`,
    suggestion: `Split into smaller modules by feature. Each file should own one responsibility. A 300-line limit forces that discipline.`,
  }
}
