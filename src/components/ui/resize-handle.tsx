"use client"

import { Separator } from "react-resizable-panels"
import { cn } from "@/lib/utils"

export function ResizeHandle({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "relative flex w-1.5 items-center justify-center",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2",
        "before:bg-border/60 hover:before:bg-primary/40 active:before:bg-primary",
        "before:transition-colors cursor-col-resize",
        "data-[resize-handle-active]:before:bg-primary",
        className
      )}
      {...props}
    />
  )
}
