import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { c, scoreColor } from '../../styles/tokens.js'
import type { GraphNode } from '../../lib/types.js'

interface Props {
  data: { node: GraphNode; branchAccent: string; isRoot?: boolean }
  selected: boolean
}

const EXT_BADGE: Record<string, { bg: string; text: string }> = {
  tsx: { bg: '#0e2e3d', text: '#38bdf8' },
  jsx: { bg: '#0e2e3d', text: '#38bdf8' },
  ts:  { bg: '#0e2042', text: '#818cf8' },
  js:  { bg: '#2d1e00', text: '#fbbf24' },
  css: { bg: '#1e0d3d', text: '#a78bfa' },
}

export const ExecutionNodeCard = memo(function ExecutionNodeCard({ data, selected }: Props) {
  const { node, isRoot } = data

  if (isRoot || node.type === 'session_start') {
    return (
      <div style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 36px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 220,
        cursor: 'default',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: c.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Scan Root
        </span>
        <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 12, height: 12, border: `2px solid ${c.surface}` }} />
      </div>
    )
  }

  const score = node.metrics?.overallScore ?? null
  const violations = node.metrics?.violations ?? []
  const hasError = violations.some((v) => v.severity === 'error')
  const hasWarning = violations.length > 0 && !hasError
  const sc = scoreColor(score)

  const primaryFile = node.filesChanged[0]?.path.split('/').pop() ?? ''
  const ext = primaryFile.split('.').pop() ?? ''
  const badge = EXT_BADGE[ext] ?? { bg: '#1e2d48', text: '#8da0bc' }
  const lineCount = node.metrics?.filesAnalyzed[0]?.lineCount ?? node.filesChanged[0]?.lineCountAfter
  const nameNoExt = primaryFile.replace(new RegExp(`\\.${ext}$`), '')

  const borderColor = selected ? sc : hasError ? '#7a2030' : hasWarning ? '#7a5010' : c.borderLight

  return (
    <div style={{
      background: selected
        ? hasError ? '#1a0e14' : hasWarning ? '#1a1208' : '#0e1a14'
        : c.card,
      border: `1px solid ${borderColor}`,
      borderLeft: `4px solid ${sc}`,
      borderRadius: 12,
      width: 320,
      height: 120,
      padding: '16px 18px',
      cursor: 'pointer',
      boxShadow: selected
        ? `0 0 0 2px ${sc}30, 0 8px 32px #00000060`
        : '0 2px 10px #00000035',
      transition: 'all 150ms ease',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 12, height: 12, border: `2px solid ${c.surface}` }} />

      {/* Top: ext badge + name + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: badge.text, background: badge.bg, padding: '3px 8px', borderRadius: 5, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, flexShrink: 0 }}>
              .{ext}
            </span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
            {nameNoExt}
          </div>
        </div>
        {score !== null && (
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 900, color: sc, letterSpacing: '-0.04em', flexShrink: 0, lineHeight: 1 }}>
            {score}
          </div>
        )}
      </div>

      {/* Bottom: line count + violation status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lineCount != null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: c.textMuted }}>
            {lineCount}L
          </span>
        )}
        {hasError && (
          <span style={{ fontSize: 12, color: c.error, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.error, display: 'inline-block' }} />
            {violations.length} error{violations.length > 1 ? 's' : ''}
          </span>
        )}
        {hasWarning && (
          <span style={{ fontSize: 12, color: c.warning, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.warning, display: 'inline-block' }} />
            {violations.length} warning{violations.length > 1 ? 's' : ''}
          </span>
        )}
        {!hasError && !hasWarning && score !== null && (
          <span style={{ fontSize: 12, color: c.success }}>✓ clean</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 12, height: 12, border: `2px solid ${c.surface}` }} />
    </div>
  )
})
