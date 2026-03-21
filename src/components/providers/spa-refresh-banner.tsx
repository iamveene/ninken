"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type ReextractionEvent = {
  profileId: string
  clientId: string
  origin?: string
  clientName?: string
}

/**
 * Listens for "spa-reextraction-needed" events from useSpaRefresher and shows
 * a toast directing the user to re-extract tokens from the original SPA origin.
 * Does NOT use iframes (Microsoft blocks framing via X-Frame-Options: DENY).
 */
export function SpaRefreshBanner() {
  const shownRef = useRef(new Set<string>())

  useEffect(() => {
    function handleEvent(e: Event) {
      const detail = (e as CustomEvent<ReextractionEvent>).detail
      if (!detail?.profileId) return
      if (shownRef.current.has(detail.profileId)) return
      shownRef.current.add(detail.profileId)

      const appName = detail.clientName || "Microsoft SPA"
      const origin = detail.origin || "the original SPA page"

      toast.warning(`${appName} token expired`, {
        description: `Re-extract from ${origin} to continue. The token can only be refreshed from its original browser origin.`,
        duration: 30000,
        action: {
          label: "Open MSAL Extractor",
          onClick: () => {
            window.location.href = "/studio/msal-extractor"
          },
        },
      })
    }

    window.addEventListener("spa-reextraction-needed", handleEvent)
    return () => {
      window.removeEventListener("spa-reextraction-needed", handleEvent)
    }
  }, [])

  return null
}
