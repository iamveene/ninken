import type { ProviderNavItem } from "@/lib/providers/types"

export const studioNavItems: ProviderNavItem[] = [
  { id: "studio-analyzer", title: "Analyzer", href: "/studio", iconName: "Search" },
  { id: "studio-services", title: "Services", href: "/studio/services", iconName: "Globe" },
  { id: "studio-extraction", title: "Extraction", href: "/studio/extraction", iconName: "FileDown" },
  { id: "studio-converter", title: "Converter", href: "/studio/converter", iconName: "ArrowRightLeft" },
  { id: "studio-stealth", title: "Stealth", href: "/studio/stealth", iconName: "Eye" },
  { id: "studio-scopes", title: "Scopes", href: "/studio/scopes", iconName: "ShieldCheck" },
]
