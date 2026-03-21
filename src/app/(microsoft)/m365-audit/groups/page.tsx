"use client"

import { useState, useCallback } from "react"
import { UsersRound, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { useEntraGroups, useEntraGroupMembers } from "@/hooks/use-entra"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function getInitials(name: string): string {
  return name.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500/20 text-blue-500",
    "bg-green-500/20 text-green-500",
    "bg-purple-500/20 text-purple-500",
    "bg-orange-500/20 text-orange-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function M365GroupsAuditPage() {
  const { groups, loading, error } = useEntraGroups()
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const { members: groupMembers, loading: membersLoading } = useEntraGroupMembers(expandedGroupId)

  const isPermissionError = error != null && (error.includes("403") || error.includes("Forbidden") || error.includes("Authorization"))

  const handleGroupExpand = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Groups Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect group memberships, types, and configurations across the Microsoft 365 tenant.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">{isPermissionError ? "Access denied" : "Unable to load groups data"}</p>
              <p className="text-sm text-muted-foreground">
                {isPermissionError
                  ? "GroupMember.Read.All or Directory.Read.All permission is required to audit groups."
                  : error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <UsersRound className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No groups found</p>
          <p className="text-sm text-muted-foreground">No groups exist in the tenant yet.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {groups.length} {groups.length === 1 ? "group" : "groups"} total
          </p>

          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="border rounded-lg">
                <button
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => handleGroupExpand(group.id)}
                >
                  {expandedGroupId === group.id ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{group.displayName}</p>
                    {group.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {group.securityEnabled && <Badge variant="outline" className="text-[10px]">Security</Badge>}
                    {group.groupTypes.includes("Unified") && <Badge variant="secondary" className="text-[10px]">M365</Badge>}
                    {group.mail && <span className="text-[11px] text-muted-foreground hidden sm:inline">{group.mail}</span>}
                  </div>
                </button>
                {expandedGroupId === group.id && (
                  <div className="px-4 pb-3 pt-1 border-t bg-muted/20">
                    {membersLoading ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading members...
                      </div>
                    ) : groupMembers.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">No members</p>
                    ) : (
                      <div className="space-y-1 py-1">
                        <p className="text-xs text-muted-foreground mb-1">{groupMembers.length} members</p>
                        {groupMembers.map((member) => (
                          <div key={member.id} className="flex items-center gap-2 py-1">
                            <Avatar className="size-6">
                              <AvatarFallback className={`text-[9px] ${getAvatarColor(member.displayName)}`}>
                                {getInitials(member.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{member.displayName}</span>
                            {member.userPrincipalName && (
                              <span className="text-[11px] text-muted-foreground">{member.userPrincipalName}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
