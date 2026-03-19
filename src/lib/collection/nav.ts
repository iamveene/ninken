import type { ProviderNavItem } from "@/lib/providers/types"

export const collectionNavItems: ProviderNavItem[] = [
  { id: "collection-all", title: "All Items", href: "/collection", iconName: "PackagePlus" },
  { id: "collection-by-service", title: "By Service", href: "/collection/by-service", iconName: "ListTree" },
  { id: "collection-queue", title: "Queue", href: "/collection/queue", iconName: "FolderDown" },
]
