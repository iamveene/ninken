"use client"

import {
  ALL_ENTITY_TYPES,
  ALL_RELATION_TYPES,
  ENTITY_LABELS,
  ENTITY_COLORS,
  RELATION_LABELS,
} from "@/lib/studio/graph-types"
import type { EntityType, RelationType } from "@/lib/studio/graph-types"
import type { ProviderId } from "@/lib/providers/types"
import type { GraphFilters } from "@/hooks/use-attack-graph"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "slack", label: "Slack" },
  { id: "aws", label: "AWS" },
]

type Props = {
  filters: GraphFilters
  onToggleEntityType: (t: EntityType) => void
  onToggleRelationType: (t: RelationType) => void
  onToggleProvider: (p: ProviderId) => void
  onReset: () => void
  nodeCount: number
  edgeCount: number
}

export function FilterPanel({
  filters,
  onToggleEntityType,
  onToggleRelationType,
  onToggleProvider,
  onReset,
  nodeCount,
  edgeCount,
}: Props) {
  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        {nodeCount} nodes, {edgeCount} edges
      </div>

      {/* Provider filter */}
      <section>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Providers
        </h3>
        <div className="flex flex-col gap-1.5">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.providers.has(p.id)}
                onChange={() => onToggleProvider(p.id)}
                className="accent-primary h-3.5 w-3.5"
              />
              <span className="text-xs">{p.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Entity type filter */}
      <section>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Entity Types
        </h3>
        <div className="flex flex-col gap-1.5">
          {ALL_ENTITY_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.entityTypes.has(t)}
                onChange={() => onToggleEntityType(t)}
                className="accent-primary h-3.5 w-3.5"
              />
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ENTITY_COLORS[t] }}
              />
              <span className="text-xs">{ENTITY_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Relationship type filter */}
      <section>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Relationships
        </h3>
        <div className="flex flex-col gap-1.5">
          {ALL_RELATION_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.relationTypes.has(t)}
                onChange={() => onToggleRelationType(t)}
                className="accent-primary h-3.5 w-3.5"
              />
              <span className="text-xs">{RELATION_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="text-xs gap-1.5"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Filters
      </Button>
    </div>
  )
}
