"use client"

import { Database } from "lucide-react"
import { ExportWizard } from "@/components/studio/offline-db/export-wizard"

export default function OfflineDbPage() {
  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-red-500" />
          <h1 className="text-xl font-bold text-neutral-100">Offline Database</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          Export collected data as JSON, CSV, or BloodHound-compatible snapshots for offline analysis.
        </p>
      </div>

      {/* Export Wizard */}
      <ExportWizard />
    </div>
  )
}
