import { c, scoreColor } from '../../styles/tokens.js'
import type { Session } from '../../lib/types.js'

const ADJECTIVES = ['amber', 'bold', 'calm', 'deep', 'epic', 'fast', 'gold', 'hazy', 'iron', 'jade', 'keen', 'lean', 'mint', 'neon', 'onyx', 'pale', 'quick', 'rich', 'sage', 'teal', 'ultra', 'vast', 'warm', 'zeal']
const NOUNS = ['audit', 'build', 'check', 'delta', 'epoch', 'flash', 'graph', 'helix', 'index', 'joint', 'klass', 'layer', 'merge', 'nexus', 'orbit', 'patch', 'query', 'relay', 'scope', 'trace', 'union', 'vault', 'wave', 'yield']

function sessionName(id: string): string {
  const hash = id.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0)
  const adj = ADJECTIVES[hash % ADJECTIVES.length]
  const noun = NOUNS[(hash >> 4) % NOUNS.length]
  return `${adj}-${noun}`
}

interface Props {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
  refreshing: boolean
}

export function SessionList({ sessions, selectedId, onSelect, onRefresh, refreshing }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ padding: '6px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>Sessions</span>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh session list"
          style={{ background: 'none', border: 'none', cursor: refreshing ? 'not-allowed' : 'pointer', color: c.textMuted, fontSize: 14, padding: '2px 4px', lineHeight: 1, opacity: refreshing ? 0.5 : 1, transition: 'color 140ms' }}
          onMouseEnter={e => { e.currentTarget.style.color = c.accent }}
          onMouseLeave={e => { e.currentTarget.style.color = c.textMuted }}
        >
          {refreshing ? '…' : '↺'}
        </button>
      </div>
      {sessions.map((s) => (
        <SessionRow key={s.id} session={s} selected={s.id === selectedId} onClick={() => onSelect(s.id)} />
      ))}
    </div>
  )
}

function SessionRow({ session, selected, onClick }: { session: Session; selected: boolean; onClick: () => void }) {
  const date = new Date(session.startedAt)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const isScan = session.filesModified.length > 5

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 24px',
        background: selected ? c.bg3 : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${selected ? c.accent : 'transparent'}`,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'block',
        transition: 'all 140ms ease',
        fontFamily: c.fontSans,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = c.bg2 }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 14,
          color: selected ? c.text : c.textSub,
          fontFamily: c.fontMono,
          fontWeight: selected ? 700 : 500,
        }}>
          {sessionName(session.id)}
        </span>
        {isScan && (
          <span style={{
            fontSize: 10,
            color: c.accent,
            background: c.accentDim,
            border: `1px solid ${c.accentBorder}`,
            padding: '2px 8px',
            borderRadius: 20,
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}>
            SCAN
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: c.textMuted }}>{dateStr} · {time}</div>
      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
        {session.filesModified.length} files
      </div>
    </button>
  )
}
