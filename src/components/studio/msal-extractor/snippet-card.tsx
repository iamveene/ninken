"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

interface SnippetCardProps {
  title: string
  description?: string
  code: string
}

export function SnippetCard({ title, description, code }: SnippetCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Button
            variant="outline"
            size="xs"
            onClick={handleCopy}
            className="gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative rounded-md bg-black/40 border border-border/30 overflow-x-auto">
          <pre className="p-3 text-[11px] leading-relaxed font-mono text-zinc-300 whitespace-pre">
            {code}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
