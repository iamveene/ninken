"use client"

import { useState } from "react"
import { AlertCircle, Route, X } from "lucide-react"
import { useAuditAttackPaths } from "@/hooks/use-audit-attack-paths"
import { AttackPathGraph } from "@/components/audit/attack-path/attack-path-graph"
import { NODE_COLORS, type AttackPathNode } from "@/lib/audit/attack-path-builder"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"


function NodeDetailPanel({
  node,
  onClose,
}: {
  node: AttackPathNode
  onClose: () => void
}) {
  const color = NODE_COLORS[node.type]

  return (
    <div className="absolute top-3 right-3 z-10 w-80 rounded-lg border border-border/80 bg-card/95 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-semibold text-foreground capitalize">
            {node.type.replace("-", " ")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <span className="text-sm font-medium text-foreground">
            {node.label}
          </span>
        </div>

        {node.riskScore != null && node.riskScore > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Risk Score
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                node.riskScore >= 70
                  ? "text-red-400 border-red-500/30"
                  : node.riskScore >= 40
                    ? "text-amber-400 border-amber-500/30"
                    : "text-blue-400 border-blue-500/30"
              }`}
            >
              {node.riskScore}
            </Badge>
          </div>
        )}

        {node.riskFactors && node.riskFactors.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Risk Factors
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {node.riskFactors.map((f) => (
                <Badge
                  key={f}
                  variant="outline"
                  className="text-[10px] text-red-400 border-red-500/20 bg-red-500/10"
                >
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Metadata key-value pairs */}
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Details
          </span>
          <div className="mt-1 space-y-1">
            {Object.entries(node.metadata).map(([key, value]) => {
              if (value === undefined || value === null) return null
              const displayValue =
                Array.isArray(value)
                  ? value.length > 3
                    ? `${value.slice(0, 3).join(", ")} +${value.length - 3} more`
                    : value.join(", ")
                  : typeof value === "boolean"
                    ? value ? "Yes" : "No"
                    : String(value)
              return (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground min-w-[80px] capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <span className="text-[10px] text-foreground break-all">
                    {displayValue}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AttackPathsPage() {
  const { nodes, edges, highlightedPaths, loading, error } = useAuditAttackPaths()
  const [selectedNode, setSelectedNode] = useState<AttackPathNode | null>(null)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Attack Paths</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Permission relationships, privilege escalation chains, and risk-weighted paths across Google Workspace.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Unable to load attack path data</p>
              <p className="text-sm text-muted-foreground">
                {error.includes("403") || error.includes("Authorized")
                  ? "Admin permissions are required to build attack paths."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="flex-1 min-h-[400px] rounded-lg" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Route className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No attack paths found</p>
          <p className="text-sm text-muted-foreground">
            No users, roles, or delegations were returned. Admin API access is required for full attack path analysis.
          </p>
        </div>
      ) : (
        <div className="flex-1 relative rounded-lg border border-border/50 overflow-hidden">
          <AttackPathGraph
            attackNodes={nodes}
            attackEdges={edges}
            highlightedPaths={highlightedPaths}
            onNodeClick={(node) => setSelectedNode(node)}
          />
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
