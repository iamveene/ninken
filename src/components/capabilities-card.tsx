"use client"

import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveIcon } from "@/lib/icon-resolver"

export type ServiceProbe = {
  name: string
  iconName: string
  accessible: boolean
  detail?: string
}

type CapabilitiesCardProps = {
  services: ServiceProbe[]
  loading: boolean
  error?: string
  providerName: string
  onContinue: () => void
}

function ServiceTileSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <Skeleton className="h-5 w-5 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-2.5 w-28" />
      </div>
    </div>
  )
}

function ServiceTile({ probe }: { probe: ServiceProbe }) {
  const Icon = resolveIcon(probe.iconName)
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        probe.accessible
          ? "border-emerald-900/50 bg-emerald-950/10"
          : "border-neutral-800 bg-neutral-900/30"
      }`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${
          probe.accessible ? "text-emerald-500" : "text-neutral-600"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-200">{probe.name}</p>
        {probe.detail && (
          <p className="text-[10px] text-neutral-500 truncate">{probe.detail}</p>
        )}
      </div>
      {probe.accessible ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-500/60" />
      )}
    </div>
  )
}

export function CapabilitiesCard({
  services,
  loading,
  error,
  providerName,
  onContinue,
}: CapabilitiesCardProps) {
  const accessibleCount = services.filter((s) => s.accessible).length

  return (
    <Card className="w-full border-neutral-800 bg-neutral-900/60">
      <CardHeader>
        <CardTitle className="text-sm text-neutral-200">
          Credential Capabilities
        </CardTitle>
        <CardDescription className="text-xs text-neutral-500">
          {loading
            ? "Probing what this credential can access..."
            : error
              ? "Failed to probe capabilities"
              : `${accessibleCount} of ${services.length} services accessible`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="mb-3 text-xs text-red-400">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <ServiceTileSkeleton key={i} />
              ))
            : services.map((probe) => (
                <ServiceTile key={probe.name} probe={probe} />
              ))}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Skip
        </button>
        <Button
          size="sm"
          disabled={loading}
          onClick={onContinue}
          className="bg-red-700 text-white hover:bg-red-600 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Probing...
            </>
          ) : (
            `Continue to ${providerName}`
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
