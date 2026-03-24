"use client"

import { Crosshair } from "lucide-react"
import { SecretSearchPage } from "@/components/tools/secret-search-page"
import type { ServiceId } from "@/lib/audit/query-types"

const GITLAB_SERVICES: ServiceId[] = []

export default function GitLabHuntPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-muted-foreground" />
          Hunt
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for secrets and credentials across GitLab projects and groups.
        </p>
      </div>

      <SecretSearchPage
        services={GITLAB_SERVICES}
        providerLabel="GitLab (code search coming soon)"
        providerContext={{ provider: "gitlab", service: "gitlab" }}
      />
    </div>
  )
}
