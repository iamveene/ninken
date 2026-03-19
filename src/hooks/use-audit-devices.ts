"use client"

import { useCallback } from "react"
import { useCachedQuery } from "@/hooks/use-cached"
import { CACHE_TTL_LIST } from "@/lib/cache"

export type ChromeDevice = {
  deviceId: string
  serialNumber: string
  model: string
  status: string
  osVersion: string
  platformVersion: string
  lastSync: string | null
  annotatedUser: string
  annotatedLocation: string
  annotatedAssetId: string
  orgUnitPath: string
  macAddress: string
  deviceType: "chromeos"
}

export type MobileDevice = {
  deviceId: string
  serialNumber: string
  model: string
  status: string
  os: string
  type: string
  lastSync: string | null
  email: string
  name: string
  deviceType: "mobile"
}

type DevicesResult = {
  chromeDevices: ChromeDevice[]
  mobileDevices: MobileDevice[]
  scope: "organization" | "limited"
}

export function useAuditDevices() {
  const fetcher = useCallback(async (): Promise<DevicesResult> => {
    const res = await fetch("/api/audit/devices")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to fetch devices (${res.status})`)
    }
    return res.json()
  }, [])

  const { data, loading, error, refetch } = useCachedQuery<DevicesResult>(
    "audit:devices",
    fetcher,
    { ttlMs: CACHE_TTL_LIST }
  )

  return {
    chromeDevices: data?.chromeDevices ?? [],
    mobileDevices: data?.mobileDevices ?? [],
    scope: data?.scope ?? "organization",
    loading,
    error,
    refetch,
  }
}
