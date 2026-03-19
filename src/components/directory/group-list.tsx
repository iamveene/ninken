"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Users2, Loader2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { useGroupMembers } from "@/hooks/use-directory"
import type { DirectoryGroup } from "@/hooks/use-directory"

type GroupListProps = {
  groups: DirectoryGroup[]
  loading: boolean
  error: string | null
}

function GroupItem({ group }: { group: DirectoryGroup }) {
  const [expanded, setExpanded] = useState(false)
  const { members, loading, error } = useGroupMembers(expanded ? group.id : null)

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{group.name}</p>
          <p className="truncate text-xs text-muted-foreground">{group.email}</p>
        </div>
        {group.directMembersCount && (
          <Badge variant="secondary" className="text-xs">
            {group.directMembersCount} members
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="bg-muted/30 px-4 py-2">
          {group.description && (
            <p className="text-xs text-muted-foreground mb-2">{group.description}</p>
          )}
          {loading && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading members...
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive py-2">
              {error.includes("403") || error.includes("Forbidden")
                ? "Admin access required to view members."
                : error}
            </p>
          )}
          {!loading && !error && members.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No members found.</p>
          )}
          {members.length > 0 && (
            <div className="space-y-1">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="truncate flex-1">{member.email}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function GroupList({ groups, loading, error }: GroupListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading groups...
      </div>
    )
  }

  if (error) {
    const permissionDenied = error.includes("403") || error.includes("Forbidden")
    return (
      <div className="py-12 flex justify-center">
        <Card className="max-w-md border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {permissionDenied ? "Access denied" : "Failed to load groups"}
            </CardTitle>
            <CardDescription>
              {permissionDenied
                ? "Directory access requires administrator permissions. Contact your workspace admin for access."
                : error}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No groups found.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/60 rounded-lg border border-border/60">
      {groups.map((group) => (
        <GroupItem key={group.id} group={group} />
      ))}
    </div>
  )
}
