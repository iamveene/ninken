"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type ContactOrganization = {
  name: string
  title: string
  department: string
}

export type ContactPerson = {
  resourceName: string
  displayName: string
  emails: string[]
  phones: string[]
  organization: ContactOrganization | null
  source: "directory" | "contacts" | "other"
  photoUrl: string | null
}

export type ContactSource = "directory" | "contacts" | "other"

type ContactsResult = {
  contacts: ContactPerson[]
  nextPageToken: string | null
  source: ContactSource
  scope: "organization" | "user" | "denied"
  totalItems?: number | null
}

export function useAuditContacts(source: ContactSource = "directory") {
  const cacheKey = `audit:contacts:${source}`

  const fetcher = useCallback(async (): Promise<ContactsResult> => {
    const params = new URLSearchParams({ source })
    const res = await fetch(`/api/audit/contacts?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(
        data.error || `Failed to fetch contacts (${res.status})`
      )
    }
    return res.json()
  }, [source])

  const { data, loading, error, refetch } = useCachedQuery<ContactsResult>(
    cacheKey,
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    contacts: data?.contacts ?? [],
    nextPageToken: data?.nextPageToken ?? null,
    scope: data?.scope ?? "organization",
    totalItems: data?.totalItems ?? null,
    loading,
    error,
    refetch,
  }
}
