/**
 * Branded loading screen — Ninken badge + animated dots.
 * Used by loading.tsx files (Suspense fallback) and the route transition overlay.
 * Uses plain <img> instead of next/image for instant rendering from browser cache.
 */
export function BrandedLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ninken-badge.png"
          alt="Ninken"
          width={64}
          height={64}
          className="animate-pulse"
        />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-muted-foreground tracking-wide">
          NINKEN
        </p>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
