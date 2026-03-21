"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./attack-path-styles.css"
import {
  UserNode,
  GroupNode,
  RoleNode,
  ServiceAccountNode,
  DomainNode,
} from "./attack-path-nodes"
import { AttackPathEdge } from "./attack-path-edges"
import {
  NODE_COLORS,
  type AttackPathNode as APNode,
  type AttackPathEdge as APEdge,
  type AttackPath,
} from "@/lib/audit/attack-path-builder"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const nodeTypes: NodeTypes = {
  user: UserNode,
  group: GroupNode,
  role: RoleNode,
  "service-account": ServiceAccountNode,
  domain: DomainNode,
}

const edgeTypes: EdgeTypes = {
  "attack-path": AttackPathEdge,
}

// ── Layout helpers ───────────────────────────────────────────────────

function buildReactFlowData(
  apNodes: APNode[],
  apEdges: APEdge[],
  highlightedPathNodeIds: Set<string>,
  highlightedPathEdgeIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  // Group nodes by type for layered layout
  const domainNodes = apNodes.filter((n) => n.type === "domain")
  const roleNodes = apNodes.filter((n) => n.type === "role")
  const saNodes = apNodes.filter((n) => n.type === "service-account")
  const groupNodes = apNodes.filter((n) => n.type === "group")
  const userNodes = apNodes.filter((n) => n.type === "user")

  // Layered layout: domain at top, then roles, groups, service-accounts, users at bottom
  const layers: { nodes: APNode[]; y: number }[] = [
    { nodes: domainNodes, y: 0 },
    { nodes: roleNodes, y: 180 },
    { nodes: groupNodes, y: 360 },
    { nodes: saNodes, y: 540 },
    { nodes: userNodes, y: 720 },
  ]

  const nodePositions = new Map<string, { x: number; y: number }>()

  for (const layer of layers) {
    const count = layer.nodes.length
    if (count === 0) continue
    const spacing = Math.max(140, 800 / count)
    const totalWidth = (count - 1) * spacing
    const startX = -totalWidth / 2

    for (let i = 0; i < count; i++) {
      nodePositions.set(layer.nodes[i].id, {
        x: startX + i * spacing,
        y: layer.y,
      })
    }
  }

  const nodes: Node[] = apNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: nodePositions.get(n.id) ?? { x: 0, y: 0 },
    data: {
      label: n.label,
      nodeType: n.type,
      riskScore: n.riskScore,
      riskFactors: n.riskFactors,
      metadata: n.metadata,
    },
    draggable: true,
    style: highlightedPathNodeIds.size > 0 && !highlightedPathNodeIds.has(n.id)
      ? { opacity: 0.3 }
      : undefined,
  }))

  const edges: Edge[] = apEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "attack-path",
    data: {
      edgeType: e.type,
      riskWeight: e.riskWeight,
      highlighted: highlightedPathEdgeIds.has(e.id),
    },
    style: highlightedPathEdgeIds.size > 0 && !highlightedPathEdgeIds.has(e.id)
      ? { opacity: 0.15 }
      : undefined,
  }))

  return { nodes, edges }
}

// ── Severity badge colors ────────────────────────────────────────────

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
}

// ── Component ────────────────────────────────────────────────────────

type Props = {
  attackNodes: APNode[]
  attackEdges: APEdge[]
  highlightedPaths: AttackPath[]
  onNodeClick?: (node: APNode) => void
}

export function AttackPathGraph({
  attackNodes,
  attackEdges,
  highlightedPaths,
  onNodeClick,
}: Props) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)

  // Compute which nodes/edges to highlight based on selected path
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    if (!selectedPathId) return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>() }
    const path = highlightedPaths.find((p) => p.id === selectedPathId)
    if (!path) return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>() }

    const nodeSet = new Set(path.nodeIds)
    // Find edges connecting nodes in the path
    const edgeSet = new Set<string>()
    for (const e of attackEdges) {
      if (nodeSet.has(e.source) && nodeSet.has(e.target)) {
        edgeSet.add(e.id)
      }
    }
    return { highlightedNodeIds: nodeSet, highlightedEdgeIds: edgeSet }
  }, [selectedPathId, highlightedPaths, attackEdges])

  const { nodes: rfNodes, edges: rfEdges } = useMemo(
    () => buildReactFlowData(attackNodes, attackEdges, highlightedNodeIds, highlightedEdgeIds),
    [attackNodes, attackEdges, highlightedNodeIds, highlightedEdgeIds],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync when data changes
  useMemo(() => {
    setNodes(rfNodes)
    setEdges(rfEdges)
  }, [rfNodes, rfEdges, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const apNode = attackNodes.find((n) => n.id === node.id)
      if (apNode && onNodeClick) onNodeClick(apNode)
    },
    [attackNodes, onNodeClick],
  )

  return (
    <div className="attack-path-graph w-full h-full relative" style={{ minHeight: "calc(100vh - 12rem)" }}>
      {/* Path sidebar overlay */}
      {highlightedPaths.length > 0 && (
        <div className="absolute top-3 left-3 z-10 w-72 max-h-[calc(100%-24px)] overflow-y-auto rounded-lg border border-border/80 bg-card/95 backdrop-blur-sm shadow-xl">
          <div className="px-3 py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-foreground">
                Attack Paths ({highlightedPaths.length})
              </span>
            </div>
          </div>
          <div className="p-1.5 flex flex-col gap-1">
            {highlightedPaths.map((path) => {
              const isActive = selectedPathId === path.id
              return (
                <button
                  key={path.id}
                  type="button"
                  className={`w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-muted/80 border border-border"
                      : "hover:bg-muted/40 border border-transparent"
                  }`}
                  onClick={() => setSelectedPathId(isActive ? null : path.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 ${SEVERITY_CLASSES[path.severity]}`}
                    >
                      {path.severity}
                    </Badge>
                    <span className="font-medium text-foreground truncate flex-1">
                      {path.label}
                    </span>
                  </div>
                  {isActive && (
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {path.description}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ animated: false }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !rounded-md !shadow-md"
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const t = node.type as keyof typeof NODE_COLORS | undefined
            return t && t in NODE_COLORS ? NODE_COLORS[t] : "#6B7280"
          }}
          maskColor="rgba(0,0,0,0.6)"
          className="!rounded-md"
        />
      </ReactFlow>
    </div>
  )
}
