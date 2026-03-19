"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Check, Plus, Trash2, Upload, ClipboardPaste, FileJson } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
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

type Profile = {
  email: string | null
  index: number
}

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

function getInitials(email: string | null): string {
  if (!email) return "?"
  const name = email.split("@")[0]
  return name.slice(0, 2).toUpperCase()
}

function getColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

export function ProfileSelector() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState(0)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/auth")
      if (!res.ok) return
      const data = await res.json()
      setProfiles(data.profiles || [])
      setActiveProfile(data.activeProfile ?? 0)

      // Fetch email for profiles that don't have one
      for (const profile of data.profiles || []) {
        if (!profile.email && data.profiles.length > 0) {
          // Switch to that profile temporarily, fetch email, update
          fetchEmailForProfile(profile.index)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const fetchEmailForProfile = async (index: number) => {
    try {
      // We need to temporarily switch to get this profile's email
      // Only do this for the active profile to avoid side effects
      const profileRes = await fetch("/api/gmail/profile")
      if (!profileRes.ok) return
      const profileData = await profileRes.json()
      if (profileData.emailAddress) {
        await fetch("/api/auth", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index, email: profileData.emailAddress }),
        })
        fetchProfiles()
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Fetch email for active profile if missing
  useEffect(() => {
    const active = profiles.find((p) => p.index === activeProfile)
    if (active && !active.email) {
      fetchEmailForProfile(activeProfile)
    }
  }, [activeProfile, profiles])

  const switchProfile = async (index: number) => {
    try {
      await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProfile: index }),
      })
      setActiveProfile(index)
      router.refresh()
      // Fetch email if missing for newly active profile
      const profile = profiles.find((p) => p.index === index)
      if (profile && !profile.email) {
        fetchEmailForProfile(index)
      }
    } catch {
      // ignore
    }
  }

  const removeProfile = async (index: number) => {
    try {
      const res = await fetch("/api/auth", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      })
      const data = await res.json()
      setConfirmRemove(null)
      if (!data.authenticated) {
        router.push("/")
        return
      }
      fetchProfiles()
      router.refresh()
    } catch {
      // ignore
    }
  }

  const activeProfileData = profiles.find((p) => p.index === activeProfile)

  if (profiles.length === 0) return null

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
              className={`${getColor(activeProfile)} text-white text-xs font-medium`}
            >
              {getInitials(activeProfileData?.email ?? null)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuLabel>Accounts</DropdownMenuLabel>
          {profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.index}
              className="gap-2"
              onClick={() => {
                if (profile.index !== activeProfile) {
                  switchProfile(profile.index)
                }
              }}
            >
              <Avatar size="sm">
                <AvatarFallback
                  className={`${getColor(profile.index)} text-white text-xs font-medium`}
                >
                  {getInitials(profile.email)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-xs">
                {profile.email || `Account ${profile.index + 1}`}
              </span>
              {profile.index === activeProfile && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
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
              onClick={() => setConfirmRemove(activeProfile)}
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
          fetchProfiles()
          router.refresh()
        }}
      />

      <Dialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove account</DialogTitle>
            <DialogDescription>
              Remove {activeProfileData?.email || `Account ${(confirmRemove ?? 0) + 1}`}? This will delete the stored credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmRemove !== null && removeProfile(confirmRemove)}
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
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to authenticate")
      }

      // Fetch email for the new profile
      try {
        const profileRes = await fetch("/api/gmail/profile")
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          const authData = await res.json().catch(() => null)
          if (profileData.emailAddress) {
            const authInfo = await fetch("/api/auth").then((r) => r.json())
            await fetch("/api/auth", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                index: authInfo.activeProfile,
                email: profileData.emailAddress,
              }),
            })
          }
        }
      } catch {
        // Non-critical — email will be fetched later
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
            Upload or paste a token.json for another Google account.
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
              onClick={() => document.getElementById("add-account-file")?.click()}
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
                {status === "validating" ? "Validating..." : "Drop token.json or click to browse"}
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
