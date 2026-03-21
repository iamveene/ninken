"use client"

import { useState, useCallback } from "react"
import {
  Database,
  Download,
  Package,
  FileJson,
  Users,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FormatSelector } from "./format-selector"
import { ProgressIndicator } from "./progress-indicator"
import {
  runExport,
  type ExportDataSource,
  type ExportFormat,
  type ExportResult,
} from "@/lib/studio/offline-export"

// ---------------------------------------------------------------------------
// Data source checkboxes
// ---------------------------------------------------------------------------

type DataSourceDef = {
  key: ExportDataSource
  label: string
  description: string
  icon: React.ReactNode
}

const dataSources: DataSourceDef[] = [
  {
    key: "items",
    label: "Collection items",
    description: "All collected items metadata (emails, files, chat messages, audit findings, etc.)",
    icon: <Package className="h-4 w-4 text-amber-400" />,
  },
  {
    key: "blobs",
    label: "Collection blobs (files)",
    description: "Downloaded file contents attached to collection items.",
    icon: <FileJson className="h-4 w-4 text-blue-400" />,
  },
  {
    key: "profiles",
    label: "Profile metadata",
    description: "Provider profiles (email, label, provider type). No credentials are exported.",
    icon: <Users className="h-4 w-4 text-emerald-400" />,
  },
]

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3
const STEP_TITLES: Record<WizardStep, string> = {
  1: "Select data sources",
  2: "Choose format",
  3: "Export",
}

export function ExportWizard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [selectedSources, setSelectedSources] = useState<Set<ExportDataSource>>(
    new Set(["items"]),
  )
  const [format, setFormat] = useState<ExportFormat>("json")
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("")
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)

  const toggleSource = (key: ExportDataSource) => {
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const canProceed =
    step === 1 ? selectedSources.size > 0 : step === 2 ? true : false

  const handleExport = useCallback(async () => {
    setExporting(true)
    setProgress(0)
    setMessage("Starting export...")
    setResult(null)

    try {
      const exportResult = await runExport({
        sources: Array.from(selectedSources),
        format,
        onProgress: (pct, msg) => {
          setProgress(pct)
          setMessage(msg)
        },
      })
      setResult(exportResult)
      setProgress(100)
      setMessage("Export complete")
    } catch (err) {
      setMessage(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setExporting(false)
    }
  }, [selectedSources, format])

  const handleDownload = () => {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setStep(1)
    setProgress(0)
    setMessage("")
    setResult(null)
    setExporting(false)
  }

  return (
    <Card className="border-border/50">
      {/* Step indicator */}
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-red-500" />
          Offline Database Export
        </CardTitle>
        <div className="flex items-center gap-1 mt-2">
          {([1, 2, 3] as WizardStep[]).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  s === step
                    ? "bg-red-500 text-white"
                    : s < step
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-xs ${
                  s === step ? "text-neutral-200" : "text-neutral-500"
                }`}
              >
                {STEP_TITLES[s]}
              </span>
              {s < 3 && (
                <ChevronRight className="h-3 w-3 text-neutral-600 mx-1" />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Step 1: Data sources */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400 mb-3">
              Select which data sources to include in the export.
            </p>
            {dataSources.map((ds) => {
              const checked = selectedSources.has(ds.key)
              return (
                <button
                  key={ds.key}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    checked
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-neutral-800 bg-neutral-900/30 hover:border-neutral-700"
                  }`}
                  onClick={() => toggleSource(ds.key)}
                >
                  <div className="mt-0.5">{ds.icon}</div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-neutral-200">
                      {ds.label}
                    </span>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {ds.description}
                    </p>
                  </div>
                  {/* Checkbox indicator */}
                  <div
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-red-500 bg-red-500"
                        : "border-neutral-600"
                    }`}
                  >
                    {checked && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={4}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 2: Format selection */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400 mb-3">
              Choose the export format.
            </p>
            <FormatSelector value={format} onChange={setFormat} />
            {format === "bloodhound" && (
              <div className="mt-3 flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <Database className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-400/80">
                  BloodHound format maps collection items to nodes and edges.
                  Data source selection is ignored — all collection items are processed.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Export progress */}
        {step === 3 && (
          <div className="space-y-4">
            {!exporting && !result && (
              <div className="text-center py-6 space-y-3">
                <Download className="h-8 w-8 text-neutral-500 mx-auto" />
                <p className="text-sm text-neutral-400">
                  Ready to export{" "}
                  <span className="text-neutral-200 font-medium">
                    {format === "json"
                      ? "JSON Bundle"
                      : format === "csv"
                        ? "CSV Bundle"
                        : "BloodHound JSON"}
                  </span>{" "}
                  with {selectedSources.size} data source
                  {selectedSources.size !== 1 ? "s" : ""}.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExport}
                >
                  Start Export
                </Button>
              </div>
            )}

            {(exporting || result) && (
              <ProgressIndicator percent={progress} message={message} />
            )}

            {result && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <Download className="h-5 w-5 text-emerald-400" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-emerald-300">
                    {result.filename}
                  </span>
                  <p className="text-xs text-neutral-500">
                    {(result.blob.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
          {step > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (step === 3 && result) {
                  reset()
                } else {
                  setStep((step - 1) as WizardStep)
                }
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {step === 3 && result ? "Start Over" : "Back"}
            </Button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <Button
              variant="default"
              size="sm"
              disabled={!canProceed}
              onClick={() => setStep((step + 1) as WizardStep)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
