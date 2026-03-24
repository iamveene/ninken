"use client"

import { Handle, Position } from "@xyflow/react"
import type { AccountNodeData } from "@/lib/graph/types"
import { resolveIcon } from "@/lib/icon-resolver"

const PROVIDER_COLORS: Record<string, string> = {
  google: "#4285F4",
  microsoft: "#00A4EF",
  github: "#8B5CF6",
  slack: "#E01E5A",
  gitlab: "#FC6D26",
  aws: "#FF9900",
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
  github: "GitHub",
  slack: "Slack",
  gitlab: "GitLab",
  aws: "AWS",
}

export function AccountNode({ data }: { data: AccountNodeData }) {
  const color = PROVIDER_COLORS[data.provider] ?? "#6B7280"
  const providerLabel = PROVIDER_LABELS[data.provider] ?? data.provider

  const iconMap: Record<string, string> = {
    google: "Globe",
    microsoft: "Monitor",
    github: "Github",
    slack: "Hash",
    gitlab: "GitBranch",
    aws: "Cloud",
  }
  const Icon = resolveIcon(iconMap[data.provider] ?? "User")

  return (
    <div
      className="relative flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-md"
      style={{ borderColor: color, width: 200 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-500 !border-neutral-400 !w-2 !h-2" />

      <div
        className="flex items-center justify-center rounded-md shrink-0"
        style={{
          width: 32,
          height: 32,
          backgroundColor: `${color}20`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
          {data.email}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {providerLabel}
        </span>
        {data.providers.length > 1 && (
          <div className="flex gap-0.5 mt-0.5">
            {data.providers.map((p) => (
              <div
                key={p}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: PROVIDER_COLORS[p] ?? "#6B7280" }}
                title={PROVIDER_LABELS[p] ?? p}
              />
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-neutral-500 !border-neutral-400 !w-2 !h-2" />
    </div>
  )
}
