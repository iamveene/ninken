"use client"

import { useMemo } from "react"
import { Hash, Users, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ServiceError } from "@/components/ui/service-error"
import type { ChatSpace } from "@/hooks/use-chat"

type SpaceListProps = {
  spaces: ChatSpace[]
  selectedId: string | null
  onSelect: (spaceName: string) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

function getSpaceIcon(space: ChatSpace) {
  if (space.spaceType === "DIRECT_MESSAGE" || space.singleUserBotDm) {
    return MessageSquare
  }
  if (space.spaceType === "GROUP_CHAT") {
    return Users
  }
  return Hash
}

function getSpaceLabel(space: ChatSpace): string {
  if (space.displayName) return space.displayName
  if (space.spaceType === "DIRECT_MESSAGE") return "Direct Message"
  if (space.spaceType === "GROUP_CHAT") return "Group Chat"
  return space.name.replace("spaces/", "")
}

type GroupedSpaces = {
  dms: ChatSpace[]
  groups: ChatSpace[]
  spaces: ChatSpace[]
}

function groupSpaces(spaces: ChatSpace[]): GroupedSpaces {
  const dms: ChatSpace[] = []
  const groups: ChatSpace[] = []
  const named: ChatSpace[] = []
  for (const s of spaces) {
    if (s.spaceType === "DIRECT_MESSAGE" || s.singleUserBotDm) {
      dms.push(s)
    } else if (s.spaceType === "GROUP_CHAT") {
      groups.push(s)
    } else {
      named.push(s)
    }
  }
  return { dms, groups, spaces: named }
}

function SpaceItem({ space, isActive, onSelect }: { space: ChatSpace; isActive: boolean; onSelect: (name: string) => void }) {
  const Icon = getSpaceIcon(space)
  const label = getSpaceLabel(space)
  const memberCount = space.membershipCount?.joinedDirectHumanUserCount

  return (
    <button
      onClick={() => onSelect(space.name)}
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
          "flex size-8 items-center justify-center rounded-lg",
          isActive
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] font-medium truncate", isActive && "font-semibold")}>
          {label}
        </p>
        {memberCount != null && memberCount > 0 && (
          <p className="text-[11px] text-muted-foreground truncate">
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </p>
        )}
      </div>
    </button>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
    </p>
  )
}

export function SpaceList({ spaces, selectedId, onSelect, loading, error, onRetry }: SpaceListProps) {
  const grouped = useMemo(() => groupSpaces(spaces), [spaces])

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

  if (error) {
    return <ServiceError error={error} onRetry={onRetry} className="py-6 px-3" />
  }

  if (spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">No conversations found</p>
        <p className="text-xs text-muted-foreground/60 text-center">DMs, group chats, and spaces will appear here</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <nav className="flex flex-col gap-0.5 p-2">
        {grouped.dms.length > 0 && (
          <>
            <SectionHeader label="Direct Messages" />
            {grouped.dms.map((space) => (
              <SpaceItem key={space.name} space={space} isActive={selectedId === space.name} onSelect={onSelect} />
            ))}
          </>
        )}
        {grouped.groups.length > 0 && (
          <>
            <SectionHeader label="Group Chats" />
            {grouped.groups.map((space) => (
              <SpaceItem key={space.name} space={space} isActive={selectedId === space.name} onSelect={onSelect} />
            ))}
          </>
        )}
        {grouped.spaces.length > 0 && (
          <>
            <SectionHeader label="Spaces" />
            {grouped.spaces.map((space) => (
              <SpaceItem key={space.name} space={space} isActive={selectedId === space.name} onSelect={onSelect} />
            ))}
          </>
        )}
      </nav>
    </ScrollArea>
  )
}
