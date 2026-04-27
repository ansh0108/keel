import { scoreToColor } from '../../lib/graph-utils.js'
import type { ArchViolation } from '../../lib/types.js'

export function ViolationCard({ violation }: { violation: ArchViolation }) {
  const color = scoreToColor(violation.severity === 'error' ? 20 : 55)

  return (
    <div style={{ background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color, fontSize: 12 }}>⚠</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {violation.type.replace(/_/g, ' ')}
        </span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#d4d4d8', lineHeight: 1.5 }}>
        {violation.message}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#71717a', lineHeight: 1.5, borderTop: '1px solid #27272a', paddingTop: 8 }}>
        {violation.suggestion}
      </p>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
      {children}
    </div>
  )
}
