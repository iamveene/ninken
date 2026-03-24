"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

type UserSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function UserSearch({ value, onChange, placeholder = "Search people..." }: UserSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
