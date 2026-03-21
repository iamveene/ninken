"use client"

import { createContext, useContext, useState, useCallback, useEffect, useTransition, type ReactNode } from "react"
import { usePathname, useRouter as useNextRouter } from "next/navigation"
import Image from "next/image"

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

function LoaderOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <Image
            src="/ninken-badge.png"
            alt="Ninken"
            width={64}
            height={64}
            className="animate-pulse"
            priority
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
  const [, startTransition] = useTransition()

  // Stop loading when pathname changes (navigation completed)
  useEffect(() => {
    setIsLoading(false)
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
      if (!href || href.startsWith("http") || href.startsWith("#") || href === pathname) return
      // Internal navigation — show loader
      setIsLoading(true)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [pathname])

  const startLoading = useCallback(() => {
    startTransition(() => {
      setIsLoading(true)
    })
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
