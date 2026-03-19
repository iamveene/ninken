import { AppSidebar } from "@/components/app-sidebar";
import { ProfileSelector } from "@/components/layout/profile-selector";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <div className="ml-auto">
            <ProfileSelector />
          </div>
        </header>
        <OfflineBanner />
        <div className="flex-1 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
