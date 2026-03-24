"use client"

import { useState, useCallback } from "react"
import { Share2, RefreshCw, Download } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useGraphData } from "@/hooks/use-graph-data"
import { OperatorGraph } from "@/components/graph/operator-graph"
import { useAuditAttackPaths } from "@/hooks/use-audit-attack-paths"
import { AttackPathGraph } from "@/components/audit/attack-path/attack-path-graph"
import { NODE_COLORS, type AttackPathNode } from "@/lib/audit/attack-path-builder"
import { useAttackGraph } from "@/hooks/use-attack-graph"
import { FilterPanel } from "@/components/studio/attack-graph/filter-panel"
import { GraphCanvas } from "@/components/studio/attack-graph/graph-canvas"
import { DetailPanel } from "@/components/studio/attack-graph/detail-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

function NodeDetailPanel({
  node,
  onClose,
}: {
  node: AttackPathNode
  onClose: () => void
}) {
  const color = NODE_COLORS[node.type] ?? "#6B7280"

  return (
    <div className="absolute top-3 right-3 z-10 w-80 rounded-lg border border-border/80 bg-card/95 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-foreground capitalize">
            {node.type.replace("-", " ")}
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <span className="text-sm font-medium text-foreground">{node.label}</span>
        {node.riskScore != null && node.riskScore > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk Score</span>
            <Badge variant="outline" className={`text-[10px] ${node.riskScore >= 70 ? "text-red-400 border-red-500/30" : node.riskScore >= 40 ? "text-amber-400 border-amber-500/30" : "text-blue-400 border-blue-500/30"}`}>
              {node.riskScore}
            </Badge>
          </div>
        )}
        {node.riskFactors && node.riskFactors.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk Factors</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {node.riskFactors.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px] text-red-400 border-red-500/20 bg-red-500/10">{f}</Badge>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Details</span>
          <div className="mt-1 space-y-1">
            {Object.entries(node.metadata).map(([key, value]) => {
              if (value === undefined || value === null) return null
              const displayValue = Array.isArray(value)
                ? value.length > 3 ? `${value.slice(0, 3).join(", ")} +${value.length - 3} more` : value.join(", ")
                : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
              return (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground min-w-[80px] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="text-[10px] text-foreground break-all">{displayValue}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function OperatorTab() {
  const { nodes, edges, loading, error, refetch } = useGraphData()

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
      <div className="flex items-center justify-between shrink-0 px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Operator Graph</span>
          {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading sessions...</span>}
        </div>
        <Button variant="ghost" size="xs" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {error && <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 shrink-0">{error}</div>}
      <div className="flex-1 min-h-0">
        <OperatorGraph initialNodes={nodes} initialEdges={edges} />
      </div>
    </div>
  )
}

function AttackPathsTab() {
  const { nodes, edges, highlightedPaths, loading, error } = useAuditAttackPaths()
  const [selectedNode, setSelectedNode] = useState<AttackPathNode | null>(null)

  if (error) {
    return (
      <Card className="border-destructive/50 m-4">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium">Unable to load attack path data</p>
            <p className="text-sm text-muted-foreground">
              {error.includes("403") || error.includes("Authorized") ? "Admin permissions are required." : error}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="flex-1 min-h-[400px] rounded-lg" />
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Share2 className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-lg font-medium">No attack paths found</p>
        <p className="text-sm text-muted-foreground">Admin API access is required for full attack path analysis.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 relative h-[calc(100vh-10rem)] rounded-lg border border-border/50 overflow-hidden m-4">
      <AttackPathGraph attackNodes={nodes} attackEdges={edges} highlightedPaths={highlightedPaths} onNodeClick={(node) => setSelectedNode(node)} />
      {selectedNode && <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
    </div>
  )
}

function CrossProviderTab() {
  const {
    graph, loading, error, refetch, filters,
    toggleEntityType, toggleRelationType, toggleProvider,
    resetFilters, selectedNodeId, setSelectedNodeId,
    selectedNode, selectedEdges,
  } = useAttackGraph()

  const handleExport = useCallback(() => {
    const data = JSON.stringify(graph, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "attack-graph.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [graph])

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-10rem)] overflow-hidden p-4">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-medium">Cross-Provider Entity Graph</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={graph.nodes.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>
      {error && <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-md shrink-0">{error}</div>}
      <div className="flex flex-1 min-h-0 gap-0 rounded-md border border-border/40 overflow-hidden">
        <div className="w-[200px] shrink-0 border-r border-border/40 overflow-y-auto">
          <FilterPanel filters={filters} onToggleEntityType={toggleEntityType} onToggleRelationType={toggleRelationType} onToggleProvider={toggleProvider} onReset={resetFilters} nodeCount={graph.nodes.length} edgeCount={graph.edges.length} />
        </div>
        <div className="flex-1 min-w-0 relative">
          <GraphCanvas nodes={graph.nodes} edges={graph.edges} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
        </div>
        {selectedNode && (
          <div className="w-[280px] shrink-0 border-l border-border/40 overflow-y-auto">
            <DetailPanel node={selectedNode} edges={selectedEdges} allNodes={graph.nodes} onClose={() => setSelectedNodeId(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdversarialGraphsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Share2 className="h-5 w-5 text-red-400" />
        <h1 className="text-lg font-semibold">Adversarial Graphs</h1>
      </div>

      <Tabs defaultValue="operator" className="flex-1 flex flex-col">
        <div className="px-4">
          <TabsList>
            <TabsTrigger value="operator">Operator</TabsTrigger>
            <TabsTrigger value="attack-paths">Attack Paths</TabsTrigger>
            <TabsTrigger value="cross-provider">Cross-Provider</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operator" className="flex-1 mt-0">
          <OperatorTab />
        </TabsContent>

        <TabsContent value="attack-paths" className="flex-1 mt-0">
          <AttackPathsTab />
        </TabsContent>

        <TabsContent value="cross-provider" className="flex-1 mt-0">
          <CrossProviderTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
