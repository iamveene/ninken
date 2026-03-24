"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRenameFile } from "@/hooks/use-drive"
import { toast } from "sonner"
import type { DriveFile } from "@/hooks/use-drive"

type RenameDialogProps = {
  file: DriveFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed?: () => void
}

export function RenameDialog({ file, open, onOpenChange, onRenamed }: RenameDialogProps) {
  const [name, setName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const { rename } = useRenameFile()

  useEffect(() => {
    if (file) setName(file.name)
  }, [file])

  const handleRename = async () => {
    if (!file || !name.trim() || name === file.name) return
    setRenaming(true)
    try {
      await rename(file.id, name.trim())
      toast.success("File renamed")
      onOpenChange(false)
      onRenamed?.()
    } catch {
      toast.error("Failed to rename")
    } finally {
      setRenaming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={renaming || !name.trim() || name === file?.name}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
