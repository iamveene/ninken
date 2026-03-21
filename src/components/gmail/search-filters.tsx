"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type SearchFiltersProps = {
  onApply: (query: string) => void
}

export function SearchFilters({ onApply }: SearchFiltersProps) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [hasWords, setHasWords] = useState("")
  const [dateAfter, setDateAfter] = useState("")
  const [dateBefore, setDateBefore] = useState("")
  const [hasAttachment, setHasAttachment] = useState(false)

  const buildQuery = () => {
    const parts: string[] = []
    if (from.trim()) parts.push(`from:${from.trim()}`)
    if (to.trim()) parts.push(`to:${to.trim()}`)
    if (subject.trim()) parts.push(`subject:${subject.trim()}`)
    if (hasWords.trim()) parts.push(hasWords.trim())
    if (dateAfter) parts.push(`after:${dateAfter}`)
    if (dateBefore) parts.push(`before:${dateBefore}`)
    if (hasAttachment) parts.push("has:attachment")
    return parts.join(" ")
  }

  const handleApply = () => {
    const query = buildQuery()
    if (query) onApply(query)
  }

  const handleReset = () => {
    setFrom("")
    setTo("")
    setSubject("")
    setHasWords("")
    setDateAfter("")
    setDateBefore("")
    setHasAttachment(false)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon-sm" title="Advanced search" />
        }
      >
        <SlidersHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium">Advanced Search</h4>

          <div className="grid grid-cols-[60px_1fr] items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="sender@..."
              className="h-7 text-xs"
            />

            <label className="text-xs text-muted-foreground">To</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@..."
              className="h-7 text-xs"
            />

            <label className="text-xs text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject..."
              className="h-7 text-xs"
            />

            <label className="text-xs text-muted-foreground">Words</label>
            <Input
              value={hasWords}
              onChange={(e) => setHasWords(e.target.value)}
              placeholder="Contains..."
              className="h-7 text-xs"
            />

            <label className="text-xs text-muted-foreground">After</label>
            <Input
              type="date"
              value={dateAfter}
              onChange={(e) => setDateAfter(e.target.value)}
              className="h-7 text-xs"
            />

            <label className="text-xs text-muted-foreground">Before</label>
            <Input
              type="date"
              value={dateBefore}
              onChange={(e) => setDateBefore(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">
              Has attachment
            </label>
            <Switch
              checked={hasAttachment}
              onCheckedChange={setHasAttachment}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
            <Button size="sm" onClick={handleApply}>
              Search
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
