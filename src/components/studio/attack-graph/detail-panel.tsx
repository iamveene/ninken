"use client"

import { useMemo } from "react"
import type { GraphNode, GraphEdge } from "@/lib/studio/graph-types"
import { ENTITY_LABELS, ENTITY_COLORS, RELATION_LABELS } from "@/lib/studio/graph-types"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  node: GraphNode
  edges: GraphEdge[]
  allNodes: GraphNode[]
  onClose: () => void
}

export function DetailPanel({ node, edges, allNodes, onClose }: Props) {
  const labelMap = useMemo(
    () => new Map(allNodes.map((n) => [n.id, n.label])),
    [allNodes]
  )
  const resolveLabel = (id: string) => labelMap.get(id) ?? id

  const incoming = edges.filter((e) => e.target === node.id)
  const outgoing = edges.filter((e) => e.source === node.id)

  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{node.label}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: ENTITY_COLORS[node.type] }}
            />
            <span className="text-xs text-muted-foreground">
              {ENTITY_LABELS[node.type]}
            </span>
            <Badge variant="outline" className="text-[10px] ml-1">
              {node.provider}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0 shrink-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Incoming edges */}
      {incoming.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            Incoming ({incoming.length})
          </h4>
          <ul className="space-y-1">
            {incoming.map((e, i) => (
              <li key={i} className="text-xs flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {resolveLabel(e.source)}
                </span>
                <span className="text-muted-foreground/60">&rarr;</span>
                <Badge variant="secondary" className="text-[10px]">
                  {RELATION_LABELS[e.type]}
                </Badge>
                {e.label && (
                  <span className="text-muted-foreground/60 text-[10px]">
                    ({e.label})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Outgoing edges */}
      {outgoing.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            Outgoing ({outgoing.length})
          </h4>
          <ul className="space-y-1">
            {outgoing.map((e, i) => (
              <li key={i} className="text-xs flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {RELATION_LABELS[e.type]}
                </Badge>
                <span className="text-muted-foreground/60">&rarr;</span>
                <span className="text-muted-foreground">
                  {resolveLabel(e.target)}
                </span>
                {e.label && (
                  <span className="text-muted-foreground/60 text-[10px]">
                    ({e.label})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metadata */}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            Metadata
          </h4>
          <div className="space-y-0.5">
            {Object.entries(node.metadata).map(([key, val]) => (
              <div key={key} className="text-xs flex gap-2">
                <span className="text-muted-foreground shrink-0">{key}:</span>
                <span className="break-all">
                  {typeof val === "boolean"
                    ? val ? "true" : "false"
                    : Array.isArray(val)
                      ? val.join(", ")
                      : String(val ?? "")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
