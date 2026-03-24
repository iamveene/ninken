"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  Folder,
  Film,
  File,
  Users,
  Star,
} from "lucide-react"

const TYPE_FILTERS = [
  { label: "All", value: "", icon: File },
  { label: "Documents", value: "document", icon: FileText },
  { label: "Spreadsheets", value: "spreadsheet", icon: FileSpreadsheet },
  { label: "Presentations", value: "presentation", icon: Presentation },
  { label: "PDFs", value: "pdf", icon: FileText },
  { label: "Images", value: "image", icon: FileImage },
  { label: "Videos", value: "video", icon: Film },
  { label: "Folders", value: "folder", icon: Folder },
] as const

type SearchFiltersProps = {
  activeType: string
  onTypeChange: (type: string) => void
  sharedWithMe: boolean
  onSharedToggle: () => void
  starred: boolean
  onStarredToggle: () => void
}

export function SearchFilters({
  activeType,
  onTypeChange,
  sharedWithMe,
  onSharedToggle,
  starred,
  onStarredToggle,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TYPE_FILTERS.map((filter) => {
        const Icon = filter.icon
        const isActive = activeType === filter.value
        return (
          <Button
            key={filter.label}
            variant={isActive ? "default" : "outline"}
            size="xs"
            onClick={() => onTypeChange(filter.value)}
            className={cn("gap-1 rounded-full", !isActive && "text-muted-foreground")}
          >
            <Icon className="h-3 w-3" />
            {filter.label}
          </Button>
        )
      })}

      <div className="mx-1 h-4 w-px bg-border" />

      <Button
        variant={sharedWithMe ? "default" : "outline"}
        size="xs"
        onClick={onSharedToggle}
        className={cn("gap-1", !sharedWithMe && "text-muted-foreground")}
      >
        <Users className="h-3 w-3" />
        Shared with me
      </Button>

      <Button
        variant={starred ? "default" : "outline"}
        size="xs"
        onClick={onStarredToggle}
        className={cn("gap-1", !starred && "text-muted-foreground")}
      >
        <Star className="h-3 w-3" />
        Starred
      </Button>
    </div>
  )
}
