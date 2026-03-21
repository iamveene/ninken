"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"

export default function GitLabAuditProjectAccessPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Project Access
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit project visibility, branch protections, and merge request approvals
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Project access audit coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will audit protected branches, merge request approval rules, and push access levels.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
