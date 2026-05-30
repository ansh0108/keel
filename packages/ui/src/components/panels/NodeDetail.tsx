import { useState, useMemo } from 'react'
import { c, scoreColor, severityColor } from '../../styles/tokens.js'
import { estimateTokens, formatTokenCostLine } from '../../utils/tokenCost.js'
import { ReplayPanel } from './ReplayPanel.js'
import { api } from '../../lib/api.js'
import type { GraphNode, ArchViolation } from '../../lib/types.js'
import type { FileDiff } from '../../App.js'

interface Props {
  node: GraphNode
  sessionId: string
  fileDiff?: FileDiff | null
  onRescan?: (newSessionId: string, filePath: string) => void
  onDiffDismiss?: () => void
}

const AUTO_FIXABLE = new Set(['console_log'])

function cleanMessage(message: string): string {
  // Strip leading "path/to/file.tsx:N — " or "path/to/file.tsx — "
  let m = message.replace(/^[\w./-]+\.(tsx?|jsx?|ts|js):\d+\s*[—–-]+\s*/i, '')
  // Strip " in path/to/file.tsx" occurrences
  m = m.replace(/\s+in\s+[\w./-]+\.(tsx?|jsx?|ts|js)/gi, '')
  return m.trim()
}

const ISSUE_SUMMARY: Record<string, (v: ArchViolation) => string> = {
  long_function:          (v) => `${cleanMessage(v.message)} — break it into smaller functions under 50 lines each`,
  deep_nesting:           (v) => `${cleanMessage(v.message)} — refactor using early returns and extracted helpers`,
  missing_error_handling: (v) => `${cleanMessage(v.message)} — wrap each await in try/catch and handle errors gracefully`,
  god_component:          (v) => `${cleanMessage(v.message)} — extract state into a custom hook and split the component`,
  too_many_imports:       (v) => `${cleanMessage(v.message)} — ${v.suggestion}`,
  file_too_large:         (v) => `${cleanMessage(v.message)} — ${v.suggestion}`,
  mixed_responsibilities: (v) => `${cleanMessage(v.message)} — ${v.suggestion}`,
  todo_comment:           (v) => `${cleanMessage(v.message)} — resolve this properly or delete it`,
  hallucinated_import:    (v) => `${cleanMessage(v.message)} — ${v.suggestion}`,
  orphaned_export:        (v) => `${cleanMessage(v.message)} — ${v.suggestion}`,
}

function buildClaudePrompt(violation: ArchViolation, filePath: string): string {
  const summary = ISSUE_SUMMARY[violation.type]
  const issue = summary ? summary(violation) : violation.suggestion
  return `Open ${filePath} and fix this issue: ${issue}`
}

function buildFixAllPrompt(violations: ArchViolation[], filePath: string): string {
  const issues = violations
    .filter((v) => !AUTO_FIXABLE.has(v.type))
    .map((v, i) => {
      const summary = ISSUE_SUMMARY[v.type]
      return `${i + 1}. ${summary ? summary(v) : v.suggestion}`
    })
  return `Open ${filePath} and fix all of the following issues in one pass:\n\n${issues.join('\n')}`
}

