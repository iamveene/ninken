"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DirectoryUser } from "@/hooks/use-directory"

type UserCardProps = {
  user: DirectoryUser
  onClick: (user: DirectoryUser) => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function getPrimaryOrg(user: DirectoryUser) {
  return user.organizations?.find((o) => o.primary) || user.organizations?.[0]
}

export function UserCard({ user, onClick }: UserCardProps) {
  const org = getPrimaryOrg(user)

  return (
    <Card
      size="sm"
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => onClick(user)}
    >
      <CardContent className="flex items-center gap-3">
        <Avatar size="lg">
          {user.thumbnailPhotoUrl && (
            <AvatarImage src={user.thumbnailPhotoUrl} alt={user.name.fullName} />
          )}
          <AvatarFallback>{getInitials(user.name.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{user.name.fullName}</p>
            {user.isAdmin && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Admin</Badge>}
            {user.suspended && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.primaryEmail}</p>
          {org?.title && (
            <p className="truncate text-xs text-muted-foreground">
              {org.title}{org.department ? ` - ${org.department}` : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
