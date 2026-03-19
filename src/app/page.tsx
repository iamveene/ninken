"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertCircle,
  Shield,
  Lock,
  Zap,
  ClipboardPaste,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NinkenLogo } from "@/components/logo"
import { getAllProviders, detectProvider, getProvider } from "@/lib/providers"
import { resolveIcon } from "@/lib/icon-resolver"
import type { ServiceProvider } from "@/lib/providers/types"
import {
  addProfile,
  getAllProfiles,
  getActiveProfileId,
  setActiveProfileId,
} from "@/lib/token-store"
import { activateProfile, migrateFromCookies } from "@/lib/token-sync"

type Status = "idle" | "dragging" | "validating" | "success" | "error"

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900">
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

  const providers = getAllProviders()

  // On mount: check for legacy cookies and migrate
  useEffect(() => {
    async function init() {
      try {
        const migrated = await migrateFromCookies()
        if (migrated) {
          const profiles = await getAllProfiles()
          if (profiles.length > 0) {
            setHasExistingProfiles(true)
            // If ?add=true, stay on landing page for new service upload
            if (isAddMode) {
              setMigrating(false)
              return
            }
            const providerConfig = getProvider(profiles[0].provider)
            router.push(providerConfig?.defaultRoute ?? "/gmail")
            return
          }
        }

        // Also check if we already have profiles in IndexedDB
        const existing = await getAllProfiles()
        if (existing.length > 0) {
          setHasExistingProfiles(true)
          // If ?add=true, stay on landing page for new service upload
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
        // Non-critical — show landing page
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

        // Auto-detect or use selected provider
        const provider = selectedProvider ?? detectProvider(data)
        if (!provider) {
          throw new Error(
            "Unrecognized credential format. Select a service manually."
          )
        }

        const result = provider.validateCredential(data)
        if (!result.valid) {
          throw new Error(result.error)
        }

        // Store in encrypted IndexedDB
        const profile = await addProfile(
          provider.id,
          result.credential,
          result.email
        )

        // Activate (sets server cookie)
        await activateProfile(profile.id)

        // Try to fetch email if not already set
        if (!result.email && provider.emailEndpoint) {
          try {
            const profileRes = await fetch(provider.emailEndpoint)
            if (profileRes.ok) {
              const profileData = await profileRes.json()
              if (profileData.emailAddress) {
                const { updateProfileEmail } = await import(
                  "@/lib/token-store"
                )
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900">
        <div className="animate-pulse text-sm text-neutral-500">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 p-4 pt-0">
      <div className="w-full max-w-2xl space-y-10">
        <div className="flex flex-col items-center">
          <NinkenLogo
            className="text-center text-neutral-50"
          />
        </div>

        {/* Back to active services */}
        {hasExistingProfiles && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={async () => {
                const profiles = await getAllProfiles()
                const activeId = getActiveProfileId()
                const active = profiles.find((p) => p.id === activeId) ?? profiles[0]
                if (active) {
                  await activateProfile(active.id)
                  const providerConfig = getProvider(active.provider)
                  router.push(providerConfig?.defaultRoute ?? "/gmail")
                }
              }}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to active services
            </button>
          </div>
        )}

        {/* Service grid */}
        <div className="space-y-4">
          <p className="text-center text-xs text-neutral-500 uppercase tracking-wider">
            {hasExistingProfiles
              ? "Add another service"
              : "Select a service or drop any credential"}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {providers.map((p) => {
              const Icon = resolveIcon(p.iconName)
              const isSelected = selectedProvider?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedProvider(isSelected ? null : p)
                  }
                  className={`flex flex-col items-center gap-2 rounded-md border p-4 transition-all text-center ${
                    isSelected
                      ? "border-red-600 bg-red-950/20 shadow-[0_0_15px_rgba(220,38,38,0.15)]"
                      : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600"
                  }`}
                >
                  <Icon className="h-6 w-6 text-neutral-400" />
                  <span className="text-xs font-medium text-neutral-300">
                    {p.name}
                  </span>
                </button>
              )
            })}
            {/* Coming soon placeholders */}
            {(
              [
                { name: "Microsoft 365", iconName: "Monitor" },
                { name: "GitHub", iconName: "Globe" },
                { name: "AWS", iconName: "Globe" },
              ] as const
            )
              .filter((p) => !providers.some((r) => r.name === p.name))
              .map((p) => {
                const Icon = resolveIcon(p.iconName)
                return (
                  <div
                    key={p.name}
                    className="flex flex-col items-center gap-2 rounded-md border border-neutral-800/50 p-4 opacity-40"
                  >
                    <Icon className="h-6 w-6 text-neutral-600" />
                    <span className="text-xs text-neutral-600">{p.name}</span>
                    <span className="text-[10px] text-neutral-700">
                      Coming soon
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Upload zone */}
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`relative flex flex-col items-center justify-center gap-4 border p-8 transition-all cursor-pointer rounded-md ${
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
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  Authenticated. Redirecting...
                </p>
              </>
            ) : status === "error" ? (
              <>
                <AlertCircle className="h-10 w-10 text-red-400" />
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
                  Try again
                </Button>
              </>
            ) : status === "validating" ? (
              <>
                <FileJson className="h-10 w-10 text-neutral-400 animate-pulse" />
                <p className="text-sm text-neutral-400">Validating...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-neutral-500" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-neutral-300">
                    {selectedProvider
                      ? `Drop your ${selectedProvider.name} credential`
                      : "Drag and drop any credential"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {selectedProvider
                      ? selectedProvider.description
                      : "Auto-detects service from credential format"}
                  </p>
                </div>
              </>
            )}
          </div>

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
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ClipboardPaste className="h-3 w-3" />
              {showPaste ? "Hide paste option" : "Or paste your credential JSON"}
            </button>
          </div>

          {showPaste && (
            <div className="space-y-3">
              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder='{"refresh_token": "...", "client_id": "...", "client_secret": "..."}'
                spellCheck={false}
                className="w-full h-32 rounded-md border border-neutral-700 bg-neutral-900/50 p-3 font-mono text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-900/50 resize-none"
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

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <p className="text-xs text-neutral-500">
                Perpetual access — your token auto-renews silently
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <p className="text-xs text-neutral-500">
                Secure — credentials encrypted in browser, never sent to third
                parties
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <p className="text-xs text-neutral-500">
                Instant — no browser redirects, pure API access
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
