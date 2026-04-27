import { ReactFlow, Controls, Background, BackgroundVariant } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ExecutionNodeCard } from './ExecutionNodeCard.js'
import { buildFlowGraph, computeScanStats, scoreColor, isScanSession } from '../../lib/graph-utils.js'
import { c } from '../../styles/tokens.js'
import type { GraphNode } from '../../lib/types.js'

const nodeTypes = { executionNode: ExecutionNodeCard }

interface Props {
  nodes: GraphNode[]
  selectedNodeId: string | null
  onNodeClick: (nodeId: string) => void
}

export function ExecutionGraph({ nodes, selectedNodeId, onNodeClick }: Props) {
  const { flowNodes, flowEdges } = buildFlowGraph(nodes)
  const stats = computeScanStats(nodes)
  const scan = isScanSession(nodes)
  const sc = scoreColor(stats.avgScore)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: 70,
        borderBottom: `1px solid ${c.border}`,
        background: c.bg1,
        display: 'flex',
        alignItems: 'center',
        padding: '0 36px',
        gap: 0,
        flexShrink: 0,
      }}>
        {scan ? (
          <>
            <Stat value={stats.total} label="files scanned" color={c.textSub} />
            <Divider />
            <Stat value={stats.avgScore} label="quality score" color={sc} large />
            {stats.errors > 0 && <><Divider /><Stat value={stats.errors} label="errors" color={c.error} /></>}
            {stats.warnings > 0 && <><Divider /><Stat value={stats.warnings} label="warnings" color={c.warning} /></>}
            <Divider />
            <Stat value={stats.clean} label="clean" color={c.success} />
            <div style={{ marginLeft: 'auto', fontSize: 12, color: c.textMuted }}>Click any file to inspect →</div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: c.textSub }}>Execution graph — click a node to inspect</div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={flowNodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            const nd = node.data as { node?: { type?: string } }
            if (nd?.node?.type === 'session_start') return
            onNodeClick(node.id)
          }}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 0.85 }}
          minZoom={0.05}
          maxZoom={2}
          style={{ background: c.bg }}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background color={c.bg3} variant={BackgroundVariant.Dots} gap={28} size={1.2} />
          <Controls style={{ background: c.bg2, border: `1px solid ${c.border}`, borderRadius: 10 }} />
        </ReactFlow>
      </div>
    </div>
  )
}

function Stat({ value, label, color, large }: { value: number; label: string; color: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 28px' }}>
      <span style={{ fontFamily: c.fontMono, fontSize: large ? 28 : 20, fontWeight: 700, color, letterSpacing: '-0.03em' }}>{value}</span>
      <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: c.border, flexShrink: 0 }} />
}
