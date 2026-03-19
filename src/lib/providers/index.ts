import { registerProvider } from "./registry"
import { googleProvider } from "./google"

// Auto-register built-in providers
registerProvider(googleProvider)

export type {
  ProviderId,
  BaseCredential,
  GoogleCredential,
  StoredProfile,
  ActiveTokenCookie,
  ProviderNavItem,
  ServiceProvider,
} from "./types"
export { registerProvider, getProvider, getAllProviders, detectProvider } from "./registry"
export { googleProvider } from "./google"
