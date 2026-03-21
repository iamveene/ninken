"use client"

import { useState, useCallback, useEffect } from "react"
import { Minus, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useSendMessage, useSaveDraft } from "@/hooks/use-gmail"

type ComposeMode = "new" | "reply" | "forward"

type ComposeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: ComposeMode
  prefill?: {
    to?: string
    cc?: string
    subject?: string
    body?: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
  onSent?: () => void
}

export function ComposeDialog({
  open,
  onOpenChange,
  mode = "new",
  prefill,
  onSent,
}: ComposeDialogProps) {
  const [to, setTo] = useState(prefill?.to ?? "")
  const [cc, setCc] = useState(prefill?.cc ?? "")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState(prefill?.subject ?? "")
  const [body, setBody] = useState(prefill?.body ?? "")
  const [showCc, setShowCc] = useState(!!prefill?.cc)
  const [showBcc, setShowBcc] = useState(false)

  const { send, loading: sending, error: sendError } = useSendMessage()
  const { save: saveDraft, loading: savingDraft } = useSaveDraft()

  useEffect(() => {
    if (open) {
      setTo(prefill?.to ?? "")
      setCc(prefill?.cc ?? "")
      setBcc("")
      setSubject(prefill?.subject ?? "")
      setBody(prefill?.body ?? "")
      setShowCc(!!prefill?.cc)
      setShowBcc(false)
    }
  }, [open, prefill])

  const resetForm = useCallback(() => {
    setTo("")
    setCc("")
    setBcc("")
    setSubject("")
    setBody("")
    setShowCc(false)
    setShowBcc(false)
  }, [])

  const handleSend = async () => {
    if (!to.trim()) return
    try {
      await send({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        threadId: prefill?.threadId,
        inReplyTo: prefill?.inReplyTo,
        references: prefill?.references,
      })
      resetForm()
      onOpenChange(false)
      onSent?.()
    } catch {
      // error is set in the hook
    }
  }

  const handleSaveDraft = async () => {
    try {
      await saveDraft({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
      })
      onOpenChange(false)
    } catch {
      // error is set in the hook
    }
  }

  const handleDiscard = () => {
    resetForm()
    onOpenChange(false)
  }

  const title =
    mode === "reply" ? "Reply" : mode === "forward" ? "Forward" : "New Message"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-2 py-2">
            <label className="w-12 text-[12px] font-medium text-muted-foreground shrink-0">
              To
            </label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 border-0 border-b rounded-none shadow-none focus-visible:ring-0 px-0"
            />
            <div className="flex gap-1.5 text-[12px]">
              {!showCc && (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  onClick={() => setShowBcc(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

          {showCc && (
            <div className="flex items-center gap-2 py-2">
              <label className="w-12 text-[12px] font-medium text-muted-foreground shrink-0">
                Cc
              </label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 border-0 border-b rounded-none shadow-none focus-visible:ring-0 px-0"
              />
              <button
                onClick={() => {
                  setShowCc(false)
                  setCc("")
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="size-3.5" />
              </button>
            </div>
          )}

          {showBcc && (
            <div className="flex items-center gap-2 py-2">
              <label className="w-12 text-[12px] font-medium text-muted-foreground shrink-0">
                Bcc
              </label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1 border-0 border-b rounded-none shadow-none focus-visible:ring-0 px-0"
              />
              <button
                onClick={() => {
                  setShowBcc(false)
                  setBcc("")
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="size-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 py-2">
            <label className="w-12 text-[12px] font-medium text-muted-foreground shrink-0">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 border-0 border-b rounded-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>

          <Separator className="my-1" />

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="min-h-[220px] resize-y border-0 shadow-none focus-visible:ring-0 text-[14px] leading-[1.6] px-0"
          />
        </div>

        {sendError && (
          <p className="text-[13px] text-destructive">{sendError}</p>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex gap-2 pt-3">
            <Button onClick={handleSend} disabled={!to.trim() || sending} className="gap-1.5 shadow-sm">
              <Send className="size-4" />
              {sending ? "Sending..." : "Send"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft}
            >
              {savingDraft ? "Saving..." : "Save Draft"}
            </Button>
          </div>
          <Button variant="ghost" onClick={handleDiscard} className="text-muted-foreground hover:text-destructive pt-3">
            <X className="size-4 mr-1" />
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
