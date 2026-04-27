import { c } from '../../styles/tokens.js'
import type { GraphNode, ArchViolation } from '../../lib/types.js'

interface FileDiff {
  path: string
  scoreBefore: number
  scoreAfter: number
  fixed: ArchViolation[]
  introduced: ArchViolation[]
}

export interface RescanDiffResult {
  files: FileDiff[]
  overallBefore: number
  overallAfter: number
}

function scoreFromNodes(nodes: GraphNode[]): number {
  const scored = nodes.filter(n => n.metrics !== null)
  if (scored.length === 0) return 0
  return Math.round(scored.reduce((s, n) => s + (n.metrics?.overallScore ?? 0), 0) / scored.length)
}

function violationKey(v: ArchViolation) {
  return `${v.type}|${v.file}|${v.line ?? ''}|${v.message}`
}

export function computeRescanDiff(before: GraphNode[], after: GraphNode[]): RescanDiffResult {
  const overallBefore = scoreFromNodes(before)
  const overallAfter = scoreFromNodes(after)

  const afterByPath = new Map<string, GraphNode>()
  for (const n of after) {
    for (const f of n.filesChanged) afterByPath.set(f.path, n)
  }

  const files: FileDiff[] = []

  for (const node of before) {
    if (!node.metrics) continue
    const path = node.filesChanged[0]?.path
    if (!path) continue

    const afterNode = afterByPath.get(path)
    const scoreBefore = node.metrics.overallScore
    const scoreAfter = afterNode?.metrics?.overallScore ?? scoreBefore

    const beforeKeys = new Set(node.metrics.violations.map(violationKey))
    const afterKeys = new Set(afterNode?.metrics?.violations.map(violationKey) ?? [])

    const fixed = node.metrics.violations.filter(v => !afterKeys.has(violationKey(v)))
    const introduced = (afterNode?.metrics?.violations ?? []).filter(v => !beforeKeys.has(violationKey(v)))

    if (fixed.length > 0 || introduced.length > 0 || scoreBefore !== scoreAfter) {
      files.push({ path, scoreBefore, scoreAfter, fixed, introduced })
    }
  }

  return { files, overallBefore, overallAfter }
}

interface Props {
  diff: RescanDiffResult
  onClose: () => void
}

function ScoreBadge({ score, prev }: { score: number; prev?: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{ fontFamily: c.fontMono, fontWeight: 700, color, fontSize: 15 }}>
      {prev !== undefined && prev !== score && (
        <span style={{ color: c.textMuted, fontWeight: 400, marginRight: 4 }}>
          {prev} →
        </span>
      )}
      {score}
    </span>
  )
}

function Delta({ before, after }: { before: number; after: number }) {
  const d = after - before
  if (d === 0) return null
  const color = d > 0 ? '#22c55e' : '#ef4444'
  return (
    <span style={{ fontSize: 12, color, fontWeight: 700, marginLeft: 6 }}>
      {d > 0 ? `+${d}` : `${d}`}
    </span>
  )
}

export function RescanDiff({ diff, onClose }: Props) {
  const { files, overallBefore, overallAfter } = diff
  const totalFixed = files.reduce((s, f) => s + f.fixed.length, 0)
  const totalIntroduced = files.reduce((s, f) => s + f.introduced.length, 0)
  const changed = files.length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 560, maxHeight: '80vh',
        background: c.bg1, border: `1px solid ${c.border}`, borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{
          padding: '22px 26px 18px',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: c.fontSerif, fontSize: 20, fontWeight: 600, color: c.text, fontStyle: 'italic' }}>
              Rescan complete
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>Overall score</span>
              <ScoreBadge score={overallAfter} prev={overallBefore} />
              <Delta before={overallBefore} after={overallAfter} />
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: c.bg3, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', fontSize: 14, padding: '5px 12px', borderRadius: 8, fontFamily: c.fontSans }}
            onMouseEnter={e => { e.currentTarget.style.color = c.text }}
            onMouseLeave={e => { e.currentTarget.style.color = c.textMuted }}
          >
            ✕
          </button>
        </div>

        {/* Summary chips */}
        <div style={{ padding: '14px 26px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          {changed > 0 && (
            <Chip label={`${changed} file${changed !== 1 ? 's' : ''} changed`} color={c.accent} dim={c.accentDim} border={c.accentBorder} />
          )}
          {totalFixed > 0 && (
            <Chip label={`${totalFixed} issue${totalFixed !== 1 ? 's' : ''} fixed`} color="#22c55e" dim="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.25)" />
          )}
          {totalIntroduced > 0 && (
            <Chip label={`${totalIntroduced} new issue${totalIntroduced !== 1 ? 's' : ''}`} color="#ef4444" dim="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.25)" />
          )}
          {changed === 0 && (
            <span style={{ fontSize: 13, color: c.textMuted }}>No changes detected.</span>
          )}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {files.map(f => (
            <FileRow key={f.path} file={f} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, color, dim, border }: { label: string; color: string; dim: string; border: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, color, background: dim,
      border: `1px solid ${border}`, padding: '3px 10px', borderRadius: 20,
    }}>
      {label}
    </span>
  )
}

function FileRow({ file }: { file: FileDiff }) {
  const { path, scoreBefore, scoreAfter, fixed, introduced } = file
  const name = path.split('/').pop()
  const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : ''

  return (
    <div style={{ padding: '14px 26px', borderBottom: `1px solid ${c.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: c.textSub, fontFamily: c.fontMono }}>
          <span style={{ color: c.textMuted, fontSize: 11 }}>{dir}</span>
          <span style={{ color: c.text, fontWeight: 600 }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ScoreBadge score={scoreAfter} prev={scoreBefore} />
          <Delta before={scoreBefore} after={scoreAfter} />
        </div>
      </div>

      {fixed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {fixed.map((v, i) => (
            <div key={i} style={{ fontSize: 12, color: '#22c55e', display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>
              <span style={{ color: c.textMuted }}>{formatMessage(v.message)}</span>
            </div>
          ))}
        </div>
      )}

      {introduced.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: fixed.length > 0 ? 6 : 0 }}>
          {introduced.map((v, i) => (
            <div key={i} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: '#ef4444', opacity: 0.7 }}>✕</span>
              <span style={{ color: c.textMuted }}>{formatMessage(v.message)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatMessage(message: string): string {
  return message.replace(/^[^:]+:\d+\s*[—-]\s*/, '').trim()
}
