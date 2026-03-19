"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { cacheClear } from "@/lib/cache"
import { CacheIndicator } from "@/components/layout/cache-indicator"
import { TokenLifecycle } from "@/components/layout/token-lifecycle"
import { useScopes } from "@/hooks/use-scopes"
import { useProvider } from "@/components/providers/provider-context"
import { getProvider } from "@/lib/providers/registry"
import { resolveIcon } from "@/lib/icon-resolver"
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
import Image from "next/image"
import { NinkenIcon } from "@/components/ninken-icon"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasApp, loading } = useScopes()
  const { toggleSidebar } = useSidebar()
  const { provider } = useProvider()
  const isAuditMode = pathname.startsWith("/audit")

  const providerConfig = getProvider(provider)
  const operateNavItems = providerConfig?.operateNavItems ?? []
  const auditNavItems = providerConfig?.auditNavItems ?? []

  const visibleItems = loading
    ? []
    : operateNavItems.filter((item) => hasApp(item.id))

  const handleSignOut = async () => {
    await cacheClear()
    const { clearAllProfiles } = await import("@/lib/token-store")
    await clearAllProfiles()
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/")
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
        <SidebarGroup>
          <SidebarGroupLabel>{isAuditMode ? "Audit" : "Apps"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAuditMode ? (
                loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuButton>
                        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  auditNavItems.map((item) => {
                    const Icon = resolveIcon(item.iconName)
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={
                            item.href === "/audit"
                              ? pathname === "/audit"
                              : pathname.startsWith(item.href)
                          }
                          render={<Link href={item.href} />}
                          tooltip={item.title}
                        >
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                )
              ) : loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuButton>
                      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                visibleItems.map((item) => {
                  const Icon = resolveIcon(item.iconName)
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(item.href)}
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
