"use client"

import { SecretSearchPage } from "@/components/tools/secret-search-page"
import type { ServiceId } from "@/lib/audit/query-types"

/**
 * GitHub Secret Search — uses the shared SecretSearchPage component.
 * Note: GitHub doesn't have Gmail/Drive-style query adapters yet.
 * Patterns are shown for reference; scanning will use whatever adapters
 * are available for the active provider profile.
 */

const GITHUB_SERVICES: ServiceId[] = []

export default function GitHubSecretSearchPage() {
  return (
    <SecretSearchPage
      services={GITHUB_SERVICES}
      providerLabel="GitHub (code search coming soon)"
    />
  )
}