export function NodeDetail({ node, sessionId, fileDiff, onRescan, onDiffDismiss }: Props) {
  const [showReplay, setShowReplay] = useState(false)
  const [replayBranchId, setReplayBranchId] = useState<string | null>(null)
  const [fixStates, setFixStates] = useState<Record<number, 'idle' | 'loading' | 'done' | 'error'>>({})
  const [fixMessages, setFixMessages] = useState<Record<number, string>>({})
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [fixAllState, setFixAllState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [fixAllCopied, setFixAllCopied] = useState(false)
  const [anyClaudeCopied, setAnyClaudeCopied] = useState(false)
  const [rescanState, setRescanState] = useState<'idle' | 'loading' | 'done'>('idle')

  if (showReplay) {
    return (
      <ReplayPanel
        node={node}
        sessionId={sessionId}
        onReplayCreated={(id) => { setReplayBranchId(id); setShowReplay(false) }}
        onClose={() => setShowReplay(false)}
      />
    )
  }

  const score = node.metrics?.overallScore ?? null
  const violations = node.metrics?.violations ?? []
  const filesAnalyzed = node.metrics?.filesAnalyzed ?? []
  const sc = scoreColor(score)
  const hasError = violations.some((v) => v.severity === 'error')

  const file = node.filesChanged[0]
  const filePath = file?.path ?? ''
  const fileName = filePath.split('/').pop() ?? ''
  const ext = fileName.split('.').pop() ?? ''
  const folder = filePath.split('/').slice(-3, -1).join('/')
  const lineCount = filesAnalyzed[0]?.lineCount ?? file?.lineCountAfter
  const importCount = filesAnalyzed[0]?.dependencyCount

  // Approximate input tokens from line count (~12 tokens/line for code); count output
  // tokens from the actual analysis result JSON using tiktoken cl100k_base.
  const tokenCostLine = useMemo(() => {
    if (score === null || node.metrics === null) return null
    const inputTokens = (lineCount ?? 100) * 12
    const outputTokens = estimateTokens(JSON.stringify(node.metrics))
    return formatTokenCostLine(inputTokens, outputTokens)
  }, [node, score, lineCount])

  async function handleAutoFix(idx: number, violation: ArchViolation) {
    setFixStates((s) => ({ ...s, [idx]: 'loading' }))
    try {
      const result = await api.autofix(sessionId, node.id, { filePath, violationType: violation.type })
      setFixMessages((m) => ({ ...m, [idx]: result.message }))
      setFixStates((s) => ({ ...s, [idx]: result.fixed ? 'done' : 'error' }))
    } catch {
      setFixMessages((m) => ({ ...m, [idx]: 'Fix failed. Try manually.' }))
      setFixStates((s) => ({ ...s, [idx]: 'error' }))
    }
  }

  function handleCopyClaudeCommand(idx: number, violation: ArchViolation) {
    const prompt = buildClaudePrompt(violation, filePath)
    navigator.clipboard.writeText(prompt).catch(() => {})
    setCopiedIdx(idx)
    setAnyClaudeCopied(true)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  async function handleFixAll() {
    setFixAllState('loading')

    // Run all auto-fixable violations sequentially
    const autoFixable = violations
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => AUTO_FIXABLE.has(v.type) && fixStates[violations.indexOf(v)] !== 'done')

    for (const { v, i } of autoFixable) {
      setFixStates((s) => ({ ...s, [i]: 'loading' }))
      try {
        const result = await api.autofix(sessionId, node.id, { filePath, violationType: v.type })
        setFixMessages((m) => ({ ...m, [i]: result.message }))
        setFixStates((s) => ({ ...s, [i]: result.fixed ? 'done' : 'error' }))
      } catch {
        setFixStates((s) => ({ ...s, [i]: 'error' }))
      }
    }

    // Build combined prompt for all non-auto-fixable violations
    const structural = violations.filter((v) => !AUTO_FIXABLE.has(v.type))
    if (structural.length > 0) {
      const prompt = buildFixAllPrompt(violations, filePath)
      navigator.clipboard.writeText(prompt).catch(() => {})
      setFixAllCopied(true)
    }

    setFixAllState('done')
  }

  async function handleRescan() {
    setRescanState('loading')
    try {
      const result = await api.rescan()
      onRescan?.(result.sessionId, filePath)
      setRescanState('done')
      setTimeout(() => setRescanState('idle'), 2000)
    } catch {
      setRescanState('idle')
    }
  }

  return (
    <div style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-up">

      {/* ── File header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: c.fontMono, fontSize: 19, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
              {fileName}
            </div>
            {folder && <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 10 }}>{folder}/</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {lineCount != null && <Pill label={`${lineCount} lines`} />}
              {importCount != null && importCount > 0 && <Pill label={`${importCount} imports`} />}
              <Pill label={`.${ext}`} accent />
            </div>
          </div>
          {score !== null && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              {fileDiff && fileDiff.scoreBefore !== score ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'center' }}>
                  <span style={{ fontFamily: c.fontMono, fontSize: 28, fontWeight: 500, color: c.textMuted, letterSpacing: '-0.04em', lineHeight: 1, textDecoration: 'line-through', opacity: 0.5 }}>
                    {fileDiff.scoreBefore}
                  </span>
                  <span style={{ fontSize: 16, color: c.textMuted, opacity: 0.5 }}>→</span>
                  <span style={{ fontFamily: c.fontMono, fontSize: 46, fontWeight: 700, color: sc, letterSpacing: '-0.05em', lineHeight: 1 }}>
                    {score}
                  </span>
                </div>
              ) : (
                <div style={{ fontFamily: c.fontMono, fontSize: 46, fontWeight: 700, color: sc, letterSpacing: '-0.05em', lineHeight: 1 }}>{score}</div>
              )}
              <div style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>/ 100</div>
              {tokenCostLine && (
                <div style={{ fontSize: '0.8em', color: c.textMuted, opacity: 0.6, marginTop: 6, fontFamily: c.fontMono, letterSpacing: '0.01em' }}>
                  {tokenCostLine}
                </div>
              )}
            </div>
          )}
        </div>
        {score !== null && (
          <div style={{ marginTop: 18, height: 4, background: c.bg3, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: sc, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        )}
      </div>

      {/* ── Fixed issues (shown after rescan) ── */}
      {fileDiff && fileDiff.fixed.length > 0 && (
        <div style={{ background: c.successDim, border: `1px solid ${c.successBorder}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, color: c.success }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: c.success }}>
                {fileDiff.fixed.length} issue{fileDiff.fixed.length !== 1 ? 's' : ''} fixed
              </span>
            </div>
            <button
              onClick={onDiffDismiss}
              style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: 13, padding: '2px 6px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {fileDiff.fixed.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, color: c.success, flexShrink: 0, marginTop: 2 }}>✓</span>
                <span style={{ fontSize: 12, color: c.textSub, lineHeight: 1.5 }}>{cleanMessage(v.message)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Clean ── */}
      {violations.length === 0 && score !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: c.successDim, border: `1px solid ${c.successBorder}`, borderRadius: 12 }}>
          <span style={{ fontSize: 22, color: c.success }}>✓</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.success, marginBottom: 3 }}>All checks passed</div>
            <div style={{ fontSize: 12, color: c.textMuted }}>This file is clean.</div>
          </div>
        </div>
      )}

      {/* ── Violations ── */}
      {violations.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionHead label={`${violations.length} issue${violations.length > 1 ? 's' : ''} found`} color={hasError ? c.error : c.warning} inline />
            <div style={{ display: 'flex', gap: 6 }}>
              {violations.length > 1 && (
                <button
                  onClick={handleFixAll}
                  disabled={fixAllState === 'loading'}
                  style={{
                    padding: '7px 14px',
                    background: fixAllCopied ? c.successDim : c.accentDim,
                    border: `1px solid ${fixAllCopied ? c.successBorder : c.accentBorder}`,
                    borderRadius: 8,
                    color: fixAllCopied ? c.success : c.accent,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: fixAllState === 'loading' ? 'not-allowed' : 'pointer',
                    fontFamily: c.fontSans,
                    opacity: fixAllState === 'loading' ? 0.7 : 1,
                    transition: 'all 140ms',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fixAllState === 'loading' ? 'Fixing…' : fixAllCopied ? '✓ Prompt copied!' : '⚡ Fix All'}
                </button>
              )}
              <button
                onClick={handleRescan}
                disabled={rescanState === 'loading'}
                style={{
                  padding: '7px 14px',
                  background: rescanState === 'done' ? c.successDim : c.bg3,
                  border: `1px solid ${rescanState === 'done' ? c.successBorder : c.border}`,
                  borderRadius: 8,
                  color: rescanState === 'done' ? c.success : c.textSub,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: rescanState === 'loading' ? 'not-allowed' : 'pointer',
                  fontFamily: c.fontSans,
                  opacity: rescanState === 'loading' ? 0.7 : 1,
                  transition: 'all 140ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {rescanState === 'loading' ? 'Scanning…' : rescanState === 'done' ? '✓ Done!' : '↺ Rescan'}
              </button>
            </div>
          </div>
          {(fixAllCopied || anyClaudeCopied) && (
            <div style={{ background: c.accentDim, border: `1px solid ${c.accentBorder}`, borderRadius: 10, padding: '14px 16px', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, marginBottom: 8 }}>Prompt copied — paste it into Claude Code</div>
              <div style={{ fontSize: 12, color: c.textSub, lineHeight: 2.0 }}>
                1. Switch to <strong style={{ color: c.text }}>Claude Code</strong> (the app or VS Code extension)<br />
                2. Paste with <span style={{ fontFamily: c.fontMono, background: c.bg3, padding: '1px 5px', borderRadius: 4 }}>⌘V</span> into the chat and press Enter<br />
                3. Claude will open the file and fix the issues<br />
                4. Come back and run <span style={{ fontFamily: c.fontMono, background: c.bg3, padding: '1px 5px', borderRadius: 4 }}>keel scan</span> to verify
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {violations.map((v, i) => (
              <ViolationBlock
                key={i}
                violation={v}
                fixState={fixStates[i] ?? 'idle'}
                fixMessage={fixMessages[i]}
                copied={copiedIdx === i}
                onAutoFix={() => handleAutoFix(i, v)}
                onCopyCommand={() => handleCopyClaudeCommand(i, v)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Replay ── */}
      {replayBranchId && (
        <div style={{ padding: '14px 18px', background: c.accentDim, border: `1px solid ${c.accentBorder}`, borderRadius: 12, fontSize: 13, color: c.accent, lineHeight: 1.7 }}>
          ✓ Constraint saved. Start a new Claude Code session to apply it.
        </div>
      )}

      <button
        onClick={() => setShowReplay(true)}
        style={{ width: '100%', padding: '13px 0', background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 12, color: c.textSub, fontSize: 14, cursor: 'pointer', fontFamily: c.fontSans, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 160ms ease' }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = c.accentBorder; el.style.color = c.accent; el.style.background = c.accentDim }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = c.border; el.style.color = c.textSub; el.style.background = 'transparent' }}
      >
        ↩ Add constraint for next session
      </button>
    </div>
  )
}

interface ViolationBlockProps {
  violation: ArchViolation
  fixState: 'idle' | 'loading' | 'done' | 'error'
  fixMessage: string | undefined
  copied: boolean
  onAutoFix: () => void
  onCopyCommand: () => void
}

function ViolationBlock({ violation, fixState, fixMessage, copied, onAutoFix, onCopyCommand }: ViolationBlockProps) {
  const color = severityColor(violation.severity)
  const dimBg = violation.severity === 'error' ? c.errorDim : c.warningDim
  const dimBorder = violation.severity === 'error' ? c.errorBorder : c.warningBorder
  const canAutoFix = AUTO_FIXABLE.has(violation.type)

  return (
    <div style={{ background: dimBg, border: `1px solid ${dimBorder}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '16px 18px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {violation.type.replace(/_/g, ' ')}
        </span>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: c.textSub, lineHeight: 1.7 }}>
        {violation.message}
      </p>

      <div style={{ background: c.bg3, borderRadius: 8, padding: '12px 14px', border: `1px solid ${c.border}`, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>How to fix</div>
        <p style={{ margin: 0, fontSize: 13, color: c.textSub, lineHeight: 1.7 }}>{violation.suggestion}</p>
      </div>

      {/* Fix result */}
      {fixState === 'done' && (
        <div style={{ padding: '10px 14px', background: c.successDim, border: `1px solid ${c.successBorder}`, borderRadius: 8, fontSize: 13, color: c.success, marginBottom: 10 }}>
          ✓ {fixMessage}
        </div>
      )}
      {fixState === 'error' && (
        <div style={{ padding: '10px 14px', background: c.errorDim, border: `1px solid ${c.errorBorder}`, borderRadius: 8, fontSize: 13, color: c.error, marginBottom: 10 }}>
          ✕ {fixMessage}
        </div>
      )}

      {/* Action buttons */}
      {fixState !== 'done' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {canAutoFix && (
            <ActionButton
              onClick={onAutoFix}
              loading={fixState === 'loading'}
              label="Auto-fix"
              loadingLabel="Fixing…"
              color={c.success}
              bg={c.successDim}
              border={c.successBorder}
            />
          )}
          <ActionButton
            onClick={onCopyCommand}
            label={copied ? '✓ Copied!' : '↗ Ask Claude to fix'}
            color={copied ? c.success : c.accent}
            bg={c.accentDim}
            border={c.accentBorder}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({ onClick, loading, label, loadingLabel, color, bg, border }: {
  onClick: () => void
  loading?: boolean
  label: string
  loadingLabel?: string
  color: string
  bg: string
  border: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 14px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 130ms',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (loadingLabel ?? label) : label}
    </button>
  )
}

function SectionHead({ label, color, inline }: { label: string; color: string; inline?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: inline ? 0 : 14 }}>
      <div style={{ width: 3, height: 18, background: color, borderRadius: 2 }} />
      <span style={{ fontFamily: c.fontSerif, fontSize: 16, fontWeight: 500, color: c.text, fontStyle: 'italic' }}>{label}</span>
    </div>
  )
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span style={{ fontSize: 11, color: accent ? c.accent : c.textMuted, background: accent ? c.accentDim : c.bg3, border: `1px solid ${accent ? c.accentBorder : c.border}`, borderRadius: 20, padding: '3px 10px', fontFamily: accent ? c.fontMono : c.fontSans, fontWeight: accent ? 700 : 400 }}>
      {label}
    </span>
  )
}
