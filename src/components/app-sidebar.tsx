"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "@/components/layout/route-loader"
import { LogOut, Home, ChevronDown, LayoutDashboard, KeyRound } from "lucide-react"
import { cacheClear, emitGlobalRefresh } from "@/lib/cache"
import { CacheIndicator } from "@/components/layout/cache-indicator"
import { TokenLifecycle } from "@/components/layout/token-lifecycle"
import { useScopes } from "@/hooks/use-scopes"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
import { studioNavItems } from "@/lib/studio/nav"
import { collectionNavItems } from "@/lib/collection/nav"
import type { NavGroup } from "@/lib/providers/types"
import { useSidebarSlot } from "@/components/sidebar-slot"
import type { ProviderId } from "@/lib/providers/types"
import { getProviderFromPathname } from "@/lib/providers/routes"
import { getMode } from "@/lib/mode"
import type { Mode } from "@/lib/mode"
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

/**
 * Detect which provider owns the current route group based on URL pathname.
 * Returns null for provider-agnostic routes (studio, collection, alerts)
 * where the active profile's provider should be used instead.
 */
// getProviderFromPathname imported from @/lib/providers/routes


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
  const { scopes, loading } = useScopes()
  const { toggleSidebar } = useSidebar()
  const { provider: activeProvider } = useProvider()
  const mode = getMode(pathname)

  const { content: sidebarSlotContent } = useSidebarSlot()

  // Use the route group's provider for nav items, falling back to active profile
  const routeProvider = getProviderFromPathname(pathname)
  const provider = routeProvider ?? activeProvider
  const providerConfig = getProvider(provider)
  const operateNavItems = providerConfig?.operateNavItems ?? []
  const exploreNavGroups: NavGroup[] = providerConfig?.exploreNavGroups ?? []
  const serviceSubNav = providerConfig?.serviceSubNav ?? {}
  const scopeAppMap = providerConfig?.scopeAppMap ?? {}

  // Compute hasApp using the ROUTE provider's scopeAppMap (not the active provider's)
  const hasApp = (appId: string): boolean => {
    if (!scopes) return false
    const required = scopeAppMap[appId]
    if (!required) return false
    return required.some((s) => scopes.includes(s))
  }

  const visibleItems = loading
    ? []
    : operateNavItems.filter((item) => hasApp(item.id))

  const activeServiceId = mode === "operate" ? getActiveServiceId(pathname, operateNavItems) : null
  const activeService = activeServiceId ? operateNavItems.find((i) => i.id === activeServiceId) : null
  const activeSubNav = activeServiceId ? serviceSubNav[activeServiceId] : null

  const handleSignOut = async () => {
    await cacheClear()
    const { getAllProfiles, removeProfile } = await import("@/lib/token-store")
    const all = await getAllProfiles()
    for (const p of all) await removeProfile(p.id)
    await fetch("/api/auth", { method: "DELETE" })
    window.location.href = "/?add=true"
  }

  // Determine what to show in sidebar based on mode
  const isOperateWithService = mode === "operate" && activeService && activeSubNav
  const isExploreGrouped = mode === "explore" && exploreNavGroups.length > 0
  const isLoading = (mode === "operate" || mode === "explore") && loading

  // For non-operate modes or operate without active service (dashboard)
  const dashboardRoute = providerConfig?.defaultRoute ?? "/dashboard"
  const dashboardItem = { id: "dashboard", title: "Dashboard", href: dashboardRoute, iconName: "LayoutDashboard" }
  let navItems = [dashboardItem, ...visibleItems]
  let groupLabel = "Apps"

  if (mode === "explore" && !isExploreGrouped) {
    // Fallback for providers with no exploreNavGroups (empty array)
    navItems = []
    groupLabel = "Explore"
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
          <div className="flex items-center gap-1.5 -mt-2 px-1 group-data-[collapsible=icon]:hidden">
            <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary">Beta</span>
            <span className="text-[9px] text-muted-foreground font-mono">v0.5.0</span>
          </div>
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
                      onClick={() => router.push(dashboardRoute)}
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
        ) : isExploreGrouped ? (
          /* ─── Explore Mode (grouped sections: Audit, Intelligence) ─── */
          <>
            {isLoading ? (
              <SidebarGroup>
                <SidebarGroupLabel>Explore</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuButton>
                          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              exploreNavGroups.map((group) => (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const Icon = resolveIcon(item.iconName)
                        const isActive =
                          item.href === "/audit" || item.href === "/m365-audit" || item.href === "/gitlab-audit" || item.href === "/github-audit" || item.href === "/aws-audit"
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
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))
            )}
          </>
        ) : (
          /* ─── Standard Mode (Dashboard / Studio / Collection) ─── */
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
                      item.href === "/studio" || item.href === "/collection"
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
            <SidebarMenuButton
              tooltip="Vault"
              render={<Link href="/vault" />}
            >
              <KeyRound />
              <span>Vault</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Home"
              render={<a href="/?add=true" />}
            >
              <Home />
              <span>Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
