import type { ProviderId, ServiceProvider } from "./types"

const providers = new Map<ProviderId, ServiceProvider>()

export function registerProvider(provider: ServiceProvider): void {
  providers.set(provider.id, provider)
}

export function getProvider(id: ProviderId): ServiceProvider | undefined {
  return providers.get(id)
}

export function getAllProviders(): ServiceProvider[] {
  return Array.from(providers.values())
}

/**
 * Detect which provider can handle the given raw credential.
 * Returns the first matching provider, or null if none match.
 */
export function detectProvider(raw: unknown): ServiceProvider | null {
  for (const provider of providers.values()) {
    if (provider.detectCredential(raw)) return provider
  }
  return null
}
