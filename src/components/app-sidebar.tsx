"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Home, ChevronDown, LayoutDashboard } from "lucide-react"
import { cacheClear } from "@/lib/cache"
import { CacheIndicator } from "@/components/layout/cache-indicator"
import { TokenLifecycle } from "@/components/layout/token-lifecycle"
import { useScopes } from "@/hooks/use-scopes"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { studioNavItems } from "@/lib/studio/nav"
import { collectionNavItems } from "@/lib/collection/nav"
import { useSidebarSlot } from "@/components/sidebar-slot"
import "@/lib/providers"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { NinkenIcon } from "@/components/ninken-icon"

type Mode = "operate" | "audit" | "collection" | "studio"

function getMode(pathname: string): Mode {
  if (pathname.startsWith("/audit") || pathname.startsWith("/m365-audit")) return "audit"
  if (pathname.startsWith("/studio")) return "studio"
  if (pathname.startsWith("/collection")) return "collection"
  return "operate"
}

/**
 * Detect which service is active from the pathname.
 * Returns the service ID (e.g., "gmail", "drive") or null if on the dashboard.
 */
function getActiveServiceId(pathname: string, operateNavItems: { id: string; href: string }[]): string | null {
  for (const item of operateNavItems) {
    if (pathname.startsWith(item.href)) return item.id
  }
  return null
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasApp, loading } = useScopes()
  const { toggleSidebar } = useSidebar()
  const { provider } = useProvider()
  const mode = getMode(pathname)

  const { content: sidebarSlotContent } = useSidebarSlot()

  const providerConfig = getProvider(provider)
  const operateNavItems = providerConfig?.operateNavItems ?? []
  const auditNavItems = providerConfig?.auditNavItems ?? []
  const serviceSubNav = providerConfig?.serviceSubNav ?? {}

  const visibleItems = loading
    ? []
    : operateNavItems.filter((item) => hasApp(item.id))

  const activeServiceId = mode === "operate" ? getActiveServiceId(pathname, operateNavItems) : null
  const activeService = activeServiceId ? operateNavItems.find((i) => i.id === activeServiceId) : null
  const activeSubNav = activeServiceId ? serviceSubNav[activeServiceId] : null

  const handleSignOut = async () => {
    await cacheClear()
    const { removeProfile, getActiveProfileId } = await import("@/lib/token-store")
    const activeId = getActiveProfileId()
    if (activeId) await removeProfile(activeId)
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/?add=true")
  }

  // Determine what to show in sidebar based on mode
  const isOperateWithService = mode === "operate" && activeService && activeSubNav
  const isLoading = (mode === "operate" || mode === "audit") && loading

  // For non-operate modes or operate without active service (dashboard)
  const dashboardRoute = providerConfig?.defaultRoute ?? "/dashboard"
  const dashboardItem = { id: "dashboard", title: "Dashboard", href: dashboardRoute, iconName: "LayoutDashboard" }
  let navItems = [dashboardItem, ...visibleItems]
  let groupLabel = "Apps"

  if (mode === "audit") {
    navItems = auditNavItems
    groupLabel = "Audit"
  } else if (mode === "studio") {
    navItems = studioNavItems
    groupLabel = "Studio"
  } else if (mode === "collection") {
    navItems = collectionNavItems
    groupLabel = "Collection"
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0">
        {/* Expanded: full logo image */}
        <button
          className="group-data-[collapsible=icon]:hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Image
            src="/ninken-logo.png"
            alt="Ninken 忍犬"
            width={256}
            height={85}
            className="w-full h-auto"
            style={{
              maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
            }}
            priority
          />
        </button>
        {/* Collapsed: SVG badge */}
        <button
          className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <NinkenIcon className="h-5 w-5" />
        </button>
      </SidebarHeader>

      <SidebarContent>
        {isOperateWithService ? (
          /* ─── Service Overlay Mode ─── */
          <SidebarGroup>
            {/* Service Switcher Dropdown */}
            <div className="px-2 pb-2 group-data-[collapsible=icon]:px-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="outline-none w-full"
                  render={
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                    />
                  }
                >
                  {(() => {
                    const ServiceIcon = resolveIcon(activeService.iconName)
                    return (
                      <>
                        <ServiceIcon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">{activeService.title}</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                      </>
                    )
                  })()}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={4} className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Switch Service</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => {
                        const dashRoute = provider === "google" ? "/dashboard" : "/m365-dashboard"
                        router.push(dashRoute)
                      }}
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {visibleItems.map((item) => {
                      const ItemIcon = resolveIcon(item.iconName)
                      const isCurrent = item.id === activeServiceId
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          className="gap-2"
                          onClick={() => {
                            if (!isCurrent) router.push(item.href)
                          }}
                        >
                          <ItemIcon className={`h-3.5 w-3.5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs ${isCurrent ? "text-primary font-medium" : ""}`}>{item.title}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Service Sub-Navigation or custom slot content */}
            {sidebarSlotContent ? (
              <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
                {sidebarSlotContent}
              </SidebarGroupContent>
            ) : activeSubNav ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {activeSubNav.map((item) => {
                    const Icon = resolveIcon(item.iconName)
                    const isActive = pathname === item.href || (item.href.includes("?") && pathname === item.href.split("?")[0])
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isActive}
                          render={<Link href={item.href} />}
                          tooltip={item.title}
                        >
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
        ) : (
          /* ─── Standard Mode (Dashboard / Audit / Studio / Collection) ─── */
          <SidebarGroup>
            <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuButton>
                        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  navItems.map((item) => {
                    const Icon = resolveIcon(item.iconName)
                    const isActive =
                      item.href === "/audit" || item.href === "/m365-audit" || item.href === "/studio" || item.href === "/collection"
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isActive}
                          render={<Link href={item.href} />}
                          tooltip={item.title}
                        >
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <TokenLifecycle />
        <div className="group-data-[collapsible=icon]:hidden">
          <CacheIndicator />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={handleSignOut}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
