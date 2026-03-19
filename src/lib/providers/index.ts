import { registerProvider } from "./registry"
import { googleProvider } from "./google"
import { microsoftProvider } from "./microsoft"

// Auto-register built-in providers
registerProvider(googleProvider)
registerProvider(microsoftProvider)

export type {
  ProviderId,
  CredentialKind,
  BaseCredential,
  GoogleCredential,
  GoogleServiceAccountCredential,
  MicrosoftCredential,
  MicrosoftServicePrincipalCredential,
  StoredProfile,
  ActiveTokenCookie,
  ProviderNavItem,
  ServiceProvider,
} from "./types"
export type { CredentialStrategy } from "./credential-strategy"
export { registerProvider, getProvider, getAllProviders, detectProvider } from "./registry"
export { googleProvider } from "./google"
export { microsoftProvider, extractAllCredentials } from "./microsoft"
export type { ExtractedMicrosoftAccount } from "./microsoft"
