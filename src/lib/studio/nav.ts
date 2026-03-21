import type { ProviderNavItem } from "@/lib/providers/types"

export const studioNavItems: ProviderNavItem[] = [
  { id: "studio-analyzer", title: "Analyzer", href: "/studio", iconName: "Search" },
  { id: "studio-services", title: "Services", href: "/studio/services", iconName: "Globe" },
  { id: "studio-extraction", title: "Extraction", href: "/studio/extraction", iconName: "FileDown" },
  { id: "studio-converter", title: "Converter", href: "/studio/converter", iconName: "ArrowRightLeft" },
  { id: "studio-opsec", title: "OPSEC", href: "/studio/opsec", iconName: "Shield" },
  { id: "studio-scopes", title: "Scopes", href: "/studio/scopes", iconName: "ShieldCheck" },
  { id: "studio-collection", title: "Collection", href: "/studio/collection", iconName: "Package" },
  { id: "studio-offline-db", title: "Offline DB", href: "/studio/offline-db", iconName: "Database" },
]
