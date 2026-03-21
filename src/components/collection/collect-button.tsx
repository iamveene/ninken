"use client"

import { PackagePlus, Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useCollectAction, type CollectParams } from "@/hooks/use-collect-action"
import { cn } from "@/lib/utils"

type CollectButtonProps = {
  params: CollectParams
  variant?: "icon" | "icon-xs" | "button"
  className?: string
}

export function CollectButton({ params, variant = "icon", className }: CollectButtonProps) {
  const { collect } = useCollectAction()
  const [collected, setCollected] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCollect = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (collected || loading) return

    setLoading(true)
    try {
      const result = await collect(params)
      if (result) {
        setCollected(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (variant === "button") {
    return (
      <Button
        variant={collected ? "secondary" : "outline"}
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={handleCollect}
        disabled={loading || collected}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : collected ? (
          <Check className="size-3.5" />
        ) : (
          <PackagePlus className="size-3.5" />
        )}
        {collected ? "Collected" : "Collect"}
      </Button>
    )
  }

  const size = variant === "icon-xs" ? "icon-xs" : "icon-sm"

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        collected
          ? "text-green-600 dark:text-green-400"
          : "hover:bg-accent",
        className
      )}
      onClick={handleCollect}
      disabled={loading || collected}
      aria-label={collected ? "Already collected" : `Collect ${params.title}`}
      title={collected ? "Already collected" : "Add to collection"}
    >
      {loading ? (
        <Loader2 className="size-[18px] animate-spin" />
      ) : collected ? (
        <Check className="size-[18px]" />
      ) : (
        <PackagePlus className="size-[18px]" />
      )}
    </Button>
  )
}
