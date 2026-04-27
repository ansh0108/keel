import { scoreToColor } from '../../lib/graph-utils.js'

interface Props {
  score: number | null
  size?: 'sm' | 'md'
}

export function ScoreBadge({ score, size = 'md' }: Props) {
  const color = scoreToColor(score)
  const label = score !== null ? `${score}` : '—'
  const fontSize = size === 'sm' ? '10px' : '12px'
  const padding = size === 'sm' ? '2px 6px' : '3px 8px'

  return (
    <span
      style={{
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        borderRadius: 4,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize,
        fontWeight: 500,
        padding,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  )
}
