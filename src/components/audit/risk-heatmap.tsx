import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RiskScoreBadge } from "@/components/audit/risk-score-badge"
import type { RiskCategory, RiskSeverity } from "@/lib/audit/risk-scoring"

const BORDER_COLORS: Record<RiskSeverity, string> = {
  critical: "border-l-red-500",
  high: "border-l-amber-500",
  medium: "border-l-yellow-500",
  low: "border-l-emerald-500",
}

function CategoryCard({ category }: { category: RiskCategory }) {
  return (
    <Card className={`border-l-4 ${BORDER_COLORS[category.severity]}`}>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>{category.label}</span>
          <RiskScoreBadge severity={category.severity} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground">
          {category.metric}
        </p>
        {category.details.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {category.details.slice(0, 2).map((detail, i) => (
              <li
                key={i}
                className="text-xs text-muted-foreground truncate"
                title={detail}
              >
                {detail}
              </li>
            ))}
          </ul>
        )}
        {category.unavailable && (
          <p className="mt-1 text-xs text-muted-foreground/60 italic">
            Data unavailable
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function RiskHeatmap({ categories }: { categories: RiskCategory[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  )
}
