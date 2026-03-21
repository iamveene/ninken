"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users } from "lucide-react"

export default function GitLabAuditMembersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Members & Roles
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enumerate members and access levels across groups and projects
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Member enumeration coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate all members, their access levels (Guest, Reporter, Developer, Maintainer, Owner), and group inheritance.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
