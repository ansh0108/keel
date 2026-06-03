// A dependency-free structural model of a Python source file. Python has no
// TypeScript-style AST library that bundles cleanly into the CLI, but its
// significant indentation makes line-based structural analysis tractable and
// deterministic. This module does one careful pass that masks out strings and
// comments (so regex rules never match inside a literal or a docstring), then
// derives indentation depth and the file's functions, classes, and imports.

const TAB_WIDTH = 4

// One physical line, pre-classified so rules don't each re-parse strings.
export interface PyLine {
  // 1-based line number.
  number: number
  raw: string
  // `raw` with string literals blanked to spaces and the trailing comment
  // removed. Safe to run keyword/identifier regexes against.
  code: string
  // Leading-whitespace width (tabs expanded), measured on the raw line.
  indent: number
  // True when the stripped code is empty (blank or comment-only line).
  isBlank: boolean
  // The comment text after `#`, if any (taken from outside strings).
  comment: string | null
  // True when this line begins already inside a multi-line string (so its
  // content must not be treated as code, even after masking).
  continuation: boolean
}

export interface PyFunction {
  name: string
  startLine: number
  endLine: number
  // Count of non-blank body lines (excludes the `def` line and blank lines).
  bodyLines: number
  // Raw parameter list text, parentheses excluded, joined across wrapped lines.
  params: string
  // Logical nesting depth of the `def` keyword (0 = module level).
  depth: number
  isMethod: boolean
}

export interface PyClass {
  name: string
  startLine: number
  endLine: number
  methodCount: number
  depth: number
}

export interface PyImport {
  line: number
  // Top-level module name: `os.path` -> `os`, `from a.b import c` -> `a`.
  module: string
  isRelative: boolean
  isWildcard: boolean
  raw: string
}

export interface PySource {
  path: string
  lines: PyLine[]
  lineCount: number
  functions: PyFunction[]
  classes: PyClass[]
  imports: PyImport[]
}

type QuoteState = null | "'" | '"' | "'''" | '"""'

interface MaskResult {
  code: string
  comment: string | null
  // Quote state still open at end of line (carried to the next line).
  endState: QuoteState
}

// Masks string literals to spaces and strips the comment from a single physical
// line, given the multi-line-string state carried in from the previous line.
function maskLine(raw: string, incoming: QuoteState): MaskResult {
  let state: QuoteState = incoming
  let code = ''
  let comment: string | null = null
  let i = 0

  while (i < raw.length) {
    const three = raw.slice(i, i + 3)
    const ch = raw[i]!

    if (state) {
      // Inside a string: look for the matching closer.
      if ((state === "'''" || state === '"""') && three === state) {
        code += '   '
        i += 3
        state = null
        continue
      }
      if ((state === "'" || state === '"') && ch === state) {
        code += ' '
        i += 1
        state = null
        continue
      }
      // Backslash escape inside single/double quotes.
      if ((state === "'" || state === '"') && ch === '\\') {
        code += '  '
        i += 2
        continue
      }
      code += ' '
      i += 1
      continue
    }

    // Not in a string.
    if (ch === '#') {
      comment = raw.slice(i + 1)
      // Pad the remainder so column positions in `code` still line up.
      code += ' '.repeat(raw.length - i)
      break
    }
    if (three === "'''" || three === '"""') {
      state = three as QuoteState
      code += '   '
      i += 3
      continue
    }
    if (ch === "'" || ch === '"') {
      state = ch
      code += ' '
      i += 1
      continue
    }
    code += ch
    i += 1
  }

  // A single/double quote left open at line end without a continuation is an
  // unterminated literal; reset so a stray quote can't swallow the whole file.
  if (state === "'" || state === '"') state = null

  return { code, comment, endState: state }
}

function leadingIndent(raw: string): number {
  let width = 0
  for (const ch of raw) {
    if (ch === ' ') width += 1
    else if (ch === '\t') width += TAB_WIDTH
    else break
  }
  return width
}

// Builds the per-line model with string/comment masking applied.
function buildLines(text: string): PyLine[] {
  const rawLines = text.split('\n')
  const lines: PyLine[] = []
  let state: QuoteState = null

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!
    const continuation = state !== null
    const { code, comment, endState } = maskLine(raw, state)
    lines.push({
      number: i + 1,
      raw,
      code,
      indent: leadingIndent(raw),
      isBlank: code.trim().length === 0,
      comment,
      continuation,
    })
    state = endState
  }

  return lines
}

// Code lines only: real statements, never blank/comment lines or the interior
// of a multi-line string. This is the spine for all structural extraction.
function codeLines(lines: PyLine[]): PyLine[] {
  return lines.filter((l) => !l.isBlank && !l.continuation)
}

