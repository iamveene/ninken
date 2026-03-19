"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertCircle,
  ClipboardPaste,
  ArrowRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NinkenLogo } from "@/components/logo"
import { getAllProviders, detectProvider, getProvider } from "@/lib/providers"
import { resolveIcon } from "@/lib/icon-resolver"
import type { ServiceProvider } from "@/lib/providers/types"
import {
  addProfile,
  getAllProfiles,
  removeProfile,
} from "@/lib/token-store"
import { activateProfile, migrateFromCookies } from "@/lib/token-sync"

type Status = "idle" | "dragging" | "validating" | "success" | "error"

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900">
          <div className="animate-pulse text-sm text-neutral-500">Loading...</div>
        </div>
      }
    >
      <AuthPageInner />
    </Suspense>
  )
}

function AuthPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAddMode = searchParams.get("add") === "true"
  const [status, setStatus] = useState<Status>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [showPaste, setShowPaste] = useState(false)
  const [pasteValue, setPasteValue] = useState("")
  const [selectedProvider, setSelectedProvider] =
    useState<ServiceProvider | null>(null)
  const [migrating, setMigrating] = useState(true)
  const [hasExistingProfiles, setHasExistingProfiles] = useState(false)
  const [existingProfiles, setExistingProfiles] = useState<
    { id: string; provider: string; email?: string }[]
  >([])

  const providers = getAllProviders()

  useEffect(() => {
    async function init() {
      try {
        const migrated = await migrateFromCookies()
        if (migrated) {
          const profiles = await getAllProfiles()
          if (profiles.length > 0) {
            setHasExistingProfiles(true)
            if (isAddMode) {
              setMigrating(false)
              return
            }
            const providerConfig = getProvider(profiles[0].provider)
            router.push(providerConfig?.defaultRoute ?? "/gmail")
            return
          }
        }

        const existing = await getAllProfiles()
        if (existing.length > 0) {
          setHasExistingProfiles(true)
          setExistingProfiles(existing.map((p) => ({ id: p.id, provider: p.provider, email: p.email })))
          if (isAddMode) {
            setMigrating(false)
            return
          }
          await activateProfile(existing[0].id)
          const providerConfig = getProvider(existing[0].provider)
          router.push(providerConfig?.defaultRoute ?? "/gmail")
          return
        }
      } catch {
        // Non-critical
      }
      setMigrating(false)
    }
    init()
  }, [router, isAddMode])

  const submitToken = useCallback(
    async (text: string) => {
      setStatus("validating")
      setErrorMessage("")

      try {
        const data = JSON.parse(text)
        const provider = selectedProvider ?? detectProvider(data)
        if (!provider) {
          throw new Error(
            "Unrecognized credential format. Select a service manually."
          )
        }

        const result = provider.validateCredential(data)
        if (!result.valid) throw new Error(result.error)

        const profile = await addProfile(
          provider.id,
          result.credential,
          result.email
        )
        await activateProfile(profile.id)

        if (!result.email && provider.emailEndpoint) {
          try {
            const profileRes = await fetch(provider.emailEndpoint)
            if (profileRes.ok) {
              const profileData = await profileRes.json()
              if (profileData.emailAddress) {
                const { updateProfileEmail } = await import("@/lib/token-store")
                await updateProfileEmail(profile.id, profileData.emailAddress)
              }
            }
          } catch {
            // Non-critical
          }
        }

        setStatus("success")
        setTimeout(() => router.push(provider.defaultRoute), 500)
      } catch (e) {
        setStatus("error")
        setErrorMessage(
          e instanceof SyntaxError
            ? "Invalid JSON"
            : e instanceof Error
              ? e.message
              : "Unknown error"
        )
      }
    },
    [router, selectedProvider]
  )

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      submitToken(text)
    },
    [submitToken]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setStatus("idle")
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setStatus("dragging")
  }, [])

  const onDragLeave = useCallback(() => {
    setStatus("idle")
  }, [])

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handlePasteSubmit = useCallback(() => {
    if (!pasteValue.trim()) return
    submitToken(pasteValue.trim())
  }, [pasteValue, submitToken])

  if (migrating) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900">
        <div className="animate-pulse text-sm text-neutral-500">Loading...</div>
      </div>
    )
  }

  // Coming-soon services (not yet implemented)
  const comingSoon = (
    [
      { name: "GitHub", iconName: "Globe" },
      { name: "Slack", iconName: "MessageSquare" },
      { name: "AWS", iconName: "Globe" },
    ] as const
  ).filter((p) => !providers.some((r) => r.name === p.name))

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 px-4 overflow-hidden">
      <div className="w-full max-w-2xl flex flex-col gap-5">
        {/* Compact logo */}
        <div className="flex justify-center">
          <NinkenLogo className="text-center max-w-[520px]" />
        </div>

        {/* Active sessions — scrollable listbox */}
        {hasExistingProfiles && existingProfiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-center text-[10px] text-neutral-500 uppercase tracking-wider">
              Active sessions
            </p>
            <div className="mx-auto max-w-sm rounded border border-neutral-800 bg-neutral-900/40 overflow-hidden">
              <div className="max-h-[120px] overflow-y-auto">
                {existingProfiles.map((p, i) => {
                  const providerConfig = getProvider(p.provider as "google" | "microsoft")
                  if (!providerConfig) return null
                  const PIcon = resolveIcon(providerConfig.iconName)
                  return (
                    <div
                      key={p.id}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 ${
                        i > 0 ? "border-t border-neutral-800/60" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          await activateProfile(p.id)
                          router.push(providerConfig.defaultRoute)
                        }}
                        className="flex flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80 group min-w-0"
                      >
                        <PIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="flex-1 truncate text-xs text-neutral-300">
                          {p.email || providerConfig.name}
                        </span>
                        <span className="text-[10px] text-neutral-600 shrink-0">{providerConfig.name}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-neutral-600 group-hover:text-emerald-500 transition-colors" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await removeProfile(p.id)
                          await fetch("/api/auth", { method: "DELETE" })
                          const remaining = await getAllProfiles()
                          setExistingProfiles(remaining.map((r) => ({ id: r.id, provider: r.provider, email: r.email })))
                          if (remaining.length === 0) setHasExistingProfiles(false)
                        }}
                        className="shrink-0 p-0.5 rounded text-neutral-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                        aria-label={`Remove ${p.email || providerConfig.name}`}
                        title="Sign out"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Service grid — compact single row */}
        <div className="space-y-1.5">
          <p className="text-center text-[10px] text-neutral-500 uppercase tracking-wider">
            {hasExistingProfiles ? "Add another service" : "Select a service"}
          </p>
          <div className="flex justify-center gap-2">
            {providers.map((p) => {
              const Icon = resolveIcon(p.iconName)
              const isSelected = selectedProvider?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProvider(isSelected ? null : p)}
                  className={`flex items-center gap-2 rounded border px-4 py-2 transition-all ${
                    isSelected
                      ? "border-red-600 bg-red-950/20 shadow-[0_0_12px_rgba(220,38,38,0.15)]"
                      : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600"
                  }`}
                >
                  <Icon className="h-4 w-4 text-neutral-400" />
                  <span className="text-xs font-medium text-neutral-300">{p.name}</span>
                </button>
              )
            })}
            {comingSoon.map((p) => {
              const Icon = resolveIcon(p.iconName)
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded border border-neutral-800/40 px-4 py-2 opacity-30"
                >
                  <Icon className="h-4 w-4 text-neutral-600" />
                  <span className="text-xs text-neutral-600">{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upload zone — compact */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`relative flex items-center justify-center gap-3 border rounded px-6 py-5 transition-all cursor-pointer ${
            status === "dragging"
              ? "border-red-600 bg-red-950/20 shadow-[0_0_20px_rgba(220,38,38,0.15)]"
              : status === "success"
                ? "border-emerald-500/50 bg-emerald-500/5"
                : status === "error"
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.08)]"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileSelect}
          />

          {status === "success" ? (
            <>
              <CheckCircle className="h-6 w-6 text-emerald-400" />
              <p className="text-sm text-emerald-400">Authenticated. Redirecting...</p>
            </>
          ) : status === "error" ? (
            <>
              <AlertCircle className="h-6 w-6 text-red-400" />
              <p className="text-sm text-red-400">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
                onClick={(e) => {
                  e.stopPropagation()
                  setStatus("idle")
                  setErrorMessage("")
                }}
              >
                Retry
              </Button>
            </>
          ) : status === "validating" ? (
            <>
              <FileJson className="h-6 w-6 text-neutral-400 animate-pulse" />
              <p className="text-sm text-neutral-400">Validating...</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-neutral-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-neutral-300">
                  {selectedProvider
                    ? `Drop your ${selectedProvider.name} credential`
                    : "Drag and drop any credential"}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {selectedProvider ? selectedProvider.description : "Auto-detects service from credential format"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Paste toggle + paste area */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setShowPaste(!showPaste)
              if (status === "error") {
                setStatus("idle")
                setErrorMessage("")
              }
            }}
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <ClipboardPaste className="h-3 w-3" />
            {showPaste ? "Hide paste" : "Or paste credential JSON"}
          </button>
        </div>

        {showPaste && (
          <div className="space-y-2">
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder='{"refresh_token": "...", "client_id": "...", "client_secret": "..."}'
              spellCheck={false}
              className="w-full h-24 rounded border border-neutral-700 bg-neutral-900/50 p-2.5 font-mono text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-900/50 resize-none"
            />
            <Button
              size="sm"
              disabled={!pasteValue.trim() || status === "validating"}
              onClick={handlePasteSubmit}
              className="w-full bg-red-700 text-white hover:bg-red-600 disabled:opacity-40"
            >
              {status === "validating" ? "Validating..." : "Authenticate"}
            </Button>
          </div>
        )}

        {/* Footer — inline security badges */}
        {!showPaste && (
          <div className="flex justify-center gap-6 text-[10px] text-neutral-500">
            <span>Perpetual access</span>
            <span>Encrypted in-browser</span>
            <span>Pure API — no browser traces</span>
          </div>
        )}
      </div>
    </div>
  )
}
