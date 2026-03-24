"use client"

import { useState, useCallback } from "react"
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { addVaultItem } from "@/lib/vault-store"
import type { VaultItem, ExtractionResult } from "@/lib/vault/types"

type ExtractButtonProps = {
  rawText: string
  patternName: string
  category: string
  providerContext: { provider: string; service: string }
  reference: string
}

export function ExtractButton({
  rawText,
  patternName,
  category,
  providerContext,
  reference,
}: ExtractButtonProps) {
  const [status, setStatus] = useState<"idle" | "extracting" | "done" | "error">("idle")

  const handleExtract = useCallback(async () => {
    setStatus("extracting")
    try {
      const res = await fetch("/api/vault/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          patternName,
          category,
          context: {
            provider: providerContext.provider,
            service: providerContext.service,
            reference,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Extraction failed" }))
        toast.error("Extraction failed", { description: err.error })
        setStatus("error")
        return
      }

      const result: ExtractionResult = await res.json()

      if (!result.extracted || !result.value) {
        toast.info("No item extracted", { description: result.reason ?? "LLM could not extract a value" })
        setStatus("error")
        return
      }

      // Store in vault
      const vaultItem: VaultItem = {
        id: crypto.randomUUID(),
        content: result.value,
        type: result.type ?? "generic",
        subType: result.subType,
        source: {
          provider: providerContext.provider,
          service: providerContext.service,
          reference,
        },
        discoveredAt: new Date().toISOString(),
        pattern: patternName,
        confidence: result.confidence ?? 0.5,
        metadata: { category, rawTextLength: rawText.length },
        reinjected: false,
      }

      const { added, duplicate } = await addVaultItem(vaultItem)
      if (duplicate) {
        toast.info("Duplicate item", { description: "This item already exists in the Vault" })
      } else if (added) {
        toast.success("Item extracted to Vault", {
          description: `${result.type ?? "generic"} item saved`,
        })
      }
      setStatus("done")
    } catch (err) {
      toast.error("Extraction failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      setStatus("error")
    }
  }, [rawText, patternName, category, providerContext, reference])

  if (status === "extracting") {
    return (
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    )
  }

  if (status === "done") {
    return (
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-400" disabled>
        <CheckCircle2 className="h-3 w-3" />
      </Button>
    )
  }

  if (status === "error") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-red-400"
        onClick={handleExtract}
        title="Retry extraction"
      >
        <AlertCircle className="h-3 w-3" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleExtract}
      title="Extract to Vault"
    >
      <KeyRound className="h-3 w-3" />
    </Button>
  )
}
