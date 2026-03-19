"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Mail, HardDrive, Database, Users, Calendar, LogOut } from "lucide-react"
import { cacheClear } from "@/lib/cache"
import { CacheIndicator } from "@/components/layout/cache-indicator"
import { useScopes, type AppId } from "@/hooks/use-scopes"

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
import { NinkenLogoCompact } from "@/components/logo"

const navItems: { title: string; href: string; icon: typeof Mail; appId: AppId }[] = [
  { title: "Gmail", href: "/gmail", icon: Mail, appId: "gmail" },
  { title: "Drive", href: "/drive", icon: HardDrive, appId: "drive" },
  { title: "Buckets", href: "/buckets", icon: Database, appId: "buckets" },
  { title: "Calendar", href: "/calendar", icon: Calendar, appId: "calendar" },
  { title: "Directory", href: "/directory", icon: Users, appId: "directory" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasApp, loading } = useScopes()
  const { toggleSidebar } = useSidebar()

  const visibleItems = loading
    ? [] // show nothing while loading to avoid flash
    : navItems.filter((item) => hasApp(item.appId))

  const handleSignOut = async () => {
    await cacheClear()
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <button
          className="px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <NinkenLogoCompact />
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuButton>
                      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                visibleItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href)}
                      render={<Link href={item.href} />}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
