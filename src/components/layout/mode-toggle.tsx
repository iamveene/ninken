"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { getProviderFromPathname } from "@/lib/providers/routes"
import { getMode } from "@/lib/mode"
import type { Mode } from "@/lib/mode"
import type { ProviderId } from "@/lib/providers/types"
import "@/lib/providers"

/** Provider-scoped storage key so mode tabs don't cross-navigate after profile switch. */
function storageKey(provider: ProviderId, mode: Mode): string {
  return `ninken:${provider}:last-${mode}-path`
}

export function ModeToggle() {
  const pathname = usePathname()
  const mode = getMode(pathname)
  const { provider } = useProvider()

  // Compute provider-aware default explore path (e.g., /m365-audit for Microsoft)
  const providerConfig = getProvider(provider)
  const exploreDefault = providerConfig?.exploreNavGroups?.[0]?.items?.[0]?.href ?? "/audit"
  const defaultPaths: Record<Mode, string> = {
    operate: providerConfig?.defaultRoute ?? "/dashboard",
    explore: exploreDefault,
    collection: "/collection",
    studio: "/studio",
  }

  // Resolve stored hrefs after hydration to avoid server/client mismatch
  const [storedHrefs, setStoredHrefs] = useState<Record<Mode, string>>(defaultPaths)

  useEffect(() => {
    // Guard: only persist pathname if it belongs to the current provider (or is
    // provider-agnostic). When switching profiles the context `provider` updates
    // before `pathname` catches up, which previously stored M365 paths under the
    // Google key (cross-provider contamination race condition).
    const pathnameProvider = getProviderFromPathname(pathname)
    if (!pathnameProvider || pathnameProvider === provider) {
      sessionStorage.setItem(storageKey(provider, mode), pathname)
    }

    // Read stored paths from sessionStorage (client-only), scoped to current provider
    setStoredHrefs({
      operate: sessionStorage.getItem(storageKey(provider, "operate")) || defaultPaths.operate,
      explore: sessionStorage.getItem(storageKey(provider, "explore")) || defaultPaths.explore,
      collection: sessionStorage.getItem(storageKey(provider, "collection")) || defaultPaths.collection,
      studio: sessionStorage.getItem(storageKey(provider, "studio")) || defaultPaths.studio,
    })
  }, [mode, pathname, provider, defaultPaths.operate, defaultPaths.explore])

  function getHref(target: Mode): string {
    if (target === mode) return pathname
    return storedHrefs[target]
  }

  const modes: { id: Mode; label: string }[] = [
    { id: "operate", label: "Operate" },
    { id: "explore", label: "Explore" },
    { id: "collection", label: "Collect" },
    { id: "studio", label: "Studio" },
  ]

  return (
    <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5">
      {modes.map((m) => (
        <Link
          key={m.id}
          href={getHref(m.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            mode === m.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m.label}
        </Link>
      ))}
    </div>
  )
}
