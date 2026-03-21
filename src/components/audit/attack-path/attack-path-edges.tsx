"use client"

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react"
import { EDGE_STYLES, type AttackPathEdgeType } from "@/lib/audit/attack-path-builder"

type AttackEdgeData = {
  edgeType: AttackPathEdgeType
  riskWeight?: number
  highlighted?: boolean
}

export function AttackPathEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  ...rest
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  })

  const edgeData = data as AttackEdgeData | undefined
  const edgeType = edgeData?.edgeType ?? "member-of"
  const highlighted = edgeData?.highlighted ?? false
  const style = EDGE_STYLES[edgeType]

  return (
    <g className={highlighted ? "attack-edge-highlighted" : ""}>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: highlighted ? "#ef4444" : style.color,
          strokeWidth: highlighted ? style.strokeWidth + 1 : style.strokeWidth,
          strokeDasharray: highlighted ? undefined : style.dashArray === "none" ? undefined : style.dashArray,
          filter: highlighted ? "drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))" : undefined,
        }}
        {...rest}
      />
    </g>
  )
}
