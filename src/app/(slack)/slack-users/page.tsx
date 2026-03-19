"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Users,
  Search,
  Shield,
  Crown,
  Bot,
  UserX,
  Mail,
} from "lucide-react"
import { useSlackUsers } from "@/hooks/use-slack"
import type { SlackUser } from "@/hooks/use-slack"

function UserRoleBadges({ user }: { user: SlackUser }) {
  return (
    <div className="flex flex-wrap gap-1">
      {user.isPrimaryOwner && (
        <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-400">
          <Crown className="h-2.5 w-2.5 mr-0.5" />
          Primary Owner
        </Badge>
      )}
      {user.isOwner && !user.isPrimaryOwner && (
        <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-400">
          Owner
        </Badge>
      )}
      {user.isAdmin && !user.isOwner && (
        <Badge variant="outline" className="text-[10px] border-blue-500/30 bg-blue-500/10 text-blue-400">
          <Shield className="h-2.5 w-2.5 mr-0.5" />
          Admin
        </Badge>
      )}
      {user.isBot && (
        <Badge variant="outline" className="text-[10px] border-purple-500/30 bg-purple-500/10 text-purple-400">
          <Bot className="h-2.5 w-2.5 mr-0.5" />
          Bot
        </Badge>
      )}
      {user.isRestricted && (
        <Badge variant="outline" className="text-[10px] border-red-500/30 bg-red-500/10 text-red-400">
          Guest
        </Badge>
      )}
      {user.isDeleted && (
        <Badge variant="outline" className="text-[10px] border-red-500/30 bg-red-500/10 text-red-400">
          <UserX className="h-2.5 w-2.5 mr-0.5" />
          Deactivated
        </Badge>
      )}
    </div>
  )
}

export default function SlackUsersPage() {
  const { users, loading, error, refetch } = useSlackUsers()
  const [filter, setFilter] = useState("")

  const filtered = filter
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(filter.toLowerCase()) ||
          u.realName.toLowerCase().includes(filter.toLowerCase()) ||
          u.displayName.toLowerCase().includes(filter.toLowerCase()) ||
          (u.email && u.email.toLowerCase().includes(filter.toLowerCase()))
      )
    : users

  const activeUsers = users.filter((u) => !u.isDeleted && !u.isBot)
  const adminUsers = users.filter((u) => u.isAdmin || u.isOwner)
  const botUsers = users.filter((u) => u.isBot)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Users</h1>
          <p className="text-xs text-muted-foreground">
            {activeUsers.length} active, {adminUsers.length} admins,{" "}
            {botUsers.length} bots
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs text-primary underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((user) => (
            <Card
              key={user.id}
              className={cn(
                "transition-all hover:border-primary/20",
                user.isDeleted && "opacity-50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="h-10 w-10 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.displayName || user.realName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      @{user.name}
                    </p>
                    {user.title && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {user.title}
                      </p>
                    )}
                    {user.email && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-2.5 w-2.5 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    )}
                    <div className="mt-1.5">
                      <UserRoleBadges user={user} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
