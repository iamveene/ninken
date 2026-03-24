import type { ProviderNavItem } from "@/lib/providers/types"

/**
 * Provider-agnostic Intelligence nav items for Explore mode.
 * Adversarial Graphs is shared across all providers.
 */
export const exploreIntelligenceItems: ProviderNavItem[] = [
  { id: "explore-graphs", title: "Adversarial Graphs", href: "/explore/graphs", iconName: "Share2" },
]
