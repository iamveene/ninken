"use client"

import {
  Inbox,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { OutlookFolder } from "@/hooks/use-outlook"

const SYSTEM_FOLDERS = [
  { displayName: "Inbox", icon: Inbox },
  { displayName: "Sent Items", icon: Send },
  { displayName: "Drafts", icon: FileText },
  { displayName: "Deleted Items", icon: Trash2 },
  { displayName: "Junk Email", icon: AlertOctagon },
]

type FolderSidebarProps = {
  folders: OutlookFolder[]
  activeFolderId: string | null
  onFolderChange: (folderId: string) => void
  onCompose: () => void
  loading?: boolean
}

export function FolderSidebar({
  folders,
  activeFolderId,
  onFolderChange,
  onCompose,
  loading,
}: FolderSidebarProps) {
  if (loading) {
    return (
      <div className="flex w-[200px] flex-col gap-2 border-r bg-muted/30 p-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-2 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Match system folders by displayName
  const systemFolders = SYSTEM_FOLDERS.map((sf) => {
    const match = folders.find(
      (f) => f.displayName.toLowerCase() === sf.displayName.toLowerCase()
    )
    return { ...sf, folder: match }
  }).filter((sf) => sf.folder)

  // Custom folders = anything not in the system list
  const systemNames = new Set(SYSTEM_FOLDERS.map((sf) => sf.displayName.toLowerCase()))
  const customFolders = folders.filter(
    (f) => !systemNames.has(f.displayName.toLowerCase())
  )

  return (
    <div className="flex w-[200px] flex-col border-r bg-muted/30">
      <div className="p-3 pb-2">
        <Button className="w-full gap-2 shadow-sm" size="default" onClick={onCompose}>
          <Plus className="size-4" />
          New Mail
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 px-2 pb-4 pt-1">
          {systemFolders.map(({ displayName, icon: Icon, folder }) => {
            if (!folder) return null
            const isActive = activeFolderId === folder.id
            return (
              <button
                key={folder.id}
                onClick={() => onFolderChange(folder.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                  "hover:bg-accent/60",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80"
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
                <span className="flex-1 truncate text-left">{displayName}</span>
                {folder.unreadItemCount > 0 && (
                  <span
                    className={cn(
                      "ml-auto text-[11px] tabular-nums",
                      isActive ? "font-bold text-primary" : "font-semibold text-muted-foreground"
                    )}
                  >
                    {folder.unreadItemCount > 999 ? "999+" : folder.unreadItemCount}
                  </span>
                )}
              </button>
            )
          })}

          {customFolders.length > 0 && (
            <>
              <div className="mt-5 mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Folders
              </div>
              {customFolders.map((folder) => {
                const isActive = activeFolderId === folder.id
                return (
                  <button
                    key={folder.id}
                    onClick={() => onFolderChange(folder.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors duration-150",
                      "hover:bg-accent/60",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80"
                    )}
                  >
                    <span className="flex-1 truncate text-left">{folder.displayName}</span>
                    {folder.unreadItemCount > 0 && (
                      <span className="ml-auto text-[11px] tabular-nums font-semibold text-muted-foreground">
                        {folder.unreadItemCount}
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
