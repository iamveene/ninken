"use client"

import { useCallback } from "react"
import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  AlertTriangle,
  Tag,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { GmailLabel } from "@/hooks/use-gmail"

const SYSTEM_LABELS = [
  { id: "INBOX", name: "Inbox", icon: Inbox },
  { id: "STARRED", name: "Starred", icon: Star },
  { id: "SENT", name: "Sent", icon: Send },
  { id: "DRAFT", name: "Drafts", icon: FileText },
  { id: "IMPORTANT", name: "Important", icon: AlertOctagon },
  { id: "SPAM", name: "Spam", icon: AlertTriangle },
  { id: "TRASH", name: "Trash", icon: Trash2 },
]

type LabelSidebarProps = {
  labels: GmailLabel[]
  activeLabel: string
  onLabelChange: (labelId: string) => void
  onCompose: () => void
  loading?: boolean
}

export function LabelSidebar({
  labels,
  activeLabel,
  onLabelChange,
  onCompose,
  loading,
}: LabelSidebarProps) {
  const getUnreadCount = useCallback(
    (labelId: string) => {
      const label = labels.find((l) => l.id === labelId)
      return label?.messagesUnread ?? 0
    },
    [labels]
  )

  const customLabels = labels.filter(
    (l) => l.type === "user" && !SYSTEM_LABELS.some((s) => s.id === l.id)
  )

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-2 border-r bg-muted/30 p-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-2 space-y-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col border-r bg-muted/30">
      <div className="p-3 pb-2">
        <Button className="w-full gap-2 shadow-sm" size="default" onClick={onCompose}>
          <Plus className="size-4" />
          Compose
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 px-2 pb-4 pt-1">
          {SYSTEM_LABELS.map((item) => {
            const unread = getUnreadCount(item.id)
            const isActive = activeLabel === item.id
            return (
              <button
                key={item.id}
                onClick={() => onLabelChange(item.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                  "hover:bg-accent/60",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80"
                )}
              >
                <item.icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
                <span className="flex-1 truncate text-left">{item.name}</span>
                {unread > 0 && (
                  <span className={cn(
                    "ml-auto text-[11px] tabular-nums",
                    isActive ? "font-bold text-primary" : "font-semibold text-muted-foreground"
                  )}>
                    {unread > 999 ? "999+" : unread}
                  </span>
                )}
              </button>
            )
          })}

          {customLabels.length > 0 && (
            <>
              <div className="mt-5 mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Labels
              </div>
              {customLabels.map((label) => {
                const isActive = activeLabel === label.id
                return (
                  <button
                    key={label.id}
                    onClick={() => onLabelChange(label.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors duration-150",
                      "hover:bg-accent/60",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80"
                    )}
                  >
                    <Tag className={cn("size-[15px] shrink-0", isActive && "text-primary")} />
                    <span className="flex-1 truncate text-left">{label.name}</span>
                    {(label.messagesUnread ?? 0) > 0 && (
                      <span className="ml-auto text-[11px] tabular-nums font-semibold text-muted-foreground">
                        {label.messagesUnread}
                      </span>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}
