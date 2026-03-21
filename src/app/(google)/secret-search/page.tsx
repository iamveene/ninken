"use client"

import { SecretSearchPage } from "@/components/tools/secret-search-page"
import type { ServiceId } from "@/lib/audit/query-types"

const GOOGLE_SERVICES: ServiceId[] = ["gmail", "drive", "calendar", "buckets"]

export default function GoogleSecretSearchPage() {
  return (
    <SecretSearchPage
      services={GOOGLE_SERVICES}
      providerLabel="Google Workspace (Gmail, Drive, Calendar, Buckets)"
    />
  )
}
