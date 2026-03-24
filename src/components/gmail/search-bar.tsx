"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

const QUICK_FILTERS = [
  { label: "Unread", query: "is:unread" },
  { label: "Attachments", query: "has:attachment" },
  { label: "Starred", query: "is:starred" },
  { label: "Sent", query: "in:sent" },
]

type SearchBarProps = {
  onSearch: (query: string) => void
  resultCount?: number
  currentQuery?: string
}

export function SearchBar({ onSearch, resultCount, currentQuery }: SearchBarProps) {
  const [value, setValue] = useState(currentQuery ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(currentQuery ?? "")
  }, [currentQuery])

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(newValue.trim())
      }, 300)
    },
    [onSearch]
  )

  const handleClear = () => {
    setValue("")
    onSearch("")
  }

  const handleChip = (query: string) => {
    // If the filter is already present, remove it (toggle off)
    const regex = new RegExp(`(^|\\s)${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'g')
    if (regex.test(value)) {
      const newValue = value.replace(regex, ' ').replace(/\s+/g, ' ').trim()
      setValue(newValue)
      onSearch(newValue)
      return
    }
    const newValue = value ? `${value} ${query}` : query
    setValue(newValue)
    onSearch(newValue.trim())
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search mail..."
          className="pl-8 pr-8 bg-muted/40 border-border/50 focus:bg-background transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              onSearch(value.trim())
            }
          }}
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.query}
            onClick={() => handleChip(filter.query)}
            className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
          >
            {filter.label}
          </button>
        ))}
        {resultCount !== undefined && currentQuery && (
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}
