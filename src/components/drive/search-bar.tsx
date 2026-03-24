"use client"

import { useState, useEffect, useRef } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type DriveSearchBarProps = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

const HISTORY_KEY = "drive-search-history"
const MAX_HISTORY = 5

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
  } catch {
    return []
  }
}

function saveSearchHistory(term: string) {
  const history = getSearchHistory().filter((h) => h !== term)
  history.unshift(term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

export function DriveSearchBar({ value, onChange, onClear }: DriveSearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (newValue: string) => {
    setLocalValue(newValue)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange(newValue)
      if (newValue.trim()) saveSearchHistory(newValue.trim())
    }, 300)
  }

  const handleClear = () => {
    setLocalValue("")
    onChange("")
    onClear()
  }

  return (
    <div className="relative flex-1 max-w-lg">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search in Drive..."
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-full pl-9 pr-8 bg-muted/50 border-muted-foreground/15 focus:bg-background transition-colors"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Clear search"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={handleClear}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
