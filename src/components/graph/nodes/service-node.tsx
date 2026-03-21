"use client"

import { useState, useCallback } from "react"
import { Handle, Position, useReactFlow } from "@xyflow/react"
import { useRouter } from "next/navigation"
import type { ServiceNodeData } from "@/lib/graph/types"
import { resolveIcon } from "@/lib/icon-resolver"
import { ExternalLink } from "lucide-react"

export function ServiceNode({ id, data }: { id: string; data: ServiceNodeData }) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  const { setNodes } = useReactFlow()
  const Icon = resolveIcon(data.iconName)

  const liftNode = useCallback(() => {
    setHovered(true)
    setNodes((nodes) =>
      nodes.map((n) => n.id === id ? { ...n, zIndex: 1000 } : n)
    )
  }, [id, setNodes])

  const dropNode = useCallback(() => {
    setHovered(false)
    setNodes((nodes) =>
      nodes.map((n) => n.id === id ? { ...n, zIndex: 0 } : n)
    )
  }, [id, setNodes])

  return (
    <div
      className={`relative ${data.active ? "service-node-active" : "service-node-inactive"}`}
      onMouseEnter={liftNode}
      onMouseLeave={dropNode}
    >
      <div
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 shadow-sm transition-all ${
          data.active
            ? "bg-amber-950/40 border-amber-600/50 text-amber-200"
            : "bg-neutral-900/60 border-neutral-700/50 text-neutral-500"
        }`}
        style={{ width: 140 }}
      >
        <Handle type="target" position={Position.Top} className="!bg-neutral-500 !border-neutral-400 !w-1.5 !h-1.5" />

        <Icon className={`h-3.5 w-3.5 shrink-0 ${data.active ? "text-amber-400" : "text-neutral-600"}`} />

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium truncate">{data.serviceName}</span>
          {data.active && data.scopeCount > 0 && (
            <span className="text-[9px] text-amber-400/70">
              {data.scopeCount} scope{data.scopeCount !== 1 ? "s" : ""}
            </span>
          )}
          {!data.active && (
            <span className="text-[9px] text-neutral-600">No access</span>
          )}
        </div>
      </div>

      {/* Hover detail panel */}
      {hovered && data.active && (
        <div
          className="absolute left-full ml-2 top-0 w-56 rounded-md border border-border/80 p-3"
          style={{
            backgroundColor: "#111114",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
            zIndex: 10,
          }}
          onMouseEnter={liftNode}
          onMouseLeave={dropNode}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">{data.serviceName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(data.href)
              }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
            >
              Navigate <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </div>

          <div className="text-[10px] text-muted-foreground mb-1.5">
            Granted scopes ({data.scopeCount}/{data.allScopes.length})
          </div>

          <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {data.allScopes.map((scope) => {
              const granted = data.grantedScopes.includes(scope)
              const shortName = scope.includes("/")
                ? scope.split("/").pop()
                : scope
              return (
                <div
                  key={scope}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    granted
                      ? "text-green-400"
                      : "text-neutral-500 line-through"
                  }`}
                  style={{ backgroundColor: granted ? "#0a2a1a" : "#1e1e1e" }}
                  title={scope}
                >
                  {shortName}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
