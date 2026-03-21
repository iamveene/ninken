"use client"

import { useAttackGraph } from "@/hooks/use-attack-graph"
import { FilterPanel } from "@/components/studio/attack-graph/filter-panel"
import { GraphCanvas } from "@/components/studio/attack-graph/graph-canvas"
import { DetailPanel } from "@/components/studio/attack-graph/detail-panel"
import { Button } from "@/components/ui/button"
import { Share2, RefreshCw, Download } from "lucide-react"
import { useCallback } from "react"

export default function AttackGraphPage() {
  const {
    graph,
    loading,
    error,
    refetch,
    filters,
    toggleEntityType,
    toggleRelationType,
    toggleProvider,
    resetFilters,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    selectedEdges,
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
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            Attack Path Graph
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visualize entity relationships, privilege paths, and delegation chains.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={graph.nodes.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-md shrink-0">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 gap-0 rounded-md border border-border/40 overflow-hidden">
        {/* Filter sidebar */}
        <div className="w-[200px] shrink-0 border-r border-border/40 overflow-y-auto">
          <FilterPanel
            filters={filters}
            onToggleEntityType={toggleEntityType}
            onToggleRelationType={toggleRelationType}
            onToggleProvider={toggleProvider}
            onReset={resetFilters}
            nodeCount={graph.nodes.length}
            edgeCount={graph.edges.length}
          />
        </div>

        {/* Graph canvas (fills remaining space) */}
        <div className="flex-1 min-w-0 relative">
          <GraphCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>

        {/* Detail panel (conditional) */}
        {selectedNode && (
          <div className="w-[280px] shrink-0 border-l border-border/40 overflow-y-auto">
            <DetailPanel
              node={selectedNode}
              edges={selectedEdges}
              allNodes={graph.nodes}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
