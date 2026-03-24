"use client"

import { useRef, useEffect } from "react"
import * as d3 from "d3"
import type { GraphNode, GraphEdge } from "@/lib/studio/graph-types"
import { ENTITY_COLORS, RELATION_DASH } from "@/lib/studio/graph-types"
import { Legend } from "./legend"

// ── D3 simulation types (D3 mutates nodes/edges in place) ───────────

type SimNode = GraphNode & d3.SimulationNodeDatum
type SimEdge = {
  source: SimNode | string
  target: SimNode | string
  type: GraphEdge["type"]
  label?: string
}

// ── Props ───────────────────────────────────────────────────────────

type Props = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

// ── Component ───────────────────────────────────────────────────────

export function GraphCanvas({ nodes, edges, selectedNodeId, onSelectNode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null)
  // Keep callback ref so D3 event handlers always call the latest version
  const onSelectRef = useRef(onSelectNode)
  onSelectRef.current = onSelectNode

  // ── Simulation effect (only re-runs when nodes/edges change) ──────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 800
    const height = svg.clientHeight || 600

    // Clear previous render
    d3.select(svg).selectAll("*").remove()

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current = null
    }

    if (nodes.length === 0) return

    // Prepare simulation data (D3 mutates these in place)
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]))

    const simEdges: SimEdge[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        type: e.type,
        label: e.label,
      }))

    // Arrow markers — append defs to SVG root (not zoom group) so markers
    // don't scale with zoom/pan transforms (HI-15 fix)
    const defs = d3.select(svg).append("defs")
    const markerTypes = [...new Set(edges.map((e) => e.type))]
    for (const t of markerTypes) {
      defs
        .append("marker")
        .attr("id", `arrow-${t}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "var(--color-muted-foreground)")
        .attr("opacity", 0.5)
    }

    // Root <g> for zoom/pan — appended AFTER defs so defs stay outside the
    // zoom group and markers render at a fixed size regardless of zoom level
    const root = d3.select(svg).append("g")

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform)
      })

    d3.select(svg)
      .call(zoom)
      .on("click", (event) => {
        if (event.target === svg) onSelectRef.current(null)
      })

    // Edge lines
    const link = root
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "var(--color-muted-foreground)")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => (d.type === "admin-of" ? 2 : 1.2))
      .attr("stroke-dasharray", (d) => {
        const dash = RELATION_DASH[d.type]
        return dash === "none" ? null : dash
      })
      .attr("marker-end", (d) => `url(#arrow-${d.type})`)

    // Node groups
    const node = root
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        _event.stopPropagation()
        onSelectRef.current(d.id)
      })

    // Node circles — initial stroke set to background (selection applied separately)
    node
      .append("circle")
      .attr("r", 8)
      .attr("fill", (d) => ENTITY_COLORS[d.type])
      .attr("stroke", "var(--color-background)")
      .attr("stroke-width", 1.5)

    // Node labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("fill", "var(--color-foreground)")
      .attr("pointer-events", "none")

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on("drag", (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(drag)

    // Force simulation
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(20))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0)

        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simulationRef.current = simulation

    // Fit graph to view after simulation settles
    const initialZoomTimer = setTimeout(() => {
      if (simNodes.length === 0) return
      const xExtent = d3.extent(simNodes, (d) => d.x) as [number, number]
      const yExtent = d3.extent(simNodes, (d) => d.y) as [number, number]
      if (xExtent[0] == null) return

      const padding = 40
      const gWidth = xExtent[1] - xExtent[0] + padding * 2
      const gHeight = yExtent[1] - yExtent[0] + padding * 2
      const scale = Math.min(width / gWidth, height / gHeight, 1.5)
      const cx = (xExtent[0] + xExtent[1]) / 2
      const cy = (yExtent[0] + yExtent[1]) / 2

      d3.select(svg)
        .transition()
        .duration(400)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-cx, -cy)
        )
    }, 1500)

    return () => {
      clearTimeout(initialZoomTimer)
      simulation.stop()
      simulationRef.current = null
    }
  }, [nodes, edges])

  // ── Selection highlight effect (lightweight, no simulation restart) ─
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    d3.select(svg)
      .selectAll<SVGCircleElement, SimNode>(".nodes circle")
      .attr("stroke", (d) =>
        d.id === selectedNodeId ? "var(--color-primary)" : "var(--color-background)"
      )
      .attr("stroke-width", (d) => (d.id === selectedNodeId ? 2.5 : 1.5))
  }, [selectedNodeId])

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <svg
        ref={svgRef}
        className="w-full h-full bg-background"
        style={{ minHeight: "400px" }}
      />
      {nodes.length > 0 && <Legend />}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium">No graph data available</p>
            <p className="text-xs mt-1">
              Load credentials and run audit enumeration to populate the attack graph.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
