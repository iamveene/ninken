"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "ninken:last-operate-path"

export function ModeToggle() {
  const pathname = usePathname()
  const mode = pathname.startsWith("/audit") ? "audit" : "operate"

  // Store current pathname when in operate mode
  useEffect(() => {
    if (mode === "operate") {
      sessionStorage.setItem(STORAGE_KEY, pathname)
    }
  }, [mode, pathname])

  const operateHref =
    mode === "operate"
      ? pathname
      : (typeof window !== "undefined"
          ? sessionStorage.getItem(STORAGE_KEY)
          : null) || "/gmail"

  return (
    <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5">
      <Link
        href={operateHref}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          mode === "operate"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Operate
      </Link>
      <Link
        href="/audit"
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          mode === "audit"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Audit
      </Link>
    </div>
  )
}
