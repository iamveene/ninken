"use client"

import { useState, useCallback } from "react"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useProvider } from "@/components/providers/provider-context"
import { buildRawCredential } from "@/lib/vault/reinject"
import type { VaultItem } from "@/lib/vault/types"

type ReinjectDialogProps = {
  item: VaultItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReinjectDialog({ item, open, onOpenChange }: ReinjectDialogProps) {
  const { addCredential } = useProvider()
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleReinject = useCallback(async () => {
    if (!item) return

    const rawCredential = buildRawCredential(item)
    if (!rawCredential) {
      setStatus("error")
      setErrorMsg("Cannot build credential from this vault item")
      return
    }

    setStatus("loading")
    setErrorMsg("")

    try {
      const result = await addCredential(rawCredential)
      if (result.success) {
        setStatus("success")
        setTimeout(() => {
          onOpenChange(false)
          setStatus("idle")
        }, 1500)
      } else {
        setStatus("error")
        setErrorMsg(result.error ?? "Reinjection failed")
      }
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Reinjection failed")
    }
  }, [item, addCredential, onOpenChange])

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setStatus("idle") }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Reinject Credential
          </DialogTitle>
          <DialogDescription>
            Add this extracted secret as a new Ninken credential profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Type</span>
            <Badge variant="secondary" className="text-xs">{item.type}</Badge>
            {item.subType && (
              <Badge variant="outline" className="text-[10px]">{item.subType}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Source</span>
            <span className="text-xs">
              {item.source.provider} / {item.source.service}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Value</span>
            <code className="text-[10px] font-mono text-muted-foreground truncate max-w-[300px]">
              {item.content.slice(0, 8)}{"..."}
            </code>
          </div>
        </div>

        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Credential added successfully
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={status === "loading"}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleReinject}
            disabled={status === "loading" || status === "success"}
            className="gap-1.5"
          >
            {status === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reinject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
