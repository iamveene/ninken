"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { UserSearch } from "@/components/directory/user-search"
import { UserCard } from "@/components/directory/user-card"
import { UserDetail } from "@/components/directory/user-detail"
import { GroupList } from "@/components/directory/group-list"
import { useUsers, useUserDetail, useGroups } from "@/hooks/use-directory"
import type { DirectoryUser } from "@/hooks/use-directory"
import { Loader2, AlertCircle } from "lucide-react"

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState("people")
  const [peopleQuery, setPeopleQuery] = useState("")
  const [groupsQuery, setGroupsQuery] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { users, loading: usersLoading, error: usersError } = useUsers(peopleQuery)
  const { user: userDetail, loading: detailLoading, error: detailError } = useUserDetail(selectedUserId)
  const { groups, loading: groupsLoading, error: groupsError } = useGroups(groupsQuery)

  const handleUserClick = useCallback((user: DirectoryUser) => {
    setSelectedUserId(user.primaryEmail)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedUserId(null)
  }, [])

  const isPermissionError = (err: string | null) =>
    err != null && (err.includes("403") || err.includes("Forbidden") || err.includes("insufficient") || err.includes("scope") || err.includes("disabled") || err.includes("Enable it"))
  const usersPermissionDenied = isPermissionError(usersError)
  const groupsPermissionDenied = isPermissionError(groupsError)

  if (selectedUserId) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col overflow-hidden">
        <UserDetail
          user={userDetail}
          loading={detailLoading}
          error={detailError}
          onBack={handleBack}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col overflow-hidden">
      <Tabs
        defaultValue="people"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex items-center gap-4 px-4 pt-4 pb-2">
          <h1 className="text-lg font-semibold">Directory</h1>
          <TabsList>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="people" className="flex flex-col flex-1 overflow-hidden px-4">
          {!usersPermissionDenied && (
            <div className="pb-3">
              <UserSearch
                value={peopleQuery}
                onChange={setPeopleQuery}
                placeholder="Search people by name or email..."
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto pb-4">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading users...
              </div>
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
                        ? "Directory access requires administrator permissions. Contact your workspace admin for access."
                        : usersError}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <UserCard key={user.id} user={user} onClick={handleUserClick} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="flex flex-col flex-1 overflow-hidden px-4">
          {!groupsPermissionDenied && (
            <div className="pb-3">
              <UserSearch
                value={groupsQuery}
                onChange={setGroupsQuery}
                placeholder="Search groups by name or email..."
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto pb-4">
            <GroupList groups={groups} loading={groupsLoading} error={groupsError} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
