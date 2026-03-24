"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { UserSearch } from "@/components/directory/user-search"
import { UserCard } from "@/components/directory/user-card"
import { UserDetail } from "@/components/directory/user-detail"
import { GroupList } from "@/components/directory/group-list"
import { ServiceError } from "@/components/ui/service-error"
import { useUsers, useUserDetail, useGroups } from "@/hooks/use-directory"
import type { DirectoryUser } from "@/hooks/use-directory"
import { Loader2 } from "lucide-react"
import { BrandedLoader } from "@/components/layout/branded-loader"

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState("people")
  const [peopleQuery, setPeopleQuery] = useState("")
  const [groupsQuery, setGroupsQuery] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { users, loading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers(peopleQuery)
  const { user: userDetail, loading: detailLoading, error: detailError } = useUserDetail(selectedUserId)
  const { groups, loading: groupsLoading, error: groupsError } = useGroups(groupsQuery)

  const handleUserClick = useCallback((user: DirectoryUser) => {
    setSelectedUserId(user.primaryEmail)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedUserId(null)
  }, [])

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
          {!usersError && (
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
              <BrandedLoader />
            ) : usersError ? (
              <ServiceError error={usersError} onRetry={refetchUsers} />
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
          {!groupsError && (
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
