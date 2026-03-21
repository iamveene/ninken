"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { AlertPanel } from "./alert-panel"
import { useAlerts } from "@/hooks/use-alerts"
import type { Alert } from "@/lib/alert-store"

export function AlertBadge() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissAlert,
  } = useAlerts({ limit: 20 })

  const handleAlertClick = useCallback(
    (alert: Alert) => {
      if (alert.actionUrl) {
        router.push(alert.actionUrl)
        setOpen(false)
      }
    },
    [router]
  )

  const handleViewAll = useCallback(() => {
    router.push("/alerts")
    setOpen(false)
  }, [router])

  const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label={`Alerts${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex items-center justify-center",
              "min-w-[16px] h-4 px-1 rounded-full",
              "bg-red-600 text-[9px] font-bold text-white",
              "animate-in fade-in zoom-in-50 duration-200"
            )}
          >
            {displayCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="p-0 w-auto border-border/60 bg-card shadow-xl"
      >
        <AlertPanel
          alerts={alerts}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDismiss={dismissAlert}
          onAlertClick={handleAlertClick}
          onViewAll={handleViewAll}
        />
      </PopoverContent>
    </Popover>
  )
}
