"use client"

import { FileJson, FileSpreadsheet, Shield } from "lucide-react"
import type { ExportFormat } from "@/lib/studio/offline-export"

type FormatOption = {
  value: ExportFormat
  label: string
  description: string
  icon: React.ReactNode
}

const formats: FormatOption[] = [
  {
    value: "json",
    label: "JSON Bundle",
    description: "ZIP archive with structured JSON files for each data source.",
    icon: <FileJson className="h-5 w-5 text-blue-400" />,
  },
  {
    value: "csv",
    label: "CSV Bundle",
    description: "ZIP archive with CSV files. Blob data exported as manifest only.",
    icon: <FileSpreadsheet className="h-5 w-5 text-emerald-400" />,
  },
  {
    value: "bloodhound",
    label: "BloodHound JSON",
    description: "Nodes (users, groups, computers) + edges for BloodHound ingestion.",
    icon: <Shield className="h-5 w-5 text-red-400" />,
  },
]

type FormatSelectorProps = {
  value: ExportFormat
  onChange: (format: ExportFormat) => void
}

export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <div className="space-y-2">
      {formats.map((f) => {
        const selected = value === f.value
        return (
          <button
            key={f.value}
            type="button"
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
              selected
                ? "border-red-500/50 bg-red-500/5"
                : "border-neutral-800 bg-neutral-900/30 hover:border-neutral-700"
            }`}
            onClick={() => onChange(f.value)}
          >
            <div className="mt-0.5">{f.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-200">{f.label}</span>
                {selected && (
                  <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] text-red-400">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">{f.description}</p>
            </div>
            {/* Radio indicator */}
            <div
              className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                selected ? "border-red-500 bg-red-500" : "border-neutral-600"
              }`}
            >
              {selected && <div className="mx-auto mt-[3px] h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
