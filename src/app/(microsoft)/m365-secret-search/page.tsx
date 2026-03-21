"use client"

import { SecretSearchPage } from "@/components/tools/secret-search-page"
import type { ServiceId } from "@/lib/audit/query-types"

const MICROSOFT_SERVICES: ServiceId[] = ["outlook", "onedrive"]

export default function MicrosoftSecretSearchPage() {
  return (
    <SecretSearchPage
      services={MICROSOFT_SERVICES}
      providerLabel="Microsoft 365 (Outlook, OneDrive)"
    />
  )
}
