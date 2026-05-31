import { readFileSync, existsSync } from 'node:fs'
import { relative } from 'node:path'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5'
const MAX_SOURCE_CHARS = 60_000
const MAX_TOKENS = 1500
const SOURCE_RE = /\.(ts|tsx|js|jsx|mts|cts)$/

type SemanticSeverity = 'error' | 'warning' | 'info'

export interface SemanticFinding {
  severity: SemanticSeverity
  line?: number
  category: string
  message: string
  suggestion: string
}

export interface SemanticReview {
  path: string
  displayPath: string
  analyzed: boolean
  model?: string
  findings: SemanticFinding[]
  reason?: string
}

function apiKey(): string | undefined {
  return process.env['ANTHROPIC_API_KEY'] || process.env['KEEL_ANTHROPIC_API_KEY']
}

function model(): string {
  return process.env['KEEL_JUDGE_MODEL'] || DEFAULT_MODEL
}

const SYSTEM_PROMPT = `You are a senior code reviewer auditing AI-generated TypeScript/JavaScript.
Structural linters already cover file size, nesting, imports, console.log, and dead code.
Your job is the SEMANTIC layer those linters cannot see:
- logic bugs and incorrect edge-case handling
- misleading or inaccurate names (functions/vars that don't do what they say)
- comments that contradict the code (comment rot)
- wrong or leaky abstractions and incorrect API usage
- security smells (unvalidated input, injection, unsafe crypto, secret handling)
- silent failures and swallowed errors

Report only real, specific, high-signal issues. Do not restate structural lint.
If the code is genuinely fine, return an empty list.

Respond with ONLY a JSON array (no prose, no markdown fences). Each item:
{"severity":"error"|"warning"|"info","line":<number|null>,"category":"<short kebab-case>","message":"<what's wrong>","suggestion":"<how to fix>"}`

function buildUserMessage(displayPath: string, source: string): string {
  const numbered = source
    .split('\n')
    .map((line, i) => `${i + 1}\t${line}`)
    .join('\n')
  return `File: ${displayPath}\n\n${numbered}`
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[]
  error?: { message?: string }
}

// Extracts a JSON array from a model response that may include stray prose or
// markdown fences despite instructions.
function extractFindings(text: string): SemanticFinding[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const findings: SemanticFinding[] = []
  for (const raw of parsed) {
    if (typeof raw !== 'object' || raw === null) continue
    const o = raw as Record<string, unknown>
    const severity = o['severity']
    if (severity !== 'error' && severity !== 'warning' && severity !== 'info') continue
    const line = typeof o['line'] === 'number' && o['line'] > 0 ? o['line'] : undefined
    findings.push({
      severity,
      line,
      category: typeof o['category'] === 'string' ? o['category'] : 'general',
      message: typeof o['message'] === 'string' ? o['message'] : '',
      suggestion: typeof o['suggestion'] === 'string' ? o['suggestion'] : '',
    })
  }
  return findings.filter((f) => f.message.length > 0)
}

// Reviews one file with an LLM for semantic issues structural rules can't catch.
// Returns a clear, non-throwing result when the API key is missing or the call
// fails, so callers (CLI, MCP) can surface it without crashing.
export async function judgeFile(absPath: string, projectRoot: string): Promise<SemanticReview> {
  const displayPath = absPath.startsWith(projectRoot) ? relative(projectRoot, absPath) : absPath
  const base: SemanticReview = { path: absPath, displayPath, analyzed: false, findings: [] }

  if (!existsSync(absPath)) return { ...base, reason: 'file not found' }
  if (!SOURCE_RE.test(absPath)) return { ...base, reason: 'unsupported file type (only .ts/.tsx/.js/.jsx)' }

  const key = apiKey()
  if (!key) {
    return { ...base, reason: 'ANTHROPIC_API_KEY not set — semantic review is disabled. Export a key to enable it.' }
  }

  let source: string
  try {
    source = readFileSync(absPath, 'utf-8')
  } catch (error) {
    return { ...base, reason: error instanceof Error ? error.message : 'could not read file' }
  }
  const truncated = source.length > MAX_SOURCE_CHARS
  const body = truncated ? source.slice(0, MAX_SOURCE_CHARS) : source
  const usedModel = model()

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: usedModel,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(displayPath, body) }],
      }),
    })

    const json = (await res.json()) as AnthropicResponse
    if (!res.ok) {
      const detail = json.error?.message ?? `HTTP ${res.status}`
      return { ...base, model: usedModel, reason: `API error: ${detail}` }
    }

    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')

    return { ...base, analyzed: true, model: usedModel, findings: extractFindings(text) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'request failed'
    return { ...base, model: usedModel, reason: `request failed: ${reason}` }
  }
}
