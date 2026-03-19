import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { ProfileSelector } from "@/components/layout/profile-selector";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { ServiceIndicator } from "@/components/layout/service-indicator";
import { AlertBadge } from "@/components/layout/alert-badge";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProviderContextProvider } from "@/components/providers/provider-context";

export default function MicrosoftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProviderContextProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-x-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <ModeToggle />
            <div className="ml-auto flex items-center gap-3">
              <ServiceIndicator />
              <AlertBadge />
              <ProfileSelector />
            </div>
          </header>
          <OfflineBanner />
          <div className="flex-1 p-4 min-w-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProviderContextProvider>
  );
}
