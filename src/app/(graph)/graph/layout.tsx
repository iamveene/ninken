import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { GlobalRefreshButton } from "@/components/layout/global-refresh";
import { ProfileSelector } from "@/components/layout/profile-selector";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { ServiceIndicator } from "@/components/layout/service-indicator";
import { AlertBadge } from "@/components/layout/alert-badge";
import { AppSwitcher } from "@/components/layout/app-switcher";
import { AITrigger } from "@/components/ai/ai-trigger";
import { AIContextProvider } from "@/components/ai/ai-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProviderContextProvider } from "@/components/providers/provider-context";
import { SidebarSlotProvider } from "@/components/sidebar-slot";
import { Suspense } from "react";
import { BrandedLoader } from "@/components/layout/branded-loader";

export default function GraphLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProviderContextProvider>
      <AIContextProvider>
        <SidebarSlotProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="overflow-x-hidden">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <ModeToggle />
              <GlobalRefreshButton />
              <div className="ml-auto flex items-center gap-3">
                <AppSwitcher />
                <ServiceIndicator />
                <AlertBadge />
                <ProfileSelector />
              </div>
            </header>
            <OfflineBanner />
            <div className="flex-1 p-0 min-w-0 overflow-hidden">
              <Suspense fallback={<BrandedLoader />}>
                {children}
              </Suspense>
            </div>
            <AITrigger />
          </SidebarInset>
        </SidebarProvider>
        </SidebarSlotProvider>
      </AIContextProvider>
    </ProviderContextProvider>
  );
}
