"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { FileBrowser } from "@/components/drive/file-browser"

export default function DrivePage() {
  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-theme(spacing.12)-theme(spacing.8))] flex-col">
        <FileBrowser />
      </div>
    </TooltipProvider>
  )
}
