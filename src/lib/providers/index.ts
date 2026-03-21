import { registerProvider } from "./registry"
import { googleProvider } from "./google"
import { microsoftProvider } from "./microsoft"
import { slackProvider } from "./slack"
import { githubProvider } from "./github"
import { gitlabProvider } from "./gitlab"
import { awsProvider } from "./aws"

// Auto-register built-in providers
registerProvider(googleProvider)
registerProvider(microsoftProvider)
registerProvider(slackProvider)
registerProvider(githubProvider)
registerProvider(gitlabProvider)
registerProvider(awsProvider)

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
  AwsCredential,
  SlackBrowserSessionCredential,
  SlackApiTokenCredential,
  StoredProfile,
  ActiveTokenCookie,
  ProviderNavItem,
  ServiceProvider,
} from "./types"
export { getActiveCredential, getProfileProviders } from "./types"
export type { CredentialStrategy } from "./credential-strategy"

export { minimalAccessToken } from "./types"
export { registerProvider, getProvider, getAllProviders, detectProvider } from "./registry"
export { googleProvider } from "./google"
export { microsoftProvider, extractAllCredentials } from "./microsoft"
export type { ExtractedMicrosoftAccount } from "./microsoft"
export { slackProvider } from "./slack"
export { githubProvider } from "./github"
export { gitlabProvider } from "./gitlab"
export { awsProvider } from "./aws"
