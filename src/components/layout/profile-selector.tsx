"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Plus,
  Trash2,
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
                  onClick={async () => {
                    if (p.id !== activeProfile?.id) {
                      await switchProfile(p.id)
                      const targetProvider = getProvider(p.provider)
                      router.push(targetProvider?.defaultRoute ?? "/gmail")
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
            onClick={() => router.push("/?add=true")}
          >
            <Plus className="h-4 w-4" />
            Add new service
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
