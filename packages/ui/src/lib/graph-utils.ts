import type { Node, Edge } from '@xyflow/react'
import type { GraphNode } from './types.js'
import { scoreColor } from '../styles/tokens.js'

export { scoreColor }

export function isScanSession(nodes: GraphNode[]): boolean {
  const nonRoot = nodes.filter((n) => n.parentId !== null)
  if (nonRoot.length < 3) return false
  return nonRoot.every((n) => n.branchId === 'baseline')
}

export function computeScanStats(nodes: GraphNode[]) {
  const files = nodes.filter((n) => n.parentId !== null)
  const errors = files.filter((n) => n.metrics?.violations.some((v) => v.severity === 'error'))
  const warnings = files.filter((n) => !errors.includes(n) && (n.metrics?.violations.length ?? 0) > 0)
  const clean = files.length - errors.length - warnings.length
  const avgScore = files.length
    ? Math.round(files.reduce((s, n) => s + (n.metrics?.overallScore ?? 100), 0) / files.length)
    : 100
  return { total: files.length, errors: errors.length, warnings: warnings.length, clean, avgScore }
}

const BRANCH_COLORS = ['#6c8aff', '#0ea5e9', '#f59e0b', '#ec4899', '#14b8a6']
function branchColor(branchId: string): string {
  if (branchId === 'main' || branchId === 'baseline') return '#4e6285'
  let hash = 0
  for (let i = 0; i < branchId.length; i++) hash = (hash * 31 + branchId.charCodeAt(i)) >>> 0
  return BRANCH_COLORS[hash % BRANCH_COLORS.length] ?? '#6c8aff'
}

// ── Scan layout: 4-col grid, errors→warnings→clean, root above ──
const SCAN_W = 320
const SCAN_H = 120
const SCAN_GAP_X = 28
const SCAN_GAP_Y = 24
const SCAN_COLS = 4

export function buildFlowGraph(nodes: GraphNode[]): { flowNodes: Node[]; flowEdges: Edge[] } {
  return isScanSession(nodes) ? buildScanLayout(nodes) : buildTreeLayout(nodes)
}

function buildScanLayout(nodes: GraphNode[]): { flowNodes: Node[]; flowEdges: Edge[] } {
  const root = nodes.find((n) => n.parentId === null)
  const files = nodes.filter((n) => n.parentId !== null)

  const errors = files.filter((n) => n.metrics?.violations.some((v) => v.severity === 'error'))
  const warnings = files.filter((n) => !errors.includes(n) && (n.metrics?.violations.length ?? 0) > 0)
  const clean = files.filter((n) => !errors.includes(n) && !warnings.includes(n))
  const sorted = [...errors, ...warnings, ...clean]

  const totalW = SCAN_COLS * SCAN_W + (SCAN_COLS - 1) * SCAN_GAP_X
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  if (root) {
    flowNodes.push({
      id: root.id,
      type: 'executionNode',
      position: { x: totalW / 2 - 120, y: 0 },
      data: { node: root, branchAccent: '#4e6285', isRoot: true },
    })
  }

  const FILE_Y = 140

  sorted.forEach((node, i) => {
    const col = i % SCAN_COLS
    const row = Math.floor(i / SCAN_COLS)
    const x = col * (SCAN_W + SCAN_GAP_X)
    const y = FILE_Y + row * (SCAN_H + SCAN_GAP_Y)

    flowNodes.push({
      id: node.id,
      type: 'executionNode',
      position: { x, y },
      data: { node, branchAccent: scoreColor(node.metrics?.overallScore ?? null) },
    })

    if (root) {
      const hasViol = (node.metrics?.violations.length ?? 0) > 0
      flowEdges.push({
        id: `${root.id}-${node.id}`,
        source: root.id,
        target: node.id,
        style: {
          stroke: hasViol ? scoreColor(node.metrics?.overallScore ?? null) : '#253352',
          strokeWidth: hasViol ? 1.5 : 1,
          opacity: hasViol ? 0.6 : 0.3,
        },
      })
    }
  })

  return { flowNodes, flowEdges }
}

function buildTreeLayout(nodes: GraphNode[]): { flowNodes: Node[]; flowEdges: Edge[] } {
  const NODE_W = 280
  const V_GAP = 120
  const H_GAP = 80
  const depthMap = new Map<string, number>()
  const branchOffsets = new Map<string, number>()
  let nextBranchX = 0

  const roots = nodes.filter((n) => n.parentId === null)
  const queue = roots.map((n) => ({ node: n, depth: 0 }))
  while (queue.length > 0) {
    const item = queue.shift()!
    depthMap.set(item.node.id, item.depth)
    nodes.filter((n) => n.parentId === item.node.id).forEach((c) =>
      queue.push({ node: c, depth: item.depth + 1 })
    )
  }
  for (const node of nodes) {
    if (!branchOffsets.has(node.branchId)) {
      branchOffsets.set(node.branchId, nextBranchX)
      nextBranchX += NODE_W + H_GAP
    }
  }

  const flowNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    type: 'executionNode',
    position: {
      x: branchOffsets.get(node.branchId) ?? 0,
      y: (depthMap.get(node.id) ?? 0) * V_GAP,
    },
    data: { node, branchAccent: branchColor(node.branchId) },
  }))

  const flowEdges: Edge[] = nodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId as string,
      target: n.id,
      style: { stroke: branchColor(n.branchId), strokeWidth: 2 },
    }))

  return { flowNodes, flowEdges }
}
