"use client"

import { CheckCircle, Loader2 } from "lucide-react"

type ProgressIndicatorProps = {
  percent: number
  message: string
}

export function ProgressIndicator({ percent, message }: ProgressIndicatorProps) {
  const done = percent >= 100

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-xs">
        {done ? (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
        )}
        <span className={done ? "text-emerald-400" : "text-neutral-400"}>
          {message}
        </span>
        <span className="ml-auto font-mono text-neutral-500">{percent}%</span>
      </div>
    </div>
  )
}
