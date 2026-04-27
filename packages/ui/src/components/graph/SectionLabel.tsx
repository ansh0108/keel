interface Props {
  data: { label: string; count: number; color: string; width: number }
}

export function SectionLabel({ data }: Props) {
  const { label, count, color, width } = data
  return (
    <div style={{ width, display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', pointerEvents: 'none' }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#3f3f46' }}>
        {count} file{count !== 1 ? 's' : ''}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}18` }} />
    </div>
  )
}
