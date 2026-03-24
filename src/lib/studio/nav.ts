import type { ProviderNavItem } from "@/lib/providers/types"

export const studioNavItems: ProviderNavItem[] = [
  { id: "studio-token-intel", title: "Token Intelligence", href: "/studio", iconName: "Key" },
  { id: "studio-services", title: "Services", href: "/studio/services", iconName: "Globe" },
  { id: "studio-extraction", title: "Extraction", href: "/studio/extraction", iconName: "FileDown" },
  { id: "studio-opsec", title: "OPSEC", href: "/studio/opsec", iconName: "Shield" },
  { id: "studio-collection", title: "Collection", href: "/studio/collection", iconName: "Package" },
  { id: "studio-api-explorer", title: "API Explorer", href: "/studio/api-explorer", iconName: "Terminal" },
  { id: "studio-offline-db", title: "Offline DB", href: "/studio/offline-db", iconName: "Database" },
]
