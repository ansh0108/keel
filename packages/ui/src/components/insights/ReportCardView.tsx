import { api } from '../../lib/api.js'
import { useApiResource } from '../../hooks/useApiResource.js'
import { c, scoreColor } from '../../styles/tokens.js'
import type { ReportCard, ViolationTally, FileScore } from '../../lib/types.js'

interface Props {
  sessionId: string
}

function shortFile(path: string): string {
  return path.split('/').slice(-2).join('/')
}

function ruleLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

export function ReportCardView({ sessionId }: Props) {
  const state = useApiResource<ReportCard>(sessionId, api.sessions.report)

  if (state.status === 'loading' || state.status === 'idle') {
    return <Centered text="Building report card…" />
  }
  if (state.status === 'error') {
    return <Centered text={state.message} tone="error" />
  }

  const card = state.data
  if (card.nodesAnalyzed === 0) {
    return <Centered text="No analyzed file changes in this session yet." />
  }

  const accent = scoreColor(card.avgScore)
  const maxCount = Math.max(1, ...card.violationsByType.map((v) => v.count))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px 56px' }} className="fade-in">
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <Hero card={card} accent={accent} />

        {/* ── Stat strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <StatCard value={card.filesTouched} label="files touched" color={c.textSub} />
          <StatCard value={card.nodesAnalyzed} label="analyzed edits" color={c.textSub} />
          <StatCard value={card.resolvedCount} label="issues resolved" color={c.success} />
          <StatCard value={card.introducedCount} label="issues introduced" color={card.introducedCount > 0 ? c.warning : c.textSub} />
          <StatCard value={card.regressions.length} label="regressions" color={card.regressions.length > 0 ? c.error : c.success} />
          {(card.hallucinatedImports > 0 || card.orphanedExports > 0) && (
            <StatCard value={card.hallucinatedImports + card.orphanedExports} label="AI slop flags" color={c.rose} />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {card.violationsByType.length > 0 && <TopIssues issues={card.violationsByType} maxCount={maxCount} />}
          {card.worstFiles.length > 0 && <WorstFiles files={card.worstFiles} />}
        </div>
      </div>
    </div>
  )
}

function Hero({ card, accent }: { card: ReportCard; accent: string }) {
  const signed = card.netDelta >= 0 ? `+${card.netDelta}` : `${card.netDelta}`
  const deltaColor = card.netDelta > 0 ? c.success : card.netDelta < 0 ? c.error : c.textMuted

  return (
    <div style={{
      display: 'flex',
      gap: 28,
      alignItems: 'center',
      background: `linear-gradient(135deg, ${c.bg2}, ${c.bg1})`,
      border: `1px solid ${c.border}`,
      borderRadius: 22,
      padding: '32px 34px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    }}>
      {/* Grade badge */}
      <div style={{
        width: 128,
        height: 128,
        borderRadius: 28,
        flexShrink: 0,
        background: `radial-gradient(circle at 30% 25%, ${accent}33, ${c.bg3})`,
        border: `1px solid ${accent}55`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 40px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>
        <span style={{ fontFamily: c.fontSerif, fontSize: 56, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {card.grade}
        </span>
        <span style={{ fontFamily: c.fontMono, fontSize: 12, color: c.textMuted, marginTop: 6 }}>
          {card.avgScore}/100 avg
        </span>
      </div>

      {/* Trajectory + verdict */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
          Quality trajectory
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <TrajScore score={card.startScore} muted />
          <span style={{ color: c.textMuted, fontSize: 18 }}>→</span>
          <TrajScore score={card.endScore} />
          <span style={{
            fontFamily: c.fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: deltaColor,
            background: `${deltaColor}1a`,
            border: `1px solid ${deltaColor}33`,
            borderRadius: 8,
            padding: '3px 10px',
            marginLeft: 4,
          }}>
            {signed}
          </span>
        </div>
        <p style={{ fontFamily: c.fontSerif, fontSize: 17, fontStyle: 'italic', color: c.textSub, lineHeight: 1.5, margin: 0 }}>
          {card.verdict}
        </p>
      </div>
    </div>
  )
}

function TrajScore({ score, muted }: { score: number | null; muted?: boolean }) {
  const color = score === null ? c.textMuted : scoreColor(score)
  return (
    <span style={{
      fontFamily: c.fontMono,
      fontSize: muted ? 22 : 34,
      fontWeight: 700,
      color,
      letterSpacing: '-0.03em',
      opacity: muted ? 0.55 : 1,
    }}>
      {score === null ? 'n/a' : score}
    </span>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: c.bg2,
      border: `1px solid ${c.border}`,
      borderRadius: 14,
      padding: '18px 20px',
    }}>
      <div style={{ fontFamily: c.fontMono, fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
        {label}
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: c.bg1, border: `1px solid ${c.border}`, borderRadius: 16, padding: '22px 24px' }}>
      <div style={{ fontFamily: c.fontSerif, fontSize: 17, fontStyle: 'italic', color: c.text, marginBottom: 18 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function TopIssues({ issues, maxCount }: { issues: ViolationTally[]; maxCount: number }) {
  return (
    <Panel title="Top issues">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.slice(0, 6).map((issue) => (
          <div key={issue.type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: c.textSub, fontFamily: c.fontMono }}>{ruleLabel(issue.type)}</span>
              <span style={{ fontSize: 13, color: c.text, fontWeight: 700, fontFamily: c.fontMono }}>{issue.count}</span>
            </div>
            <div style={{ height: 6, background: c.bg3, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${(issue.count / maxCount) * 100}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${c.accent}, ${c.rose})`,
                borderRadius: 4,
              }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function WorstFiles({ files }: { files: FileScore[] }) {
  return (
    <Panel title="Lowest-scoring files">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {files.map((f) => {
          const color = scoreColor(f.score)
          return (
            <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: c.fontMono,
                fontSize: 13,
                fontWeight: 700,
                color,
                background: `${color}18`,
                border: `1px solid ${color}33`,
                borderRadius: 7,
                padding: '3px 8px',
                minWidth: 44,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {f.score}
              </span>
              <span style={{
                fontFamily: c.fontMono,
                fontSize: 12.5,
                color: c.textSub,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {shortFile(f.path)}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function Centered({ text, tone }: { text: string; tone?: 'error' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: tone === 'error' ? c.error : c.textMuted, fontSize: 14 }}>
      {text}
    </div>
  )
}
