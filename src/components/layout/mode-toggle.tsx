"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type Mode = "operate" | "audit" | "collection" | "studio" | "graph"

const STORAGE_KEYS: Record<Mode, string> = {
  operate: "ninken:last-operate-path",
  audit: "ninken:last-audit-path",
  collection: "ninken:last-collection-path",
  studio: "ninken:last-studio-path",
  graph: "ninken:last-graph-path",
}

const DEFAULT_PATHS: Record<Mode, string> = {
  operate: "/dashboard",
  audit: "/audit",
  collection: "/collection",
  studio: "/studio",
  graph: "/graph",
}

function getMode(pathname: string): Mode {
  if (pathname.startsWith("/audit") || pathname.startsWith("/m365-audit")) return "audit"
  if (pathname.startsWith("/studio")) return "studio"
  if (pathname.startsWith("/collection")) return "collection"
  if (pathname.startsWith("/graph")) return "graph"
  return "operate"
}

export function ModeToggle() {
  const pathname = usePathname()
  const mode = getMode(pathname)

  // Resolve stored hrefs after hydration to avoid server/client mismatch
  const [storedHrefs, setStoredHrefs] = useState<Record<Mode, string>>(DEFAULT_PATHS)

  useEffect(() => {
    // Persist current pathname for the active mode
    sessionStorage.setItem(STORAGE_KEYS[mode], pathname)

    // Read stored paths from sessionStorage (client-only)
    setStoredHrefs({
      operate: sessionStorage.getItem(STORAGE_KEYS.operate) || DEFAULT_PATHS.operate,
      audit: sessionStorage.getItem(STORAGE_KEYS.audit) || DEFAULT_PATHS.audit,
      collection: sessionStorage.getItem(STORAGE_KEYS.collection) || DEFAULT_PATHS.collection,
      studio: sessionStorage.getItem(STORAGE_KEYS.studio) || DEFAULT_PATHS.studio,
      graph: sessionStorage.getItem(STORAGE_KEYS.graph) || DEFAULT_PATHS.graph,
    })
  }, [mode, pathname])

  function getHref(target: Mode): string {
    if (target === mode) return pathname
    return storedHrefs[target]
  }

  const modes: { id: Mode; label: string }[] = [
    { id: "operate", label: "Operate" },
    { id: "audit", label: "Audit" },
    { id: "collection", label: "Collect" },
    { id: "studio", label: "Studio" },
    { id: "graph", label: "Graph" },
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
