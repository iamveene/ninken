"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type Mode = "operate" | "audit" | "collection" | "studio"

const STORAGE_KEYS: Record<Mode, string> = {
  operate: "ninken:last-operate-path",
  audit: "ninken:last-audit-path",
  collection: "ninken:last-collection-path",
  studio: "ninken:last-studio-path",
}

const DEFAULT_PATHS: Record<Mode, string> = {
  operate: "/dashboard",
  audit: "/audit",
  collection: "/collection",
  studio: "/studio",
}

function getMode(pathname: string): Mode {
  if (pathname.startsWith("/audit") || pathname.startsWith("/m365-audit")) return "audit"
  if (pathname.startsWith("/studio")) return "studio"
  if (pathname.startsWith("/collection")) return "collection"
  return "operate" // includes /dashboard, /m365-dashboard, and all service pages
}

export function ModeToggle() {
  const pathname = usePathname()
  const mode = getMode(pathname)

  // Store current pathname for the active mode
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS[mode], pathname)
  }, [mode, pathname])

  function getHref(target: Mode): string {
    if (target === mode) return pathname
    if (typeof window === "undefined") return DEFAULT_PATHS[target]
    return sessionStorage.getItem(STORAGE_KEYS[target]) || DEFAULT_PATHS[target]
  }

  const modes: { id: Mode; label: string }[] = [
    { id: "operate", label: "Operate" },
    { id: "audit", label: "Audit" },
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
