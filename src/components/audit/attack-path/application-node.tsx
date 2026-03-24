"use client"

import { Handle, Position } from "@xyflow/react"
import { AppWindow } from "lucide-react"

const APP_COLOR = "#06b6d4" // cyan

type AttackNodeData = {
  label: string
  nodeType: string
  riskScore?: number
  riskFactors?: string[]
  metadata?: Record<string, unknown>
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-red-400 bg-red-500/20" :
    score >= 40 ? "text-amber-400 bg-amber-500/20" :
    "text-blue-400 bg-blue-500/20"
  return (
    <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${color}`}>
      Risk: {score}
    </span>
  )
}

export function ApplicationNode({ data }: { data: AttackNodeData }) {
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !border-cyan-400 !w-1.5 !h-1.5" />
      <div
        className="attack-node-application flex items-center justify-center border-2"
        style={{
          width: 48,
          height: 48,
          backgroundColor: `${APP_COLOR}20`,
          borderColor: `${APP_COLOR}80`,
        }}
      >
        <AppWindow className="h-5 w-5" style={{ color: APP_COLOR }} />
      </div>
      <span className="text-[10px] font-medium text-foreground max-w-[100px] truncate text-center">
        {data.label}
      </span>
      {data.riskScore != null && data.riskScore > 0 && <RiskBadge score={data.riskScore} />}
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !border-cyan-400 !w-1.5 !h-1.5" />
    </div>
  )
}
