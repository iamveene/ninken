"use client"

import { Card, CardContent } from "@/components/ui/card"
import { KeyRound } from "lucide-react"

export default function GitLabAuditVariablesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          CI/CD Variables
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enumerate CI/CD variables (secrets) across projects and groups
        </p>
      </div>
      <Card>
        <CardContent className="p-8 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Variable enumeration coming soon.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Will enumerate project and group CI/CD variables, identifying masked vs unmasked secrets and their protection levels.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
