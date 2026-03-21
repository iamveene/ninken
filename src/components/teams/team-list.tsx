"use client"

import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { Team } from "@/hooks/use-teams"

type TeamListProps = {
  teams: Team[]
  selectedId: string | null
  onSelect: (teamId: string) => void
  loading?: boolean
}

export function TeamList({ teams, selectedId, onSelect, loading }: TeamListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
        <Users className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">No teams found</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <nav className="flex flex-col gap-0.5 p-2">
        {teams.map((team) => {
          const isActive = selectedId === team.id
          return (
            <button
              key={team.id}
              onClick={() => onSelect(team.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-150",
                "hover:bg-accent/60",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80"
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-xs font-bold",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {team.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[13px] font-medium truncate", isActive && "font-semibold")}>
                  {team.displayName}
                </p>
                {team.description && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {team.description}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </nav>
    </ScrollArea>
  )
}