// Finds the last line of a block opened at `headerIndent`: the block runs until
// a later code line is indented at or below the header.
function blockEnd(lines: PyLine[], headerCodeIndex: number, code: PyLine[]): number {
  const header = code[headerCodeIndex]!
  let end = header.number
  for (let j = headerCodeIndex + 1; j < code.length; j++) {
    const line = code[j]!
    if (line.indent <= header.indent) break
    end = line.number
  }
  // Extend across trailing blank lines that still belong to the block's span.
  return end
}

const DEF_RE = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/
const CLASS_RE = /^class\s+([A-Za-z_]\w*)\s*[:(]/

// Joins a parenthesised signature that may wrap across several physical lines,
// returning the text between the outermost parens.
function readParams(code: PyLine[], headerIndex: number): string {
  let depth = 0
  let started = false
  let out = ''
  for (let j = headerIndex; j < code.length; j++) {
    for (const ch of code[j]!.code) {
      if (ch === '(') {
        depth += 1
        started = true
        if (depth === 1) continue
      } else if (ch === ')') {
        depth -= 1
        if (depth === 0) return out.trim()
      }
      if (started && depth >= 1) out += ch
    }
    if (started && depth === 0) break
  }
  return out.trim()
}

function extractStructures(lines: PyLine[]): {
  functions: PyFunction[]
  classes: PyClass[]
} {
  const code = codeLines(lines)
  const functions: PyFunction[] = []
  const classes: PyClass[] = []

  // Indent stack → logical nesting depth of each header line.
  const indentStack: number[] = []
  const depthFor = (indent: number): number => {
    while (indentStack.length && indent < indentStack[indentStack.length - 1]!) {
      indentStack.pop()
    }
    if (!indentStack.length || indent > indentStack[indentStack.length - 1]!) {
      indentStack.push(indent)
    }
    return indentStack.length - 1
  }

  for (let i = 0; i < code.length; i++) {
    const line = code[i]!
    const trimmed = line.code.trim()
    const depth = depthFor(line.indent)

    const classMatch = trimmed.match(CLASS_RE)
    if (classMatch) {
      const end = blockEnd(lines, i, code)
      const methodCount = code.filter(
        (l) =>
          l.number > line.number &&
          l.number <= end &&
          l.indent > line.indent &&
          DEF_RE.test(l.code.trim()),
      ).length
      classes.push({ name: classMatch[1]!, startLine: line.number, endLine: end, methodCount, depth })
      continue
    }

    const defMatch = trimmed.match(DEF_RE)
    if (defMatch) {
      const end = blockEnd(lines, i, code)
      const bodyLines = code.filter(
        (l) => l.number > line.number && l.number <= end && l.indent > line.indent,
      ).length
      functions.push({
        name: defMatch[1]!,
        startLine: line.number,
        endLine: end,
        bodyLines,
        params: readParams(code, i),
        depth,
        isMethod: line.indent > 0,
      })
    }
  }

  return { functions, classes }
}

const IMPORT_RE = /^import\s+(.+)$/
const FROM_RE = /^from\s+(\.*)([\w.]*)\s+import\s+(.+)$/

function extractImports(lines: PyLine[]): PyImport[] {
  const imports: PyImport[] = []
  for (const line of codeLines(lines)) {
    const trimmed = line.code.trim()

    const fromMatch = trimmed.match(FROM_RE)
    if (fromMatch) {
      const dots = fromMatch[1] ?? ''
      const mod = fromMatch[2] ?? ''
      const names = fromMatch[3] ?? ''
      imports.push({
        line: line.number,
        module: mod.split('.')[0] ?? '',
        isRelative: dots.length > 0,
        isWildcard: names.trim() === '*',
        raw: trimmed,
      })
      continue
    }

    const importMatch = trimmed.match(IMPORT_RE)
    if (importMatch) {
      // `import a.b, c as d` -> first top-level module of each clause.
      for (const clause of importMatch[1]!.split(',')) {
        const name = clause.trim().split(/\s+as\s+/)[0]!.trim()
        if (!name) continue
        imports.push({
          line: line.number,
          module: name.split('.')[0] ?? '',
          isRelative: false,
          isWildcard: false,
          raw: trimmed,
        })
      }
    }
  }
  return imports
}

export function parsePython(path: string, text: string): PySource {
  const lines = buildLines(text)
  const { functions, classes } = extractStructures(lines)
  const imports = extractImports(lines)
  return {
    path,
    lines,
    lineCount: lines.length,
    functions,
    classes,
    imports,
  }
}

// Re-export for rules that need to walk code lines themselves.
export { codeLines }
