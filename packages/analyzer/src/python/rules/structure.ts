import type { ArchViolation } from '@keelcode/core'
import { codeLines, type PySource } from '../source.js'

const LONG_FUNCTION = 50
const LONG_FUNCTION_ERROR = 100
const NESTING_LIMIT = 4
const MAX_NESTING_REPORTS = 5
const IMPORT_LIMIT = 12
const GOD_OBJECT_METHODS = 20

// Functions whose body exceeds the line budget — long Python functions are as
// hard to follow as long TS ones, and a common shape of AI-generated code.
export function checkLongFunctions(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const fn of src.functions) {
    if (fn.bodyLines <= LONG_FUNCTION) continue
    violations.push({
      type: 'long_function',
      severity: fn.bodyLines > LONG_FUNCTION_ERROR ? 'error' : 'warning',
      file: src.path,
      line: fn.startLine,
      message: `${displayPath}:${fn.startLine} — function '${fn.name}' is ${fn.bodyLines} lines (limit: ${LONG_FUNCTION})`,
      suggestion: `Break '${fn.name}' into smaller functions, each doing one thing. Aim for under ${LONG_FUNCTION} lines per function.`,
    })
  }
  return violations
}

// Control flow nested beyond a sane depth, measured from Python's own
// indentation. Reports the entry into each too-deep region once, not every line.
export function checkDeepNesting(src: PySource, displayPath: string): ArchViolation[] {
  const code = codeLines(src.lines)
  const indentStack: number[] = []
  const violations: ArchViolation[] = []
  let prevDepth = 0

  for (const line of code) {
    while (indentStack.length && line.indent < indentStack[indentStack.length - 1]!) {
      indentStack.pop()
    }
    if (!indentStack.length || line.indent > indentStack[indentStack.length - 1]!) {
      indentStack.push(line.indent)
    }
    const depth = indentStack.length - 1

    if (depth > NESTING_LIMIT && prevDepth <= NESTING_LIMIT) {
      violations.push({
        type: 'deep_nesting',
        severity: 'warning',
        file: src.path,
        line: line.number,
        message: `${displayPath}:${line.number} — nested ${depth} levels deep (limit: ${NESTING_LIMIT})`,
        suggestion: `Flatten with early returns, guard clauses, or by extracting the inner block into its own function.`,
      })
      if (violations.length >= MAX_NESTING_REPORTS) break
    }
    prevDepth = depth
  }

  return violations
}

// Too many imports signals a module taking on too much. Counts import
// statements (an `import a, b` clause set counts each name).
export function checkImportCount(src: PySource, displayPath: string): ArchViolation | null {
  const count = src.imports.length
  if (count <= IMPORT_LIMIT) return null
  return {
    type: 'too_many_imports',
    severity: 'warning',
    file: src.path,
    message: `${displayPath} has ${count} imports (limit: ${IMPORT_LIMIT})`,
    suggestion: `A high import count often means the module has too many responsibilities. Consider splitting it by concern.`,
  }
}

// Classes with too many methods — the Python shape of a god object.
export function checkGodObject(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const cls of src.classes) {
    if (cls.methodCount <= GOD_OBJECT_METHODS) continue
    violations.push({
      type: 'god_object',
      severity: 'error',
      file: src.path,
      line: cls.startLine,
      message: `${displayPath}:${cls.startLine} — class '${cls.name}' has ${cls.methodCount} methods (limit: ${GOD_OBJECT_METHODS})`,
      suggestion: `Split '${cls.name}' into focused classes. A class with this many methods is usually doing several unrelated jobs.`,
    })
  }
  return violations
}
