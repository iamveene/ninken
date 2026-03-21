"use client"

import { useGraphData } from "@/hooks/use-graph-data"
import { OperatorGraph } from "@/components/graph/operator-graph"
import { Button } from "@/components/ui/button"
import { RefreshCw, Share2 } from "lucide-react"

export default function GraphPage() {
  const { nodes, edges, loading, error, refetch } = useGraphData()

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between shrink-0 px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-red-400" />
          <h1 className="text-sm font-semibold">Adversarial Graph</h1>
          {loading && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              Loading sessions...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 shrink-0">
          {error}
        </div>
      )}

      {/* Graph canvas */}
      <div className="flex-1 min-h-0">
        <OperatorGraph initialNodes={nodes} initialEdges={edges} />
      </div>
    </div>
  )
}
