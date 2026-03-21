"use client"

import { useCallback, useMemo } from "react"
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
import "./graph-styles.css"
import { OperatorNode } from "./nodes/operator-node"
import { AccountNode } from "./nodes/account-node"
import { ServiceNode } from "./nodes/service-node"
import { GlowingEdge } from "./edges/glowing-edge"

const nodeTypes: NodeTypes = {
  operator: OperatorNode,
  account: AccountNode,
  service: ServiceNode,
}

const edgeTypes: EdgeTypes = {
  glowing: GlowingEdge,
}

type Props = {
  initialNodes: Node[]
  initialEdges: Edge[]
}

export function OperatorGraph({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes/edges when data changes
  useMemo(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  return (
    <div className="w-full h-full" style={{ minHeight: "calc(100vh - 8rem)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: false,
        }}
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
            if (node.type === "operator") return "#ef4444"
            if (node.type === "account") return "#6B7280"
            if (node.type === "service") {
              return (node.data as any)?.active ? "#eab308" : "#525252"
            }
            return "#6B7280"
          }}
          maskColor="rgba(0,0,0,0.6)"
          className="!rounded-md"
        />
      </ReactFlow>
    </div>
  )
}
