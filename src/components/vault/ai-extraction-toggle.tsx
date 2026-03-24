"use client"

import { useState, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AIExtractionToggleProps = {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function AIExtractionToggle({ enabled, onToggle }: AIExtractionToggleProps) {
  const [hasLLM, setHasLLM] = useState<boolean | null>(null)

  useEffect(() => {
    // Quick check if LLM is configured by hitting the settings endpoint
    fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((res) => {
        // If we get a non-503 response, assume LLM is configured
        // The test endpoint will always return something if config exists
        setHasLLM(res.status !== 503)
      })
      .catch(() => setHasLLM(false))
  }, [])

  // Still loading
  if (hasLLM === null) return null

  if (!hasLLM) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5 rounded-full border border-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground opacity-50 cursor-not-allowed">
              <Sparkles className="h-3 w-3" />
              AI Extract
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Configure an LLM in Settings to enable AI extraction</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
      enabled
        ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
        : "border-muted text-muted-foreground"
    }`}>
      <Sparkles className="h-3 w-3" />
      <span>AI Extract</span>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="h-3.5 w-7 data-[state=checked]:bg-violet-500"
      />
    </div>
  )
}
