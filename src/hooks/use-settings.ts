"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getSettings,
  saveSettings,
  type AppSettings,
  type AISettings,
} from "@/lib/settings-store"

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const save = useCallback(async (newSettings: AppSettings) => {
    setSaving(true)
    try {
      // 1. Save to IndexedDB (client-side store)
      await saveSettings(newSettings)
      // 2. Sync to server cookie (so API routes can read config)
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings.ai),
      })
      if (!res.ok) throw new Error("Failed to sync settings to server")
      setSettings(newSettings)
    } finally {
      setSaving(false)
    }
  }, [])

  const testConnection = useCallback(async (config: AISettings) => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const result = await res.json()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: "Network error" })
    } finally {
      setTestLoading(false)
    }
  }, [])

  return { settings, loading, saving, save, testConnection, testResult, testLoading }
}
