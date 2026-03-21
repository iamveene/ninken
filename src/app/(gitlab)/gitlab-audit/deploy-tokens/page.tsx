"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Key } from "lucide-react"

export default function GitLabAuditDeployTokensPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5" />
          Deploy Tokens
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enumerate deploy tokens and keys across projects
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Deploy token enumeration coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate deploy tokens, deploy keys, and their scopes/expiry across all accessible projects.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
