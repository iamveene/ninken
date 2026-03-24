"use client"

import { Handle, Position } from "@xyflow/react"
import { NODE_COLORS, type AttackPathNodeType } from "@/lib/audit/attack-path-builder"
import {
  User,
  UsersRound,
  ShieldCheck,
  Bot,
  Globe,
  AppWindow,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const NODE_ICONS: Record<AttackPathNodeType, LucideIcon> = {
  user: User,
  group: UsersRound,
  role: ShieldCheck,
  "service-account": Bot,
  domain: Globe,
  "service-principal": Bot,       // reuse Bot for service principals
  tenant: Globe,                  // reuse Globe for tenants
  application: AppWindow,         // new icon for applications
}

type AttackNodeData = {
  label: string
  nodeType: AttackPathNodeType
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

export function UserNode({ data }: { data: AttackNodeData }) {
  const color = NODE_COLORS.user
  const Icon = NODE_ICONS.user
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !border-blue-400 !w-1.5 !h-1.5" />
      <div
        className="attack-node-user flex items-center justify-center border-2"
        style={{
          width: 44,
          height: 44,
          backgroundColor: `${color}20`,
          borderColor: `${color}80`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span className="text-[10px] font-medium text-foreground max-w-[100px] truncate text-center">
        {data.label}
      </span>
      {data.riskScore != null && data.riskScore > 0 && <RiskBadge score={data.riskScore} />}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !border-blue-400 !w-1.5 !h-1.5" />
    </div>
  )
}

export function GroupNode({ data }: { data: AttackNodeData }) {
  const color = NODE_COLORS.group
  const Icon = NODE_ICONS.group
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !border-green-400 !w-1.5 !h-1.5" />
      <div
        className="attack-node-group flex items-center gap-2 border px-3 py-1.5"
        style={{
          backgroundColor: `${color}15`,
          borderColor: `${color}60`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-[11px] font-medium text-foreground max-w-[100px] truncate">
          {data.label}
        </span>
      </div>
      {data.riskScore != null && data.riskScore > 0 && <RiskBadge score={data.riskScore} />}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !border-green-400 !w-1.5 !h-1.5" />
    </div>
  )
}

export function RoleNode({ data }: { data: AttackNodeData }) {
  const color = NODE_COLORS.role
  const Icon = NODE_ICONS.role
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-red-500 !border-red-400 !w-1.5 !h-1.5" />
      <div
        className="flex items-center justify-center border-2"
        style={{
          width: 48,
          height: 48,
          backgroundColor: `${color}20`,
          borderColor: `${color}80`,
          transform: "rotate(45deg)",
        }}
      >
        <div style={{ transform: "rotate(-45deg)" }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <span className="text-[10px] font-medium text-foreground max-w-[100px] truncate text-center mt-1">
        {data.label}
      </span>
      {data.riskScore != null && data.riskScore > 0 && <RiskBadge score={data.riskScore} />}
      <Handle type="source" position={Position.Bottom} className="!bg-red-500 !border-red-400 !w-1.5 !h-1.5" />
    </div>
  )
}

export function ServiceAccountNode({ data }: { data: AttackNodeData }) {
  const color = NODE_COLORS["service-account"]
  const Icon = NODE_ICONS["service-account"]
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !border-orange-400 !w-1.5 !h-1.5" />
      <div
        className="attack-node-sa flex items-center justify-center"
        style={{
          width: 52,
          height: 48,
          backgroundColor: `${color}25`,
          border: `2px solid ${color}80`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span className="text-[10px] font-medium text-foreground max-w-[100px] truncate text-center">
        {data.label.split("@")[0]}
      </span>
      {data.riskScore != null && data.riskScore > 0 && <RiskBadge score={data.riskScore} />}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !border-orange-400 !w-1.5 !h-1.5" />
    </div>
  )
}

export function DomainNode({ data }: { data: AttackNodeData }) {
  const color = NODE_COLORS.domain
  const Icon = NODE_ICONS.domain
  return (
    <div className="attack-node-wrapper flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !border-purple-400 !w-2 !h-2" />
      <div
        className="attack-node-domain flex items-center justify-center border-2"
        style={{
          width: 64,
          height: 64,
          backgroundColor: `${color}20`,
          borderColor: `${color}80`,
          boxShadow: `0 0 16px 4px ${color}30`,
        }}
      >
        <Icon className="h-7 w-7" style={{ color }} />
      </div>
      <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !border-purple-400 !w-2 !h-2" />
    </div>
  )
}
