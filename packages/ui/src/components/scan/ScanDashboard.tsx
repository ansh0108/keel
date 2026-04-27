import { scoreToColor, computeScanStats } from '../../lib/graph-utils.js'
import type { GraphNode, ArchViolation } from '../../lib/types.js'

interface Props {
  nodes: GraphNode[]
  selectedNodeId: string | null
  onNodeClick: (id: string) => void
}

export function ScanDashboard({ nodes, selectedNodeId, onNodeClick }: Props) {
  const files = nodes.filter((n) => n.parentId !== null)
  const errors = files.filter((n) => n.metrics?.violations.some((v) => v.severity === 'error'))
  const warnings = files.filter((n) => !errors.includes(n) && (n.metrics?.violations.length ?? 0) > 0)
  const clean = files.filter((n) => !errors.includes(n) && !warnings.includes(n))
  const stats = computeScanStats(nodes)
  const scoreColor = scoreToColor(stats.avgScore)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0d0d12' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '44px 48px 80px' }}>

        {/* ─── Hero ─────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, marginBottom: 56 }}>
          <ScoreRing score={stats.avgScore} />
          <div>
            <div style={{ fontSize: 11, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
              Project health score
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, color: scoreColor, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
              {stats.avgScore}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#52525b' }}>
              {stats.total} files scanned
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 36 }}>
            <BigStat value={stats.errors} label="errors" color="#ef4444" />
            <BigStat value={stats.warnings} label="warnings" color="#f59e0b" />
            <BigStat value={stats.clean} label="clean" color="#22c55e" />
          </div>
        </div>

        {/* ─── Errors ───────────────────────────────────── */}
        {errors.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHead label="Errors" count={errors.length} color="#ef4444" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {errors.map((n) => (
                <ErrorCard key={n.id} node={n} selected={n.id === selectedNodeId} onClick={() => onNodeClick(n.id)} />
              ))}
            </div>
          </section>
        )}

        {/* ─── Warnings ─────────────────────────────────── */}
        {warnings.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHead label="Warnings" count={warnings.length} color="#f59e0b" />
            <div style={{ display: 'grid', gridTemplateColumns: warnings.length === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
              {warnings.map((n) => (
                <WarningCard key={n.id} node={n} selected={n.id === selectedNodeId} onClick={() => onNodeClick(n.id)} />
              ))}
            </div>
          </section>
        )}

        {/* ─── Clean ────────────────────────────────────── */}
        {clean.length > 0 && (
          <section>
            <SectionHead label="Clean" count={clean.length} color="#22c55e" />
            <div style={{ border: '1px solid #1a1a20', borderRadius: 10, overflow: 'hidden' }}>
              {clean.map((n, i) => (
                <CleanRow
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => onNodeClick(n.id)}
                  last={i === clean.length - 1}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Score ring SVG ──────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const color = scoreToColor(score)
  return (
    <svg width="108" height="108" viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
      <circle cx="54" cy="54" r={r} fill="none" stroke="#1a1a20" strokeWidth="7" />
      <circle
        cx="54" cy="54" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 54 54)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Big stat number ──────────────────────────────────────────────
function BigStat({ value, label, color }: { value: number; label: string; color: string }) {
  if (value === 0) return null
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
        {label}
      </div>
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────
function SectionHead({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: '#3f3f46', fontFamily: 'JetBrains Mono, monospace' }}>
        {count} file{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ── Error card (full width, prominent) ──────────────────────────
function ErrorCard({ node, selected, onClick }: { node: GraphNode; selected: boolean; onClick: () => void }) {
  const score = node.metrics?.overallScore ?? 0
  const violations = node.metrics?.violations ?? []
  const file = node.filesChanged[0]
  const fileName = file?.path.split('/').pop() ?? ''
  const filePath = file?.path.split('/').slice(-3, -1).join('/') ?? ''
  const lineCount = node.metrics?.filesAnalyzed[0]?.lineCount ?? file?.lineCountAfter

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected ? '#1c0e0e' : '#130a0a',
        border: `1px solid ${selected ? '#ef444455' : '#ef444420'}`,
        borderLeft: '3px solid #ef4444',
        borderRadius: 10,
        padding: '22px 26px',
        cursor: 'pointer',
        transition: 'all 140ms',
        boxShadow: selected ? '0 0 0 1px #ef444430' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#f0f0f2' }}>
              {fileName}
            </span>
            {lineCount !== null && lineCount !== undefined && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#52525b', background: '#1a1a20', padding: '2px 7px', borderRadius: 4 }}>
                {lineCount}L
              </span>
            )}
          </div>
          {filePath && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3f3f46' }}>
              {filePath}/
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: 10, color: '#7f1d1d', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>score</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: '#ef4444', borderRadius: 2 }} />
      </div>

      {violations.map((v, i) => <ViolationInline key={i} violation={v} />)}
    </button>
  )
}

// ── Warning card (2-column grid) ─────────────────────────────────
function WarningCard({ node, selected, onClick }: { node: GraphNode; selected: boolean; onClick: () => void }) {
  const score = node.metrics?.overallScore ?? 0
  const violations = node.metrics?.violations ?? []
  const file = node.filesChanged[0]
  const fileName = file?.path.split('/').pop() ?? ''
  const lineCount = node.metrics?.filesAnalyzed[0]?.lineCount ?? file?.lineCountAfter

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected ? '#161006' : '#0f0c05',
        border: `1px solid ${selected ? '#f59e0b44' : '#f59e0b18'}`,
        borderLeft: '3px solid #f59e0b',
        borderRadius: 10,
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'all 140ms',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#f0f0f2', marginBottom: 4 }}>
            {fileName}
          </div>
          {lineCount !== null && lineCount !== undefined && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#52525b' }}>
              {lineCount} lines
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.04em' }}>
          {score}
        </div>
      </div>
      <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: '#f59e0b', borderRadius: 2 }} />
      </div>
      {violations.slice(0, 1).map((v, i) => (
        <div key={i} style={{ fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>
          {v.message}
        </div>
      ))}
    </button>
  )
}

// ── Clean file row (table style) ─────────────────────────────────
function CleanRow({ node, selected, onClick, last }: { node: GraphNode; selected: boolean; onClick: () => void; last: boolean }) {
  const score = node.metrics?.overallScore ?? 100
  const file = node.filesChanged[0]
  const fileName = file?.path.split('/').pop() ?? ''
  const ext = fileName.split('.').pop() ?? ''
  const lineCount = node.metrics?.filesAnalyzed[0]?.lineCount ?? file?.lineCountAfter

  const extColor: Record<string, string> = { tsx: '#38bdf8', jsx: '#38bdf8', ts: '#60a5fa', js: '#fbbf24', css: '#a78bfa' }
  const ec = extColor[ext] ?? '#71717a'

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        background: selected ? '#111118' : 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid #1a1a20',
        cursor: 'pointer',
        transition: 'background 100ms',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#0f0f15' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: ec, background: `${ec}14`, border: `1px solid ${ec}22`, borderRadius: 3, padding: '2px 5px', flexShrink: 0 }}>
        .{ext}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: selected ? '#f0f0f2' : '#a1a1aa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </span>
      {lineCount !== null && lineCount !== undefined && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3f3f46', flexShrink: 0 }}>
          {lineCount}L
        </span>
      )}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#22c55e', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
        {score}
      </span>
      <span style={{ color: '#22c55e', fontSize: 11, flexShrink: 0 }}>✓</span>
    </button>
  )
}

// ── Inline violation text ────────────────────────────────────────
function ViolationInline({ violation }: { violation: ArchViolation }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {violation.type.replace(/_/g, ' ')}
      </div>
      <div style={{ fontSize: 13, color: '#a8a29e', lineHeight: 1.6, marginBottom: 6 }}>
        {violation.message}
      </div>
      <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.6 }}>
        {violation.suggestion}
      </div>
    </div>
  )
}
