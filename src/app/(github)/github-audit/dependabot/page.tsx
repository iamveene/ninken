"use client"

import { Bug, Construction, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DependabotAuditPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Dependabot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dependabot alerts and security updates for repositories.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
          <Bug className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Construction className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-medium">Requires GitHub Advanced Security</h2>
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Dependabot alerts require GitHub Advanced Security (GHAS) to be enabled
          on the organization or repository. Dependabot automatically detects
          vulnerable dependencies and suggests security updates.
        </p>
        <div className="flex gap-2 mt-4">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Shield className="h-3 w-3 mr-1" />
            Requires: GHAS
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Scope: security_events
          </Badge>
        </div>
      </div>
    </div>
  )
}
