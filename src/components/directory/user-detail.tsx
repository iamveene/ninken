"use client"

import { ArrowLeft, Mail, Phone, MapPin, Building2, Calendar, Shield } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DirectoryUser } from "@/hooks/use-directory"

type UserDetailProps = {
  user: DirectoryUser | null
  loading: boolean
  error: string | null
  onBack: () => void
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

function getManager(user: DirectoryUser) {
  return user.relations?.find((r) => r.type === "manager")
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function UserDetail({ user, loading, error, onBack }: UserDetailProps) {
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="mt-8 text-center text-muted-foreground">
          {error.includes("403") || error.includes("Forbidden")
            ? "Admin access is required to view user details."
            : error}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="mt-8 text-center text-muted-foreground">
          Select a user to view details.
        </div>
      </div>
    )
  }

  const org = getPrimaryOrg(user)
  const manager = getManager(user)
  const primaryPhone = user.phones?.find((p) => p.primary) || user.phones?.[0]
  const primaryAddress = user.addresses?.find((a) => a.primary) || user.addresses?.[0]

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center gap-4">
        <Avatar size="lg" className="h-16 w-16">
          {user.thumbnailPhotoUrl && (
            <AvatarImage src={user.thumbnailPhotoUrl} alt={user.name.fullName} />
          )}
          <AvatarFallback className="text-lg">{getInitials(user.name.fullName)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{user.name.fullName}</h2>
            {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
            {user.suspended && <Badge variant="destructive">Suspended</Badge>}
          </div>
          {org?.title && <p className="text-muted-foreground">{org.title}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{user.primaryEmail}</span>
            </div>
            {primaryPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{primaryPhone.value}</span>
              </div>
            )}
            {primaryAddress?.formatted && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{primaryAddress.formatted}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {org?.department && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{org.department}</span>
              </div>
            )}
            {manager && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Manager: {manager.value}</span>
              </div>
            )}
            {user.orgUnitPath && (
              <div className="text-sm text-muted-foreground">
                Org Unit: {user.orgUnitPath}
              </div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.creationTime && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Created: {formatDate(user.creationTime)}</span>
              </div>
            )}
            {user.lastLoginTime && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Last login: {formatDate(user.lastLoginTime)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
