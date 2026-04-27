import { useState } from 'react'
import { c, scoreColor } from '../../styles/tokens.js'
import { api } from '../../lib/api.js'
import type { GraphNode, ArchViolation } from '../../lib/types.js'
import { computeScanStats } from '../../lib/graph-utils.js'

interface Props {
  nodes: GraphNode[]
  selectedNodeId: string | null
  onNodeClick: (id: string) => void
  onRescan?: (newSessionId: string) => void
  scoreBefore?: number | null
}

const AUTO_FIXABLE = new Set(['console_log'])

function buildFixEverythingPrompt(nodes: GraphNode[]): string {
  const files = nodes.filter(n => n.parentId !== null)
  const withIssues = files.filter(n => (n.metrics?.violations.length ?? 0) > 0)

  const sections = withIssues.map(n => {
    const filePath = n.filesChanged[0]?.path ?? ''
    const violations = n.metrics?.violations ?? []
    if (violations.length === 0) return null
    const lines = violations.map((v: ArchViolation, i: number) => `${i + 1}. ${cleanViolation(v)}`)
    return `**${filePath}**\n${lines.join('\n')}`
  }).filter(Boolean)

  if (sections.length === 0) return ''
  return `Fix all of the following issues across multiple files in one pass:\n\n${sections.join('\n\n')}`
}

function cleanViolation(v: ArchViolation): string {
  const msg = v.message.replace(/^[\w./-]+\.(tsx?|jsx?|ts|js):\d+\s*[—–-]+\s*/i, '').trim()
  return `${msg} — ${v.suggestion}`
}

const EXT_COLOR: Record<string, { fg: string; bg: string }> = {
  tsx: { fg: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  jsx: { fg: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  ts:  { fg: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  js:  { fg: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  css: { fg: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
}

export function ScanView({ nodes, selectedNodeId, onNodeClick, onRescan, scoreBefore }: Props) {
  const [copied, setCopied] = useState(false)
  const [rescanState, setRescanState] = useState<'idle' | 'loading' | 'done'>('idle')
  const stats = computeScanStats(nodes)
  const sc = scoreColor(stats.avgScore)
  const scBefore = scoreBefore != null ? scoreColor(scoreBefore) : null

  async function handleRescan() {
    setRescanState('loading')
    try {
      const result = await api.rescan()
      onRescan?.(result.sessionId)
      setRescanState('done')
      setTimeout(() => setRescanState('idle'), 2000)
    } catch {
      setRescanState('idle')
    }
  }
  const files = nodes.filter((n) => n.parentId !== null)

  const errors  = files.filter((n) => n.metrics?.violations.some((v) => v.severity === 'error'))
  const warnings = files.filter((n) => !errors.includes(n) && (n.metrics?.violations.length ?? 0) > 0)
  const clean   = files.filter((n) => !errors.includes(n) && !warnings.includes(n))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg }}>

      {/* ── Stats bar ── */}
      <div style={{
        background: c.bg1,
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 36px',
        height: 70,
        flexShrink: 0,
        gap: 0,
      }}>
        <Stat value={stats.total} label="files scanned" color={c.textSub} />
        <Divider />
        {scoreBefore != null && scoreBefore !== stats.avgScore ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '0 28px' }}>
            <span style={{ fontFamily: c.fontMono, fontSize: 20, fontWeight: 500, color: scBefore!, letterSpacing: '-0.03em', textDecoration: 'line-through', opacity: 0.45 }}>
              {scoreBefore}
            </span>
            <span style={{ fontSize: 14, color: c.textMuted, opacity: 0.5 }}>→</span>
            <span style={{ fontFamily: c.fontMono, fontSize: 28, fontWeight: 700, color: sc, letterSpacing: '-0.03em' }}>
              {stats.avgScore}
            </span>
            <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>quality score</span>
          </div>
        ) : (
          <Stat value={stats.avgScore} label="quality score" color={sc} large />
        )}
        {stats.errors > 0 && <><Divider /><Stat value={stats.errors} label={stats.errors === 1 ? 'error' : 'errors'} color={c.error} /></>}
        {stats.warnings > 0 && <><Divider /><Stat value={stats.warnings} label={stats.warnings === 1 ? 'warning' : 'warnings'} color={c.warning} /></>}
        <Divider />
        <Stat value={stats.clean} label="clean" color={c.success} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: c.textMuted, letterSpacing: '0.01em' }}>Click any file to inspect →</span>
          {(stats.errors > 0 || stats.warnings > 0) && (
            <button
              onClick={() => {
                const prompt = buildFixEverythingPrompt(nodes)
                if (!prompt) return
                navigator.clipboard.writeText(prompt).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 2500)
              }}
              style={{
                padding: '8px 16px',
                background: copied ? c.successDim : c.accentDim,
                border: `1px solid ${copied ? c.successBorder : c.accentBorder}`,
                borderRadius: 8,
                color: copied ? c.success : c.accent,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: c.fontSans,
                whiteSpace: 'nowrap',
                transition: 'all 150ms',
                letterSpacing: '0.01em',
              }}
            >
              {copied ? '✓ Prompt copied!' : '⚡ Fix Everything'}
            </button>
          )}
          <button
            onClick={handleRescan}
            disabled={rescanState === 'loading'}
            style={{
              padding: '8px 16px',
              background: rescanState === 'done' ? c.successDim : c.bg3,
              border: `1px solid ${rescanState === 'done' ? c.successBorder : c.border}`,
              borderRadius: 8,
              color: rescanState === 'done' ? c.success : c.textSub,
              fontSize: 12,
              fontWeight: 700,
              cursor: rescanState === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: c.fontSans,
              whiteSpace: 'nowrap',
              opacity: rescanState === 'loading' ? 0.6 : 1,
              transition: 'all 150ms',
              letterSpacing: '0.01em',
            }}
          >
            {rescanState === 'loading' ? 'Scanning…' : rescanState === 'done' ? '✓ Done!' : '↺ Rescan'}
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }} className="fade-in">

        {errors.length > 0 && (
          <Section label="Errors" color={c.error} count={errors.length}>
            {errors.map((n) => <FileCard key={n.id} node={n} selected={n.id === selectedNodeId} onClick={() => onNodeClick(n.id)} />)}
          </Section>
        )}

        {warnings.length > 0 && (
          <Section label="Warnings" color={c.warning} count={warnings.length}>
            {warnings.map((n) => <FileCard key={n.id} node={n} selected={n.id === selectedNodeId} onClick={() => onNodeClick(n.id)} />)}
          </Section>
        )}

        {clean.length > 0 && (
          <Section label="Clean" color={c.success} count={clean.length}>
            {clean.map((n) => <FileCard key={n.id} node={n} selected={n.id === selectedNodeId} onClick={() => onNodeClick(n.id)} />)}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ label, color, count, children }: { label: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 3, height: 22, background: color, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontFamily: c.fontSerif, fontSize: 20, fontWeight: 500, color: c.text, fontStyle: 'italic' }}>{label}</span>
        <span style={{
          fontSize: 12,
          color: c.textMuted,
          background: c.bg3,
          border: `1px solid ${c.border}`,
          borderRadius: 20,
          padding: '2px 10px',
          fontWeight: 500,
        }}>{count}</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {children}
      </div>
    </div>
  )
}

