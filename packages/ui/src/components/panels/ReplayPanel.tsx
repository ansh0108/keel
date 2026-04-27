import { useState } from 'react'
import { api } from '../../lib/api.js'
import { c } from '../../styles/tokens.js'
import type { GraphNode } from '../../lib/types.js'

interface Props {
  node: GraphNode
  sessionId: string
  onReplayCreated: (branchId: string) => void
  onClose: () => void
}

export function ReplayPanel({ node, sessionId, onReplayCreated, onClose }: Props) {
  const topViolation = node.metrics?.violations[0] ?? null
  const [rule, setRule] = useState(topViolation?.suggestion ?? '')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)

  async function handleSubmit() {
    if (!rule.trim() || status === 'submitting') return
    setStatus('submitting')
    try {
      const result = await api.replay(sessionId, node.id, {
        rule: rule.slice(0, 120),
        prompt: rule,
      })
      setBranchId(result.branchId)
      setStatus('done')
      onReplayCreated(result.branchId)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  /* ── Success screen ── */
  if (status === 'done' && branchId) {
    return (
      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text, marginBottom: 8 }}>Constraint saved!</div>
          <div style={{ fontSize: 13, color: c.textSub, lineHeight: 1.6 }}>
            Your rule has been written to your project's constraint file.
          </div>
        </div>

        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
            Rule saved
          </div>
          <div style={{ fontSize: 13, color: c.textSub, lineHeight: 1.6, fontStyle: 'italic' }}>
            "{rule}"
          </div>
        </div>

        <div style={{ background: c.accentDim, border: `1px solid ${c.accent}30`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.accent, marginBottom: 10 }}>
            What happens next?
          </div>
          <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Open your terminal in this project',
              'Start a new Claude Code session',
              'Claude will automatically see your new rule',
              'Come back here — a new branch will appear in the graph',
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: c.textSub, lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '13px 0', background: c.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Got it
        </button>
      </div>
    )
  }

  /* ── Form screen ── */
  return (
    <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 6 }}>
            Replay from here
          </div>
          <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.6 }}>
            Write a rule for Claude to follow when it re-generates this file. Keel will inject it at the start of your next session.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: c.card, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', fontSize: 14, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', flexShrink: 0, marginLeft: 12 }}
        >
          ✕
        </button>
      </div>

      {/* Suggestion from violation */}
      {topViolation && (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
            💡 Suggested fix
          </div>
          <div style={{ fontSize: 13, color: c.textSub, lineHeight: 1.6 }}>
            {topViolation.suggestion}
          </div>
        </div>
      )}

      {/* Rule textarea */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textSub, marginBottom: 8 }}>
          Your rule for Claude
        </label>
        <textarea
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          rows={5}
          style={{
            width: '100%',
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            color: c.text,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            padding: '12px 14px',
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.65,
            boxSizing: 'border-box',
            transition: 'border-color 120ms',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = c.accent }}
          onBlur={(e) => { e.currentTarget.style.borderColor = c.border }}
          placeholder="e.g. Keep every file under 300 lines. If a file gets larger, split it into smaller focused modules."
        />
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6 }}>
          Be specific — Claude will follow this exactly.
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '12px 14px', background: c.errorDim, border: `1px solid ${c.errorBorder}`, borderRadius: 8, fontSize: 13, color: c.error }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={status === 'submitting' || !rule.trim()}
        style={{
          width: '100%',
          padding: '14px 0',
          background: status === 'submitting' ? c.border : c.accent,
          border: 'none',
          borderRadius: 10,
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: status === 'submitting' || !rule.trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: !rule.trim() ? 0.5 : 1,
          transition: 'all 150ms',
        }}
      >
        {status === 'submitting' ? (
          <>
            <Spinner /> Saving rule…
          </>
        ) : (
          '→ Apply constraint'
        )}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes rp-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 14, height: 14, border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%', animation: 'rp-spin 0.6s linear infinite' }} />
    </>
  )
}
