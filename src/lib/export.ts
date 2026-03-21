"use client"

/**
 * Flatten a nested object into a single-level object for CSV export.
 * Keys are joined with dots: { a: { b: 1 } } → { "a.b": 1 }
 */
export function flattenForCsv(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenForCsv(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      result[fullKey] = value.join("; ")
    } else {
      result[fullKey] = value == null ? "" : String(value)
    }
  }
  return result
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/**
 * Convert an array of objects to CSV string.
 */
export function toCsv(
  data: Record<string, unknown>[],
  columns?: string[]
): string {
  if (data.length === 0) return ""

  const flattened = data.map((row) => flattenForCsv(row))
  const headers = columns ?? [...new Set(flattened.flatMap((r) => Object.keys(r)))]

  const headerLine = headers.map(escapeCsvField).join(",")
  const rows = flattened.map((row) =>
    headers.map((h) => escapeCsvField(row[h] ?? "")).join(",")
  )

  return [headerLine, ...rows].join("\n")
}

/**
 * Trigger a file download in the browser.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export data as a JSON file download.
 */
export function exportAsJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  downloadBlob(blob, filename.endsWith(".json") ? filename : `${filename}.json`)
}

/**
 * Export data as a CSV file download.
 */
export function exportAsCsv(
  data: Record<string, unknown>[],
  filename: string,
  columns?: string[]
) {
  const csv = toCsv(data, columns)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`)
}
