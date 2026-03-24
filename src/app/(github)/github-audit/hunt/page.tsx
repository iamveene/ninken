"use client"

import { Crosshair } from "lucide-react"
import { SecretSearchPage } from "@/components/tools/secret-search-page"
import type { ServiceId } from "@/lib/audit/query-types"

const GITHUB_SERVICES: ServiceId[] = []

export default function GitHubHuntPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-muted-foreground" />
          Hunt
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for secrets and credentials across GitHub repositories and organizations.
        </p>
      </div>

      <SecretSearchPage
        services={GITHUB_SERVICES}
        providerLabel="GitHub (code search coming soon)"
        providerContext={{ provider: "github", service: "github" }}
      />
    </div>
  )
}
