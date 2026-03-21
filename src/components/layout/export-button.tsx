"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportAsJson, exportAsCsv } from "@/lib/export"

type ExportButtonProps = {
  data: Record<string, unknown>[]
  filename: string
  columns?: string[]
  disabled?: boolean
}

export function ExportButton({ data, filename, columns, disabled }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled || data.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportAsJson(data, filename)}>
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsCsv(data, filename, columns)}>
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
