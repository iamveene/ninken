"use client"

import { useState, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Search, X, ClipboardPaste } from "lucide-react"

interface TokenInputProps {
  onAnalyze: (token: string) => void
  loading?: boolean
  placeholder?: string
}

export function TokenInput({ onAnalyze, loading = false, placeholder }: TokenInputProps) {
  const [value, setValue] = useState("")

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setValue(text.trim())
      }
    } catch {
      // Clipboard access denied -- user needs to paste manually
    }
  }, [])

  const handleAnalyze = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      onAnalyze(trimmed)
    }
  }, [value, onAnalyze])

  const handleClear = useCallback(() => {
    setValue("")
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleAnalyze()
      }
    },
    [handleAnalyze]
  )

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Paste a token (JWT, OAuth2 access token, refresh token, API key, or JSON credentials)..."}
          className="min-h-24 font-mono text-xs bg-black/20 border-border/50 resize-y pr-20"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {value && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handlePaste}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={!value.trim() || loading}
          className="bg-primary/90 hover:bg-primary"
        >
          <Search className="h-3.5 w-3.5 mr-1.5" />
          {loading ? "Analyzing..." : "Analyze Token"}
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono">
          Ctrl+Enter to analyze
        </span>
      </div>
    </div>
  )
}
