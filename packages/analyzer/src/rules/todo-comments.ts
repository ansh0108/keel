import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keel/core'

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX|BUG|TEMP|NOCOMMIT)\b/i

export function checkTodoComments(sourceFile: SourceFile, projectRoot?: string): ArchViolation[] {
  const filePath = sourceFile.getFilePath()
  const displayPath = projectRoot && filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^\//, '')
    : filePath.split('/').slice(-2).join('/')

  const violations: ArchViolation[] = []

  const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/

  const lines = sourceFile.getFullText().split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!COMMENT_LINE.test(line ?? '')) continue
    const match = TODO_PATTERN.exec(line ?? '')
    if (match?.[1]) {
      const tag = match[1].toUpperCase()
      violations.push({
        type: 'todo_comment',
        severity: tag === 'FIXME' || tag === 'BUG' || tag === 'NOCOMMIT' ? 'error' : 'warning',
        file: filePath,
        line: i + 1,
        message: `${displayPath}:${i + 1} — ${tag} comment left in code`,
        suggestion: `Resolve the ${tag} in ${displayPath} line ${i + 1} before shipping, or create a tracked issue for it.`,
      })
    }
  }

  return violations
}
