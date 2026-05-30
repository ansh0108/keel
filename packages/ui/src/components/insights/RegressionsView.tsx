import { api } from '../../lib/api.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { c, scoreColor } from '../../styles/tokens.js'
import type { RegressionsResponse, RegressionEvent, FileTimeline, ArchViolation } from '../../lib/types.js'

interface Props {
  sessionId: string
}

function shortFile(path: string): string {
  return path.split('/').slice(-2).join('/')
}

function ruleLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

export function RegressionsView({ sessionId }: Props) {
  const state = useApiResource<RegressionsResponse>(sessionId, api.sessions.regressions)

  if (state.status === 'loading' || state.status === 'idle') {
    return <Centered text="Tracing regressions…" />
  }
  if (state.status === 'error') {
    return <Centered text={state.message} tone="error" />
  }

  const { regressions, timelines } = state.data

  if (regressions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 40, textAlign: 'center' }}>
        <span style={{ fontFamily: c.fontSerif, fontSize: 22, fontStyle: 'italic', color: c.textSub }}>No regressions</span>
        <span style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.7 }}>
          Every recorded edit in this session held or improved its score.<br />Keel found nothing to blame.
        </span>
      </div>
    )
  }

  const timelineByPath = new Map(timelines.map((t) => [t.path, t]))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px 56px' }} className="fade-in">
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: c.fontSerif, fontSize: 22, fontStyle: 'italic', color: c.text }}>
            {regressions.length} quality regression{regressions.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>
            Each drop is attributed to the exact edit that caused it.
          </div>
        </div>

        {regressions.map((r, i) => (
          <RegressionCard key={`${r.nodeId}-${r.path}-${i}`} event={r} timeline={timelineByPath.get(r.path)} />
        ))}
      </div>
    </div>
  )
}

function RegressionCard({ event, timeline }: { event: RegressionEvent; timeline?: FileTimeline | undefined }) {
  const fromColor = scoreColor(event.fromScore)
  const toColor = scoreColor(event.toScore)
  const when = new Date(event.timestamp).toLocaleString()

  return (
    <div style={{
      background: c.bg1,
      border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${c.error}`,
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: c.fontMono, fontSize: 14, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortFile(event.path)}
          </div>
          <div style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
            via <span style={{ color: c.textSub }}>{event.nodeType.replace(/_/g, ' ')}</span> · {when}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {timeline && timeline.points.length > 1 && <Sparkline timeline={timeline} />}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: c.fontMono, fontSize: 18, fontWeight: 700, color: fromColor, opacity: 0.55, textDecoration: 'line-through' }}>
              {event.fromScore}
            </span>
            <span style={{ color: c.textMuted }}>→</span>
            <span style={{ fontFamily: c.fontMono, fontSize: 26, fontWeight: 700, color: toColor, letterSpacing: '-0.03em' }}>
              {event.toScore}
            </span>
            <span style={{
              fontFamily: c.fontMono,
              fontSize: 13,
              fontWeight: 700,
              color: c.error,
              background: c.errorDim,
              border: `1px solid ${c.errorBorder}`,
              borderRadius: 7,
              padding: '2px 8px',
            }}>
              {event.delta}
            </span>
          </div>
        </div>
      </div>

      {(event.introducedViolations.length > 0 || event.resolvedViolations.length > 0) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {event.introducedViolations.map((v, i) => <ViolationLine key={`i-${i}`} v={v} kind="introduced" />)}
          {event.resolvedViolations.map((v, i) => <ViolationLine key={`r-${i}`} v={v} kind="resolved" />)}
        </div>
      )}
    </div>
  )
}

function ViolationLine({ v, kind }: { v: ArchViolation; kind: 'introduced' | 'resolved' }) {
  const introduced = kind === 'introduced'
  const color = introduced ? (v.severity === 'error' ? c.error : c.warning) : c.success
  const loc = v.line ? `:${v.line}` : ''
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, fontSize: 12.5 }}>
      <span style={{ color, fontFamily: c.fontMono, fontWeight: 700, flexShrink: 0 }}>{introduced ? '+' : '−'}</span>
      <span style={{ color, fontFamily: c.fontMono, fontSize: 12, flexShrink: 0 }}>{ruleLabel(v.type)}{loc}</span>
      <span style={{ color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {introduced ? v.message : 'resolved'}
      </span>
    </div>
  )
}

// Compact SVG sparkline of a file's score history.
function Sparkline({ timeline }: { timeline: FileTimeline }) {
  const W = 76
  const H = 28
  const scores = timeline.points.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const span = max - min || 1
  const stepX = scores.length > 1 ? W / (scores.length - 1) : 0

  const coords = scores.map((s, i) => {
    const x = i * stepX
    const y = H - ((s - min) / span) * (H - 4) - 2
    return [x, y] as const
  })
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]!

  return (
    <svg width={W} height={H} style={{ flexShrink: 0, opacity: 0.9 }}>
      <path d={path} fill="none" stroke={scoreColor(timeline.currentScore)} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={scoreColor(timeline.currentScore)} />
    </svg>
  )
}

function Centered({ text, tone }: { text: string; tone?: 'error' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: tone === 'error' ? c.error : c.textMuted, fontSize: 14 }}>
      {text}
    </div>
  )
}
