"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  Search,
  Users,
  UsersRound,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { BrandedLoader } from "@/components/layout/branded-loader"
import {
  useEntraUsers,
  useEntraUserDetail,
  useEntraGroups,
  useEntraGroupMembers,
  useEntraRoles,
} from "@/hooks/use-entra"
import type { EntraUser, EntraGroup, EntraRole } from "@/hooks/use-entra"

function getInitials(name: string): string {
  return name.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500/20 text-blue-500",
    "bg-green-500/20 text-green-500",
    "bg-purple-500/20 text-purple-500",
    "bg-orange-500/20 text-orange-500",
    "bg-pink-500/20 text-pink-500",
    "bg-cyan-500/20 text-cyan-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function isPermissionError(err: string | null) {
  return err != null && (err.includes("403") || err.includes("Forbidden") || err.includes("insufficient") || err.includes("Authorization"))
}

export default function EntraPage() {
  const [activeTab, setActiveTab] = useState("users")
  const [usersQuery, setUsersQuery] = useState("")
  const [groupsQuery, setGroupsQuery] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  const { users, loading: usersLoading, error: usersError } = useEntraUsers(usersQuery || undefined)
  const { user: userDetail, loading: detailLoading, error: detailError } = useEntraUserDetail(selectedUserId)
  const { groups, loading: groupsLoading, error: groupsError } = useEntraGroups(groupsQuery || undefined)
  const { members: groupMembers, loading: membersLoading } = useEntraGroupMembers(expandedGroupId)
  const { roles, loading: rolesLoading, error: rolesError } = useEntraRoles()

  const usersPermissionDenied = isPermissionError(usersError)
  const groupsPermissionDenied = isPermissionError(groupsError)
  const rolesPermissionDenied = isPermissionError(rolesError)

  const handleUserClick = useCallback((user: EntraUser) => {
    setSelectedUserId(user.id)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedUserId(null)
  }, [])

  const handleGroupExpand = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId))
  }, [])

  // User detail view
  if (selectedUserId) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-lg font-semibold">User Details</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {detailLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailError ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive" /> Error
                </CardTitle>
                <CardDescription>{detailError}</CardDescription>
              </CardHeader>
            </Card>
          ) : userDetail ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className={getAvatarColor(userDetail.displayName)}>
                    {getInitials(userDetail.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{userDetail.displayName}</h2>
                  <p className="text-sm text-muted-foreground">{userDetail.userPrincipalName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={userDetail.accountEnabled ? "secondary" : "destructive"}>
                      {userDetail.accountEnabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    {userDetail.mail && <p><span className="text-muted-foreground">Email:</span> {userDetail.mail}</p>}
                    {userDetail.mobilePhone && <p><span className="text-muted-foreground">Phone:</span> {userDetail.mobilePhone}</p>}
                    {userDetail.officeLocation && <p><span className="text-muted-foreground">Office:</span> {userDetail.officeLocation}</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Organization</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    {userDetail.jobTitle && <p><span className="text-muted-foreground">Title:</span> {userDetail.jobTitle}</p>}
                    {userDetail.department && <p><span className="text-muted-foreground">Department:</span> {userDetail.department}</p>}
                    {userDetail.companyName && <p><span className="text-muted-foreground">Company:</span> {userDetail.companyName}</p>}
                  </CardContent>
                </Card>
              </div>
              {userDetail.memberOf && userDetail.memberOf.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Group Memberships</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {userDetail.memberOf.map((group) => (
                        <Badge key={group.id} variant="outline" className="text-xs">
                          {group.displayName}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {userDetail.assignedLicenses && userDetail.assignedLicenses.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Licenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{userDetail.assignedLicenses.length} license(s) assigned</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col overflow-hidden">
      <Tabs
        defaultValue="users"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex items-center gap-4 px-4 pt-4 pb-2">
          <h1 className="text-lg font-semibold">Entra ID</h1>
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>
        </div>

        {/* Users Tab */}
        <TabsContent value="users" className="flex flex-col flex-1 overflow-hidden px-4">
          {!usersPermissionDenied && (
            <div className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={usersQuery}
                  onChange={(e) => setUsersQuery(e.target.value)}
                  placeholder="Search users by name or UPN..."
                  className="pl-9"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto pb-4">
            {usersLoading ? (
              <BrandedLoader />
            ) : usersError ? (
              <div className="py-12 flex justify-center">
                <Card className="max-w-md border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      {usersPermissionDenied ? "Access denied" : "Failed to load users"}
                    </CardTitle>
                    <CardDescription>
                      {usersPermissionDenied
                        ? "Directory access requires appropriate Microsoft Graph permissions. Ensure User.Read.All or Directory.Read.All consent is granted."
                        : usersError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user)}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Avatar className="size-10">
                      <AvatarFallback className={getAvatarColor(user.displayName)}>
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.userPrincipalName}</p>
                      {user.jobTitle && <p className="text-[11px] text-muted-foreground truncate">{user.jobTitle}</p>}
                    </div>
                    <Badge variant={user.accountEnabled ? "secondary" : "destructive"} className="text-[10px] shrink-0">
                      {user.accountEnabled ? "Active" : "Disabled"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="flex flex-col flex-1 overflow-hidden px-4">
          {!groupsPermissionDenied && (
            <div className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={groupsQuery}
                  onChange={(e) => setGroupsQuery(e.target.value)}
                  placeholder="Search groups..."
                  className="pl-9"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto pb-4">
            {groupsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : groupsError ? (
              <div className="py-12 flex justify-center">
                <Card className="max-w-md border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      {groupsPermissionDenied ? "Access denied" : "Failed to load groups"}
                    </CardTitle>
                    <CardDescription>
                      {groupsPermissionDenied
                        ? "Group enumeration requires GroupMember.Read.All or Directory.Read.All permission."
                        : groupsError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <UsersRound className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-lg font-medium">No groups found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">{groups.length} groups total</p>
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
                        {group.securityEnabled && (
                          <Badge variant="outline" className="text-[10px]">Security</Badge>
                        )}
                        {group.groupTypes.includes("Unified") && (
                          <Badge variant="secondary" className="text-[10px]">Microsoft 365</Badge>
                        )}
                        {group.mail && (
                          <span className="text-[11px] text-muted-foreground">{group.mail}</span>
                        )}
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
            )}
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="flex flex-col flex-1 overflow-hidden px-4">
          <div className="flex-1 overflow-y-auto pb-4">
            {rolesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : rolesError ? (
              <div className="py-12 flex justify-center">
                <Card className="max-w-md border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      {rolesPermissionDenied ? "Access denied" : "Failed to load roles"}
                    </CardTitle>
                    <CardDescription>
                      {rolesPermissionDenied
                        ? "Entra role enumeration requires RoleManagement.Read.Directory permission."
                        : rolesError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-lg font-medium">No roles found</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  {roles.length} roles total, {roles.filter((r) => r.members.length > 0).length} with assigned members
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Members</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.displayName}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground" title={role.description || ""}>
                          {role.description || <span className="text-muted-foreground/50">--</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={role.isBuiltIn ? "secondary" : "outline"}>
                            {role.isBuiltIn ? "Built-in" : "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {role.members.length > 0 ? (
                            <div className="space-y-0.5">
                              {role.members.map((m) => (
                                <p key={m.id} className="text-xs">{m.displayName || m.userPrincipalName}</p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
