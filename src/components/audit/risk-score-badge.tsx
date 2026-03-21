import type { RiskSeverity } from "@/lib/audit/risk-scoring"

const SEVERITY_STYLES: Record<RiskSeverity, string> = {
  critical: "bg-red-500/15 border-red-500/30 text-red-400",
  high: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
  low: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
}

export function RiskScoreBadge({
  severity,
  score,
  className = "",
}: {
  severity: RiskSeverity
  score?: number
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${SEVERITY_STYLES[severity]} ${className}`}
    >
      {severity}
      {score != null && (
        <span className="font-mono text-[10px] opacity-70">
          ({score.toFixed(1)})
        </span>
      )}
    </span>
  )
}
