"use client"

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react"

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
  ...rest
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const variant = (data as GlowingEdgeData)?.variant ?? "service"

  return (
    <g className={`react-flow__edge-glowing edge-${variant}`}>
      <BaseEdge id={id} path={edgePath} {...rest} />
    </g>
  )
}
