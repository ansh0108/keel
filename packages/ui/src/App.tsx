import { useState, useEffect, useRef } from 'react'
import { useSessions } from './hooks/useSessions.js'
import { useSessionGraph } from './hooks/useSessionGraph.js'
import { SessionList } from './components/panels/SessionList.js'
import { ExecutionGraph } from './components/graph/ExecutionGraph.js'
import { ScanView } from './components/scan/ScanView.js'
import { NodeDetail } from './components/panels/NodeDetail.js'
import { isScanSession, computeScanStats } from './lib/graph-utils.js'
import { c, globalStyles } from './styles/tokens.js'
import type { GraphNode, ArchViolation } from './lib/types.js'

export interface FileDiff {
  scoreBefore: number
  fixed: ArchViolation[]
}

function violationKey(v: ArchViolation) {
  return `${v.type}|${v.file}|${v.line ?? ''}|${v.message}`
}

export function App() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null)
  const [scanScoreBefore, setScanScoreBefore] = useState<number | null>(null)

  // Before-snapshot of nodes + which file path we were viewing when rescan was triggered
  const beforeSnapshotRef = useRef<GraphNode[] | null>(null)
  const pendingFilePathRef = useRef<string | null>(null)
  const pendingSessionRef = useRef<string | null>(null)

  const sessionsState = useSessions()
  const graphState = useSessionGraph(selectedSessionId)

  const selectedNode: GraphNode | null =
    graphState.status === 'success'
      ? (graphState.data.nodes.find((n) => n.id === selectedNodeId) ?? null)
      : null

  // Once the new session finishes loading after a rescan, find the matching file node,
  // select it, and compute the per-file diff for display in the panel.
  // We gate on graphState.data.session.id to avoid firing with stale data from the
  // previous session while useSessionGraph is still transitioning to 'loading'.
  useEffect(() => {
    if (graphState.status !== 'success') return
    if (!beforeSnapshotRef.current || !pendingSessionRef.current || !pendingFilePathRef.current) return
    if (graphState.data.session.id !== pendingSessionRef.current) return

    const filePath = pendingFilePathRef.current
    const oldNodes = beforeSnapshotRef.current

    // Find the old and new nodes for this file
    const oldNode = oldNodes.find(n => n.filesChanged.some(f => f.path === filePath))
    const newNode = graphState.data.nodes.find(n => n.filesChanged.some(f => f.path === filePath))

    if (newNode) {
      setSelectedNodeId(newNode.id)

      if (oldNode?.metrics && newNode.metrics) {
        const afterKeys = new Set(newNode.metrics.violations.map(violationKey))
        const fixed = oldNode.metrics.violations.filter(v => !afterKeys.has(violationKey(v)))
        setFileDiff({ scoreBefore: oldNode.metrics.overallScore, fixed })
      }
    }

    beforeSnapshotRef.current = null
    pendingFilePathRef.current = null
    pendingSessionRef.current = null
  }, [graphState])

  function handleScanRescan(newSessionId: string) {
    if (graphState.status === 'success') {
      setScanScoreBefore(computeScanStats(graphState.data.nodes).avgScore)
    }
    setFileDiff(null)
    setSelectedNodeId(null)
    sessionsState.reload()
    setSelectedSessionId(newSessionId)
  }

  function handleRescan(newSessionId: string, currentFilePath: string) {
    if (graphState.status === 'success') {
      beforeSnapshotRef.current = graphState.data.nodes
    }
    pendingFilePathRef.current = currentFilePath
    pendingSessionRef.current = newSessionId
    setFileDiff(null)
    sessionsState.reload()
    setSelectedSessionId(newSessionId)
    // Don't clear selectedNodeId — the effect above will swap it to the matching new node
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{
        display: 'flex',
        height: '100vh',
        background: c.bg,
        color: c.text,
        fontFamily: c.fontSans,
        overflow: 'hidden',
        fontSize: 14,
      }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 272,
          borderRight: `1px solid ${c.border}`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: c.bg1,
        }}>
          {/* Logo */}
          <div style={{
            padding: '22px 24px 20px',
            borderBottom: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 13,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #818cf8, #f472b6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 18px rgba(129,140,248,0.35)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2.5" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: c.fontSerif, fontSize: 20, fontWeight: 700, color: c.text, letterSpacing: '-0.01em', lineHeight: 1 }}>
                keel
              </div>
              <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3, letterSpacing: '0.01em' }}>
                code quality
              </div>
            </div>
          </div>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sessionsState.status === 'loading' && (
              <div style={{ padding: '24px', fontSize: 13, color: c.textMuted }}>Loading…</div>
            )}
            {sessionsState.status === 'error' && (
              <div style={{ padding: '24px', fontSize: 13, color: c.error }}>{sessionsState.message}</div>
            )}
            {sessionsState.status === 'success' && (
              sessionsState.sessions.length === 0
                ? <EmptySessions onRefresh={sessionsState.reload} />
                : <SessionList
                    sessions={sessionsState.sessions}
                    selectedId={selectedSessionId}
                    onSelect={(id) => { setSelectedSessionId(id); setSelectedNodeId(null); setFileDiff(null); setScanScoreBefore(null) }}
                    onRefresh={sessionsState.reload}
                    refreshing={false}
                  />
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.7 }}>
              Run <code style={{ color: c.accent, fontFamily: c.fontMono, fontSize: 11 }}>keel scan</code> to analyze,{' '}
              or <code style={{ color: c.accent, fontFamily: c.fontMono, fontSize: 11 }}>keel init</code> to record.
            </div>
          </div>
        </aside>

        {/* ── Main canvas ── */}
        <main style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedSessionId && <EmptyState />}

          {graphState.status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <Spinner />
              <span style={{ fontSize: 14, color: c.textMuted }}>Loading session…</span>
            </div>
          )}
          {graphState.status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: c.textMuted, fontSize: 14 }}>
              {graphState.message}
            </div>
          )}
          {graphState.status === 'success' && (
            isScanSession(graphState.data.nodes)
              ? <ScanView nodes={graphState.data.nodes} selectedNodeId={selectedNodeId} onNodeClick={setSelectedNodeId} onRescan={handleScanRescan} scoreBefore={scanScoreBefore} />
              : <ExecutionGraph nodes={graphState.data.nodes} selectedNodeId={selectedNodeId} onNodeClick={setSelectedNodeId} />
          )}
        </main>

        {/* ── Detail panel ── */}
        {selectedNode && (
          <aside style={{
            width: 420,
            borderLeft: `1px solid ${c.border}`,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: c.bg1,
          }}>
            <div style={{
              padding: '20px 26px',
              borderBottom: `1px solid ${c.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: c.fontSerif, fontSize: 18, fontWeight: 500, color: c.text, fontStyle: 'italic' }}>
                File details
              </span>
              <button
                onClick={() => setSelectedNodeId(null)}
                style={{ background: c.bg3, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', fontSize: 14, padding: '5px 12px', borderRadius: 8, transition: 'all 130ms', fontFamily: c.fontSans }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderHover; e.currentTarget.style.color = c.text }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <NodeDetail
                node={selectedNode}
                sessionId={selectedSessionId!}
                fileDiff={fileDiff}
                onRescan={(newSessionId, filePath) => handleRescan(newSessionId, filePath)}
                onDiffDismiss={() => setFileDiff(null)}
              />
            </div>
          </aside>
        )}
      </div>

    </>
  )
}

function EmptySessions({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div style={{ padding: '28px 24px', fontSize: 13, color: c.textMuted, lineHeight: 1.8 }}>
      No scans yet.<br /><br />
      Run in your project terminal:<br />
      <code style={{ fontFamily: c.fontMono, color: c.accent, fontSize: 12 }}>keel scan</code>
      <br /><br />
      <button
        onClick={onRefresh}
        style={{ background: c.accentDim, border: `1px solid ${c.accentBorder}`, borderRadius: 8, color: c.accent, fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        ↺ Check for scans
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
      <div style={{
        width: 72,
        height: 72,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: c.bg2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <path d="M15 2L27 9V21L15 28L3 21V9L15 2Z" stroke={c.textMuted} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
          <circle cx="15" cy="15" r="4.5" fill={c.textMuted} opacity="0.5"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px', fontFamily: c.fontSerif, fontSize: 22, color: c.textSub, fontWeight: 500, fontStyle: 'italic' }}>
          Select a session
        </p>
        <p style={{ margin: 0, fontSize: 13, color: c.textMuted, lineHeight: 1.7 }}>
          Choose a session from the sidebar<br />to view your code quality report.
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes kspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 26, height: 26, border: `2px solid ${c.border}`, borderTopColor: c.accent, borderRadius: '50%', animation: 'kspin 0.7s linear infinite' }} />
    </>
  )
}
