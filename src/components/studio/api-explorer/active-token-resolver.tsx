"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { getProfileProviders } from "@/lib/providers/types"
import { resolveIcon } from "@/lib/icon-resolver"
import "@/lib/providers"

interface ActiveTokenResolverProps {
  onResolve: (token: string, provider: string) => void
  resolvedToken: string
  resolvedProvider: string
  error: string
}

function maskToken(token: string): string {
  if (token.length <= 20) return token
  return token.slice(0, 12) + "..." + token.slice(-8)
}

export function ActiveTokenResolver({
  onResolve,
  resolvedToken,
  resolvedProvider,
  error,
}: ActiveTokenResolverProps) {
  const { profile, provider, switchProviderInProfile } = useProvider()
  const [resolving, setResolving] = useState(false)
  const [localError, setLocalError] = useState("")

  const providerIds = profile ? getProfileProviders(profile) : []
  const hasMultipleProviders = providerIds.length > 1

  const activeProviderDef = getProvider(provider)
  const ProviderIcon = activeProviderDef ? resolveIcon(activeProviderDef.iconName) : null

  const resolve = useCallback(async () => {
    setResolving(true)
    setLocalError("")
    try {
      const res = await fetch("/api/studio/resolve-token", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || `HTTP ${res.status}`
        setLocalError(msg)
        onResolve("", "")
        return
      }
      onResolve(data.token, data.provider)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setLocalError(msg)
      onResolve("", "")
    } finally {
      setResolving(false)
    }
  }, [onResolve])

  const displayError = error || localError

  if (!profile) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          No active profile. Add a credential first.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Active provider badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] gap-1">
          {ProviderIcon && <ProviderIcon className="h-3 w-3" />}
          {activeProviderDef?.name ?? provider}
        </Badge>
      </div>

      {/* Provider switcher (only if multiple linked providers) */}
      {hasMultipleProviders && (
        <div className="flex gap-1 flex-wrap">
          {providerIds.map((pid) => {
            const pDef = getProvider(pid)
            const Icon = pDef ? resolveIcon(pDef.iconName) : null
            const isActive = pid === provider
            return (
              <button
                key={pid}
                type="button"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  if (!isActive) switchProviderInProfile(pid)
                }}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {pDef?.name ?? pid}
              </button>
            )
          })}
        </div>
      )}

      {/* Resolve button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        disabled={resolving}
        onClick={resolve}
      >
        {resolving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Zap className="h-3 w-3" />
        )}
        {resolving ? "Resolving..." : "Resolve Token"}
      </Button>

      {/* Success state */}
      {resolvedToken && !displayError && (
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
          <span className="font-mono text-[10px] text-muted-foreground truncate">
            {maskToken(resolvedToken)}
          </span>
          {resolvedProvider && (
            <Badge variant="secondary" className="text-[9px]">
              {resolvedProvider}
            </Badge>
          )}
        </div>
      )}

      {/* Error state */}
      {displayError && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{displayError}</span>
        </div>
      )}
    </div>
  )
}
