"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Server } from "lucide-react"

export default function GitLabAuditRunnersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5" />
          Runners
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enumerate CI/CD runners and their configuration
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Runner enumeration coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate shared, group, and project runners with their tags, status, and configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
