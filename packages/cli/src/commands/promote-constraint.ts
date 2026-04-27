import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface InjectedConstraint {
  id: string
  rule: string
  prompt: string
}

const KEEL_SECTION_HEADER = '## Keel Validated Constraints'
const KEEL_SECTION_MARKER = '<!-- keel-constraints -->'

export function promoteConstraintToClaudeMd(
  projectRoot: string,
  keelDir: string,
  injectedConstraintsJson: string,
  deltaScore: number,
): void {
  if (deltaScore <= 10) return

  const constraints = parseConstraints(injectedConstraintsJson)
  if (constraints.length === 0) return

  const claudeMdPath = join(projectRoot, 'CLAUDE.md')
  const current = readFileSafe(claudeMdPath) ?? ''

  for (const constraint of constraints) {
    if (current.includes(constraint.prompt.trim())) continue
    const updated = appendToKeelSection(current, constraint, deltaScore)
    writeFileSync(claudeMdPath, updated, 'utf-8')
    console.log(`[Keel] Promoted to CLAUDE.md: "${constraint.rule.slice(0, 60)}…"`)
  }

  // Keep .keel/constraints.md in sync
  syncKeelConstraints(keelDir, constraints)
}

function appendToKeelSection(
  existing: string,
  constraint: InjectedConstraint,
  delta: number,
): string {
  const entry = `\n- ${constraint.prompt.trim()} *(+${delta} quality score)*`

  if (existing.includes(KEEL_SECTION_MARKER)) {
    return existing.replace(
      KEEL_SECTION_MARKER,
      `${KEEL_SECTION_MARKER}${entry}`,
    )
  }

  const section = `\n\n${KEEL_SECTION_HEADER}\n${KEEL_SECTION_MARKER}${entry}`
  return existing.trimEnd() + section
}

function syncKeelConstraints(keelDir: string, constraints: InjectedConstraint[]): void {
  const path = join(keelDir, 'constraints.md')
  const prompts = constraints.map((c) => c.prompt.trim()).join('\n\n')
  writeFileSync(path, `# Keel Constraints\n\n${prompts}`, 'utf-8')
}

function parseConstraints(json: string): InjectedConstraint[] {
  try {
    return JSON.parse(json) as InjectedConstraint[]
  } catch {
    return []
  }
}

function readFileSafe(path: string): string | null {
  if (!existsSync(path)) return null
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}
