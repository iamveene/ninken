"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Copy, RefreshCw, Trash2, Eye, EyeOff, User, Link, Server } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { canReinject } from "@/lib/vault/reinject"
import type { VaultItem } from "@/lib/vault/types"

const TYPE_COLORS: Record<string, string> = {
  aws: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  gcp: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  github: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  microsoft: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  slack: "text-green-400 bg-green-500/10 border-green-500/20",
  gitlab: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  generic: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  pii: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  url: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  infrastructure: "text-teal-400 bg-teal-500/10 border-teal-500/20",
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-red-400 bg-red-500/10 border-red-500/20",
}

function getConfidenceLabel(c: number): string {
  if (c >= 0.8) return "high"
  if (c >= 0.5) return "medium"
  return "low"
}

type VaultTableProps = {
  items: VaultItem[]
  onDelete: (id: string) => void
  onReinject: (item: VaultItem) => void
}

function MaskedContent({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleReveal = useCallback(() => {
    if (revealed) {
      setRevealed(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    setRevealed(true)
    timerRef.current = setTimeout(() => setRevealed(false), 5000)
  }, [revealed])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex items-center gap-1.5 max-w-[200px]">
      <code className="text-[11px] font-mono truncate">
        {revealed ? content : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
      </code>
      <button
        onClick={toggleReveal}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title={revealed ? "Hide" : "Reveal for 5s"}
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  )
}

export function VaultTable({ items, onDelete, onReinject }: VaultTableProps) {
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Copied to clipboard", { description: "Auto-clears in 30s" })
      // Auto-clear clipboard after 30s
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText()
          if (current === content) {
            await navigator.clipboard.writeText("")
          }
        } catch {
          // Permission denied for read — can't clear
        }
      }, 30_000)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }, [])

  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[200px]">Content</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-[90px]">Confidence</TableHead>
            <TableHead className="w-[120px]">Discovered</TableHead>
            <TableHead className="w-[130px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const typeColor = TYPE_COLORS[item.type] || TYPE_COLORS.generic
            const confLabel = getConfidenceLabel(item.confidence)
            const confColor = CONFIDENCE_COLORS[confLabel]
            const reinjectable = canReinject(item)

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge className={`text-[10px] w-fit ${typeColor}`}>
                      <span className="flex items-center gap-1">
                        {item.type === "pii" && <User className="h-2.5 w-2.5" />}
                        {item.type === "url" && <Link className="h-2.5 w-2.5" />}
                        {item.type === "infrastructure" && <Server className="h-2.5 w-2.5" />}
                        {item.type}
                      </span>
                    </Badge>
                    {item.subType && (
                      <span className="text-[9px] text-muted-foreground">{item.subType}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <MaskedContent content={item.content} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-medium truncate">{item.source.provider}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.source.service} / {item.source.reference}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${confColor}`}>
                    {(item.confidence * 100).toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.discoveredAt).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleCopy(item.content)}
                      title="Copy (auto-clears 30s)"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {reinjectable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onReinject(item)}
                        title="Reinject as credential"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(item.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
