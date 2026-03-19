"use client"

import { formatDistanceToNow } from "date-fns"
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  Mail,
  HardDrive,
  Calendar,
  Users,
  Shield,
  Activity,
  Settings,
  Check,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Alert, AlertSeverity, AlertCategory } from "@/lib/alert-store"

function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return <AlertOctagon className="h-3.5 w-3.5 text-red-500 shrink-0" />
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    default:
      return <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
  }
}

function getCategoryIcon(category: AlertCategory) {
  switch (category) {
    case "email":
      return <Mail className="h-3 w-3 text-muted-foreground" />
    case "drive":
      return <HardDrive className="h-3 w-3 text-muted-foreground" />
    case "calendar":
      return <Calendar className="h-3 w-3 text-muted-foreground" />
    case "directory":
      return <Users className="h-3 w-3 text-muted-foreground" />
    case "token":
      return <Shield className="h-3 w-3 text-muted-foreground" />
    case "audit":
      return <Activity className="h-3 w-3 text-muted-foreground" />
    default:
      return <Settings className="h-3 w-3 text-muted-foreground" />
  }
}

function getSeverityBorderColor(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "border-l-red-500"
    case "warning":
      return "border-l-amber-500"
    default:
      return "border-l-blue-400"
  }
}

function groupByTime(alerts: Alert[]): { today: Alert[]; earlier: Alert[] } {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  return {
    today: alerts.filter((a) => a.timestamp >= startOfDay),
    earlier: alerts.filter((a) => a.timestamp < startOfDay),
  }
}

type AlertPanelProps = {
  alerts: Alert[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDismiss: (id: string) => void
  onAlertClick: (alert: Alert) => void
  onViewAll: () => void
}

export function AlertPanel({
  alerts,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onAlertClick,
  onViewAll,
}: AlertPanelProps) {
  const grouped = groupByTime(alerts)
  const hasUnread = alerts.some((a) => !a.read)

  return (
    <div className="w-80">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">Alerts</h3>
        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      <ScrollArea className="max-h-[360px]">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Shield className="h-8 w-8 opacity-40" />
            <p className="text-xs">No alerts</p>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Today
                </p>
                {grouped.today.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onMarkAsRead={onMarkAsRead}
                    onDismiss={onDismiss}
                    onClick={onAlertClick}
                  />
                ))}
              </div>
            )}
            {grouped.earlier.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Earlier
                </p>
                {grouped.earlier.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onMarkAsRead={onMarkAsRead}
                    onDismiss={onDismiss}
                    onClick={onAlertClick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {alerts.length > 0 && (
        <div className="border-t border-border/60 px-3 py-2">
          <button
            onClick={onViewAll}
            className="text-xs text-primary hover:text-primary/80 transition-colors w-full text-center"
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  )
}

function AlertItem({
  alert,
  onMarkAsRead,
  onDismiss,
  onClick,
}: {
  alert: Alert
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
  onClick: (alert: Alert) => void
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2 px-3 py-2 border-l-2 cursor-pointer hover:bg-muted/50 transition-colors",
        !alert.read ? getSeverityBorderColor(alert.severity) : "border-l-transparent",
        !alert.read && "bg-muted/20"
      )}
      onClick={() => {
        if (!alert.read) onMarkAsRead(alert.id)
        onClick(alert)
      }}
    >
      <div className="mt-0.5">
        {getSeverityIcon(alert.severity)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {getCategoryIcon(alert.category)}
          <span className="text-xs font-medium truncate">{alert.title}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
          {alert.description}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(alert.id)
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
        title="Dismiss"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  )
}
