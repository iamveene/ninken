"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Link2, Trash2, UserPlus } from "lucide-react"
import { useShareFile, usePermissions } from "@/hooks/use-drive"
import type { DriveFile } from "@/hooks/use-drive"
import { toast } from "sonner"

type ShareDialogProps = {
  file: DriveFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLES = [
  { value: "reader", label: "Viewer" },
  { value: "commenter", label: "Commenter" },
  { value: "writer", label: "Editor" },
]

export function ShareDialog({ file, open, onOpenChange }: ShareDialogProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("reader")
  const [sharing, setSharing] = useState(false)
  const { share } = useShareFile()
  const { permissions, loading: permLoading, refetch, removePermission } = usePermissions(
    open && file ? file.id : null
  )

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleShare = async () => {
    if (!file || !email.trim()) return
    if (!isValidEmail(email.trim())) {
      toast.error("Please enter a valid email address")
      return
    }
    setSharing(true)
    try {
      await share(file.id, email.trim(), role)
      toast.success(`Shared with ${email}`)
      setEmail("")
      refetch()
    } catch {
      toast.error("Failed to share")
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = () => {
    if (file?.webViewLink) {
      navigator.clipboard.writeText(file.webViewLink)
      toast.success("Link copied to clipboard")
    }
  }

  const handleRemove = async (permId: string) => {
    try {
      await removePermission(permId)
      toast.success("Permission removed")
    } catch {
      toast.error("Failed to remove permission")
    }
  }

  if (!file) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{file.name}"</DialogTitle>
          <DialogDescription>Add people or copy the link</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleShare()}
            className="flex-1"
          />
          <Select value={role} onValueChange={(v) => { if (v) setRole(v) }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleShare} disabled={!email.trim() || sharing} size="icon">
            <UserPlus />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">People with access</p>
          {permLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permissions found</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {(perm.displayName || perm.emailAddress || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">
                      {perm.displayName || perm.emailAddress || perm.type}
                    </p>
                    {perm.emailAddress && perm.displayName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {perm.emailAddress}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {perm.role}
                  </Badge>
                  {perm.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${perm.displayName || perm.emailAddress || "permission"}`}
                      onClick={() => handleRemove(perm.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopyLink} className="gap-1.5">
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
