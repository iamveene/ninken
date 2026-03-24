"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
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
  Search,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { useAlerts } from "@/hooks/use-alerts"
import type { Alert, AlertSeverity, AlertCategory } from "@/lib/alert-store"

const CATEGORIES: { value: AlertCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "token", label: "Token" },
  { value: "email", label: "Email" },
  { value: "drive", label: "Drive" },
  { value: "calendar", label: "Calendar" },
  { value: "directory", label: "Directory" },
  { value: "audit", label: "Audit" },
  { value: "system", label: "System" },
]

const SEVERITIES: { value: AlertSeverity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
]

function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return <AlertOctagon className="h-4 w-4 text-red-500" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    default:
      return <Info className="h-4 w-4 text-blue-400" />
  }
}

function getCategoryIcon(category: AlertCategory) {
  switch (category) {
    case "email":
      return <Mail className="h-3.5 w-3.5" />
    case "drive":
      return <HardDrive className="h-3.5 w-3.5" />
    case "calendar":
      return <Calendar className="h-3.5 w-3.5" />
    case "directory":
      return <Users className="h-3.5 w-3.5" />
    case "token":
      return <Shield className="h-3.5 w-3.5" />
    case "audit":
      return <Activity className="h-3.5 w-3.5" />
    default:
      return <Settings className="h-3.5 w-3.5" />
  }
}

function getSeverityBorder(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "border-l-red-500"
    case "warning":
      return "border-l-amber-500"
    default:
      return "border-l-blue-400"
  }
}

export default function AlertsPage() {
  const router = useRouter()
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissAlert,
    clearAlerts,
  } = useAlerts()

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | "all">("all")
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all")
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all")
  const [showClearDialog, setShowClearDialog] = useState(false)

  const filteredAlerts = alerts.filter((alert) => {
    if (categoryFilter !== "all" && alert.category !== categoryFilter) return false
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false
    if (readFilter === "unread" && alert.read) return false
    if (readFilter === "read" && !alert.read) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        alert.title.toLowerCase().includes(q) ||
        alert.description.toLowerCase().includes(q) ||
        alert.source.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleAlertClick = useCallback(
    (alert: Alert) => {
      if (!alert.read) markAsRead(alert.id)
      if (alert.actionUrl) router.push(alert.actionUrl)
    },
    [markAsRead, router]
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Alert Center</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear all
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors",
                categoryFilter === cat.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          {SEVERITIES.map((sev) => (
            <button
              key={sev.value}
              onClick={() => setSeverityFilter(sev.value)}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors",
                severityFilter === sev.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {sev.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {(["all", "unread", "read"] as const).map((val) => (
            <button
              key={val}
              onClick={() => setReadFilter(val)}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors capitalize",
                readFilter === val
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Shield className="h-12 w-12 opacity-30" />
          <p className="text-sm">No alerts match your filters</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "group flex items-start gap-3 px-4 py-3 rounded-lg border-l-2 cursor-pointer hover:bg-muted/50 transition-colors",
                !alert.read ? getSeverityBorder(alert.severity) : "border-l-transparent",
                !alert.read && "bg-muted/20"
              )}
              onClick={() => handleAlertClick(alert)}
            >
              <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{alert.title}</span>
                  <Badge variant="secondary" className="h-4 text-[10px] gap-1 px-1.5">
                    {getCategoryIcon(alert.category)}
                    {alert.category}
                  </Badge>
                  {!alert.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.description}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/60">
                  <span>{alert.source}</span>
                  <span>-</span>
                  <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  dismissAlert(alert.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Clear all dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all alerts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all alerts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAlerts()
                setShowClearDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
