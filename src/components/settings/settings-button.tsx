"use client"

import Link from "next/link"
import { Settings } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

export function SettingsButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        render={<Link href="/settings" />}
      >
        <Settings className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
  )
}
