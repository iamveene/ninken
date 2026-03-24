"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { usePathname, useRouter as useNextRouter } from "next/navigation"

type RouteLoaderContextValue = {
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
}

const RouteLoaderContext = createContext<RouteLoaderContextValue>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
})

export function useRouteLoader() {
  return useContext(RouteLoaderContext)
}

/**
 * Custom useRouter that shows the branded loader during navigation.
 */
export function useRouter() {
  const router = useNextRouter()
  const { startLoading } = useRouteLoader()

  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => {
      startLoading()
      router.push(href, options)
    },
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
      startLoading()
      router.replace(href, options)
    },
  }
}

/**
 * Full-screen branded loading overlay — matches the graph/loading.tsx style.
 * Uses a plain <img> (not next/image) so the badge loads instantly from browser cache.
 */
function LoaderOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-in fade-in duration-100">
      <div className="flex flex-col items-center gap-6">
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
    </div>
  )
}

export function RouteLoaderProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const prevPathRef = useRef(pathname)

  // When pathname actually changes, wait a tick for the new page to mount before hiding loader
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname
      // Small delay so the new page renders before we remove the overlay
      const raf = requestAnimationFrame(() => {
        setIsLoading(false)
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [pathname])

  // Safety timeout — never show loader for more than 8 seconds
  useEffect(() => {
    if (!isLoading) return
    const timeout = setTimeout(() => setIsLoading(false), 8000)
    return () => clearTimeout(timeout)
  }, [isLoading])

  // Intercept all internal link clicks to show loader
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("http") || href.startsWith("#")) return
      // Don't show loader if navigating to current page
      if (href === pathname || href === pathname + "/") return
      // Internal navigation — show loader
      setIsLoading(true)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [pathname])

  const startLoading = useCallback(() => {
    setIsLoading(true)
  }, [])

  const stopLoading = useCallback(() => {
    setIsLoading(false)
  }, [])

  return (
    <RouteLoaderContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
      {isLoading && <LoaderOverlay />}
    </RouteLoaderContext.Provider>
  )
}
