import { registerProvider } from "./registry"
import { googleProvider } from "./google"
import { microsoftProvider } from "./microsoft"
import { slackProvider } from "./slack"
import { githubProvider } from "./github"
import { gitlabProvider } from "./gitlab"

// Auto-register built-in providers
registerProvider(googleProvider)
registerProvider(microsoftProvider)
registerProvider(slackProvider)
registerProvider(githubProvider)
registerProvider(gitlabProvider)

export type {
  ProviderId,
  CredentialKind,
  BaseCredential,
  AccessTokenCredential,
  GoogleCredential,
  GoogleServiceAccountCredential,
  MicrosoftCredential,
  MicrosoftServicePrincipalCredential,
  SlackCredential,
  StoredProfile,
  ActiveTokenCookie,
  ProviderNavItem,
  ServiceProvider,
} from "./types"
export type { CredentialStrategy } from "./credential-strategy"

export { minimalAccessToken } from "./types"
export { registerProvider, getProvider, getAllProviders, detectProvider } from "./registry"
export { googleProvider } from "./google"
export { microsoftProvider, extractAllCredentials } from "./microsoft"
export type { ExtractedMicrosoftAccount } from "./microsoft"
export { slackProvider } from "./slack"
export { githubProvider } from "./github"
export { gitlabProvider } from "./gitlab"