function FileCard({ node, selected, onClick }: { node: GraphNode; selected: boolean; onClick: () => void }) {
  const score = node.metrics?.overallScore ?? null
  const violations = node.metrics?.violations ?? []
  const hasError = violations.some((v) => v.severity === 'error')
  const hasWarning = violations.length > 0 && !hasError
  const sc = scoreColor(score)

  const file = node.filesChanged[0]
  const fullPath = file?.path ?? ''
  const fileName = fullPath.split('/').pop() ?? ''
  const ext = fileName.split('.').pop() ?? ''
  const folder = fullPath.split('/').slice(-3, -1).join('/')
  const nameNoExt = fileName.replace(new RegExp(`\\.${ext}$`), '')
  const lineCount = node.metrics?.filesAnalyzed[0]?.lineCount ?? file?.lineCountAfter
  const extStyle = EXT_COLOR[ext] ?? { fg: '#8da0bc', bg: 'rgba(141,160,188,0.1)' }

  const baseBorder = selected
    ? sc
    : hasError ? c.errorBorder : hasWarning ? c.warningBorder : c.border

  return (
    <button
      onClick={onClick}
      className="card-hover"
      style={{
        background: selected ? c.bg3 : c.bg2,
        border: `1px solid ${baseBorder}`,
        borderLeft: `3px solid ${sc}`,
        borderRadius: 14,
        padding: '20px 22px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: c.fontSans,
        boxShadow: selected ? `0 0 0 1px ${sc}30, 0 8px 32px rgba(0,0,0,0.5)` : '0 2px 12px rgba(0,0,0,0.3)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.15s ease',
      }}
    >
      {/* Top: ext badge + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 11,
          color: extStyle.fg,
          background: extStyle.bg,
          border: `1px solid ${extStyle.fg}25`,
          padding: '3px 9px',
          borderRadius: 6,
          fontFamily: c.fontMono,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          .{ext}
        </span>
        {score !== null && (
          <span style={{
            fontFamily: c.fontMono,
            fontSize: 26,
            fontWeight: 700,
            color: sc,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            {score}
          </span>
        )}
      </div>

      {/* File name + folder */}
      <div>
        <div style={{
          fontFamily: c.fontMono,
          fontSize: 15,
          fontWeight: 600,
          color: c.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 4,
        }}>
          {nameNoExt}
        </div>
        {folder && (
          <div style={{ fontSize: 12, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder}/
          </div>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lineCount != null && (
          <span style={{ fontFamily: c.fontMono, fontSize: 11, color: c.textMuted }}>{lineCount}L</span>
        )}
        {hasError && (
          <span style={{ fontSize: 11, color: c.error, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.error, display: 'inline-block' }} />
            {violations.length} error{violations.length > 1 ? 's' : ''}
          </span>
        )}
        {hasWarning && (
          <span style={{ fontSize: 11, color: c.warning, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.warning, display: 'inline-block' }} />
            {violations.length} warning{violations.length > 1 ? 's' : ''}
          </span>
        )}
        {!hasError && !hasWarning && score !== null && (
          <span style={{ fontSize: 11, color: c.success }}>✓ clean</span>
        )}
      </div>
    </button>
  )
}

function Stat({ value, label, color, large }: { value: number; label: string; color: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 28px' }}>
      <span style={{ fontFamily: c.fontMono, fontSize: large ? 28 : 20, fontWeight: 700, color, letterSpacing: '-0.03em' }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: c.border, flexShrink: 0 }} />
}
