import type { ArchViolation } from '@keelcode/core'
import { codeLines, type PySource } from '../source.js'

const MAX_PRINT_REPORTS = 15
const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b/
const BARE_EXCEPT_RE = /^except\s*:/
const BROAD_EXCEPT_RE = /^except\s+(BaseException|Exception)\s*(?:as\s+\w+\s*)?:/
const PRINT_RE = /(?:^|[^.\w])print\s*\(/
const MUTABLE_DEFAULT_RE = /=\s*(\[\s*\]|\{\s*\}|list\(\s*\)|dict\(\s*\)|set\(\s*\))/

// `except:` (bare) or a broad `except Exception:` whose body only `pass`es —
// both swallow errors silently, a classic AI-generated failure mode.
export function checkBareExcept(src: PySource, displayPath: string): ArchViolation[] {
  const code = codeLines(src.lines)
  const violations: ArchViolation[] = []

  for (let i = 0; i < code.length; i++) {
    const line = code[i]!
    const trimmed = line.code.trim()
    const isBare = BARE_EXCEPT_RE.test(trimmed)
    const isBroad = BROAD_EXCEPT_RE.test(trimmed)
    if (!isBare && !isBroad) continue

    // For a broad (typed) except, only flag when it swallows: body is a lone `pass`.
    if (isBroad && !isBare) {
      const next = code[i + 1]
      const swallows = next !== undefined && next.indent > line.indent && next.code.trim() === 'pass'
      if (!swallows) continue
    }

    violations.push({
      type: 'bare_except',
      severity: 'warning',
      file: src.path,
      line: line.number,
      message: `${displayPath}:${line.number} — ${isBare ? 'bare `except:`' : '`except Exception: pass`'} swallows errors silently`,
      suggestion: `Catch a specific exception type and handle it — log it, re-raise, or recover. Never silently discard the error.`,
    })
  }

  return violations
}

// Mutable default arguments (`def f(x=[])`) share one object across all calls —
// a notorious Python footgun that AI models reproduce often.
export function checkMutableDefaultArgs(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const fn of src.functions) {
    if (!MUTABLE_DEFAULT_RE.test(fn.params)) continue
    violations.push({
      type: 'mutable_default_arg',
      severity: 'warning',
      file: src.path,
      line: fn.startLine,
      message: `${displayPath}:${fn.startLine} — function '${fn.name}' uses a mutable default argument`,
      suggestion: `Default to None and create the list/dict/set inside the function: \`def ${fn.name}(x=None): x = x or []\`. A mutable default is shared across every call.`,
    })
  }
  return violations
}

// `print(...)` left in source — the Python equivalent of a stray console.log.
export function checkPrintStatements(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const line of codeLines(src.lines)) {
    if (!PRINT_RE.test(line.code)) continue
    violations.push({
      type: 'print_statement',
      severity: 'warning',
      file: src.path,
      line: line.number,
      message: `${displayPath}:${line.number} — leftover print() statement`,
      suggestion: `Use the \`logging\` module instead of print() for diagnostics, or remove it before shipping.`,
    })
    if (violations.length >= MAX_PRINT_REPORTS) break
  }
  return violations
}

// `from module import *` pollutes the namespace and hides where names come from.
export function checkWildcardImports(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const imp of src.imports) {
    if (!imp.isWildcard) continue
    violations.push({
      type: 'wildcard_import',
      severity: 'warning',
      file: src.path,
      line: imp.line,
      message: `${displayPath}:${imp.line} — wildcard import (\`${imp.raw}\`) pollutes the namespace`,
      suggestion: `Import only the names you use: \`from ${imp.module} import name_a, name_b\`. Wildcard imports make it unclear where names originate.`,
    })
  }
  return violations
}

// TODO / FIXME / HACK / XXX markers left in comments.
export function checkTodoComments(src: PySource, displayPath: string): ArchViolation[] {
  const violations: ArchViolation[] = []
  for (const line of src.lines) {
    if (line.comment === null || !TODO_RE.test(line.comment)) continue
    const marker = line.comment.match(TODO_RE)![1]!
    violations.push({
      type: 'todo_comment',
      severity: 'warning',
      file: src.path,
      line: line.number,
      message: `${displayPath}:${line.number} — unresolved ${marker} comment`,
      suggestion: `Resolve the ${marker} or track it in an issue. Leftover markers accumulate into silent tech debt.`,
    })
  }
  return violations
}
