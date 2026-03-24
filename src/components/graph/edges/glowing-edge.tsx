"use client"

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react"

type GlowingEdgeData = {
  variant?: "operator" | "service" | "inactive"
}

export function GlowingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  animated: _animated,
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

  const variant = (data as GlowingEdgeData)?.variant ?? "service"

  return (
    <g className={`react-flow__edge-glowing edge-${variant}`}>
      <BaseEdge id={id} path={edgePath} {...rest} />
    </g>
  )
}
