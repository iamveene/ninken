"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/layout/mode-toggle"
import { ProfileSelector } from "@/components/layout/profile-selector"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { ServiceIndicator } from "@/components/layout/service-indicator"
import { AlertBadge } from "@/components/layout/alert-badge"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { ProviderContextProvider } from "@/components/providers/provider-context"
import { SidebarSlotProvider } from "@/components/sidebar-slot"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <SidebarSlotProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-x-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <ModeToggle />
            <div className="ml-auto flex items-center gap-3">
              <ServiceIndicator />
              <AlertBadge />
              <ProfileSelector />
            </div>
          </header>
          <OfflineBanner />
          <div className="flex-1 p-4 min-w-0 overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SidebarSlotProvider>
  )
}
