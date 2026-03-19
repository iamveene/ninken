"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileJson, CheckCircle, AlertCircle, Shield, Lock, Zap, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NinkenLogo } from "@/components/logo"

type Status = "idle" | "dragging" | "validating" | "success" | "error"

export default function AuthPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [showPaste, setShowPaste] = useState(false)
  const [pasteValue, setPasteValue] = useState("")

  const submitToken = useCallback(
    async (text: string) => {
      setStatus("validating")
      setErrorMessage("")

      try {
        const data = JSON.parse(text)

        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Failed to authenticate")
        }

        setStatus("success")
        setTimeout(() => router.push("/gmail"), 500)
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
    [router]
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 p-4">
      <div className="w-full max-w-md space-y-10">
        <div className="flex flex-col items-center">
          <NinkenLogo
            className="text-center text-neutral-50"
            tagline="Your workspace. Your rules."
          />
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-neutral-400">
              Upload your token.json to connect
            </p>
          </div>

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
            onClick={() =>
              document.getElementById("file-input")?.click()
            }
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
                    Drag and drop your token.json
                  </p>
                  <p className="text-xs text-neutral-500">
                    Must contain refresh_token, client_id, and client_secret
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
              {showPaste ? "Hide paste option" : "Or paste your token JSON"}
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
              <p className="text-xs text-neutral-500">Perpetual access — your token auto-renews silently</p>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <p className="text-xs text-neutral-500">Secure — credentials stored locally, never sent to third parties</p>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <p className="text-xs text-neutral-500">Instant — no Google UI, no browser redirects</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
