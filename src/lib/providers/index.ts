import { registerProvider } from "./registry"
import { googleProvider } from "./google"
import { microsoftProvider } from "./microsoft"

// Auto-register built-in providers
registerProvider(googleProvider)
registerProvider(microsoftProvider)

export type {
  ProviderId,
  BaseCredential,
  GoogleCredential,
  MicrosoftCredential,
  StoredProfile,
  ActiveTokenCookie,
  ProviderNavItem,
  ServiceProvider,
} from "./types"
export { registerProvider, getProvider, getAllProviders, detectProvider } from "./registry"
export { googleProvider } from "./google"
export { microsoftProvider, extractAllCredentials } from "./microsoft"
export type { ExtractedMicrosoftAccount } from "./microsoft"
