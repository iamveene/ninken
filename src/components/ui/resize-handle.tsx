"use client"

import { Separator, Panel, Group } from "react-resizable-panels"
import { cn } from "@/lib/utils"

/**
 * Styled resize handle between panels.
 */
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

// Re-export raw Panel and Group — no wrappers needed.
// The library handles overflow internally.
// IMPORTANT: use pixel strings for sizes (e.g. "200px"), not plain numbers.
export { Panel as ResizablePanel, Group as PanelGroup }
