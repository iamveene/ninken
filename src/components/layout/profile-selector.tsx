"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Plus,
  Trash2,
  Upload,
  ClipboardPaste,
  FileJson,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useProvider } from "@/components/providers/provider-context"
import { resolveIcon } from "@/lib/icon-resolver"
import { getProvider } from "@/lib/providers/registry"
import "@/lib/providers"

const AVATAR_COLORS = [
  "bg-red-700",
  "bg-neutral-600",
  "bg-red-900",
  "bg-neutral-700",
  "bg-red-800",
  "bg-neutral-500",
  "bg-red-600",
  "bg-neutral-800",
]

function getInitials(email: string | undefined | null): string {
  if (!email) return "?"
  const name = email.split("@")[0]
  return name.slice(0, 2).toUpperCase()
}

function getColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

export function ProfileSelector() {
  const router = useRouter()
  const {
    profile: activeProfile,
    profiles,
    switchProfile,
    removeCurrentProfile,
    updateEmail,
    loading,
  } = useProvider()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Fetch email for active profile if missing
  const fetchEmailIfNeeded = useCallback(async () => {
    if (!activeProfile || activeProfile.email) return
    const providerConfig = getProvider(activeProfile.provider)
    if (!providerConfig?.emailEndpoint) return
    try {
      const res = await fetch(providerConfig.emailEndpoint)
      if (!res.ok) return
      const data = await res.json()
      if (data.emailAddress) {
        await updateEmail(activeProfile.id, data.emailAddress)
      }
    } catch {
      // Non-critical
    }
  }, [activeProfile, updateEmail])

  // Auto-fetch email when active profile changes
  useEffect(() => {
    fetchEmailIfNeeded()
  }, [fetchEmailIfNeeded])

  if (loading || profiles.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="outline-none"
          render={
            <button
              type="button"
              className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <Avatar size="sm">
            <AvatarFallback
              className={`${getColor(activeProfile ? profiles.findIndex((p) => p.id === activeProfile.id) : 0)} text-white text-xs font-medium`}
            >
              {getInitials(activeProfile?.email)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Accounts</DropdownMenuLabel>
            {profiles.map((p, i) => {
              const providerConfig = getProvider(p.provider)
              const ProviderIcon = providerConfig
                ? resolveIcon(providerConfig.iconName)
                : null
              return (
                <DropdownMenuItem
                  key={p.id}
                  className="gap-2"
                  onClick={() => {
                    if (p.id !== activeProfile?.id) {
                      switchProfile(p.id)
                      router.refresh()
                    }
                  }}
                >
                  <Avatar size="sm">
                    <AvatarFallback
                      className={`${getColor(i)} text-white text-xs font-medium`}
                    >
                      {getInitials(p.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-xs">
                    {p.email || p.label || `Account ${i + 1}`}
                  </span>
                  {ProviderIcon && (
                    <ProviderIcon className="h-3 w-3 text-muted-foreground" />
                  )}
                  {p.id === activeProfile?.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Add account
          </DropdownMenuItem>
          {profiles.length > 0 && (
            <DropdownMenuItem
              className="gap-2"
              variant="destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="h-4 w-4" />
              Remove current account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          setShowAddDialog(false)
          router.refresh()
        }}
      />

      <Dialog
        open={confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove account</DialogTitle>
            <DialogDescription>
              Remove{" "}
              {activeProfile?.email || "this account"}? This
              will delete the stored credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await removeCurrentProfile()
                setConfirmRemove(false)
                if (profiles.length <= 1) {
                  router.push("/")
                } else {
                  router.refresh()
                }
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddAccountDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<"file" | "paste">("file")
  const [status, setStatus] = useState<"idle" | "validating" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [pasteValue, setPasteValue] = useState("")
  const { addCredential } = useProvider()

  const reset = () => {
    setMode("file")
    setStatus("idle")
    setErrorMessage("")
    setPasteValue("")
  }

  const submitToken = async (text: string) => {
    setStatus("validating")
    setErrorMessage("")

    try {
      const data = JSON.parse(text)
      const result = await addCredential(data)

      if (!result.success) {
        throw new Error(result.error || "Failed to authenticate")
      }

      // Try to fetch email
      try {
        const profileRes = await fetch("/api/gmail/profile")
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.emailAddress) {
            // Email will be updated through the provider context
          }
        }
      } catch {
        // Non-critical
      }

      reset()
      onSuccess()
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
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    submitToken(text)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            Upload or paste a credential file for any supported service.
          </DialogDescription>
        </DialogHeader>

        {mode === "file" ? (
          <div className="space-y-3">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() =>
                document.getElementById("add-account-file")?.click()
              }
            >
              <input
                id="add-account-file"
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
              {status === "validating" ? (
                <FileJson className="h-8 w-8 text-muted-foreground animate-pulse" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {status === "validating"
                  ? "Validating..."
                  : "Drop credential file or click to browse"}
              </p>
            </div>
            {status === "error" && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setMode("paste")
                setStatus("idle")
                setErrorMessage("")
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ClipboardPaste className="h-3 w-3" />
              Or paste JSON
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder='{"refresh_token": "...", "client_id": "...", "client_secret": "..."}'
              spellCheck={false}
              className="w-full h-28 rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            {status === "error" && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMode("file")
                  setStatus("idle")
                  setErrorMessage("")
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="h-3 w-3" />
                Upload file instead
              </button>
              <Button
                size="sm"
                disabled={!pasteValue.trim() || status === "validating"}
                onClick={() => submitToken(pasteValue.trim())}
              >
                {status === "validating" ? "Validating..." : "Add account"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
