import { Card, CardContent } from "@/components/ui/card"

/**
 * Skeleton placeholder for dashboard pages while the provider context hydrates.
 * Prevents "Unknown user" / 0 scopes flash on direct URL navigation (BUG-4).
 */
export function DashboardSkeleton({ statCards = 4 }: { statCards?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-3 ${statCards <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        {Array.from({ length: statCards }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
