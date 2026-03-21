import type { CredentialStrategy } from "./credential-strategy"
import type { BaseCredential } from "./types"

/**
 * Extended strategy for credentials whose refresh token exchange
 * must happen in a browser JS context (e.g., SPA-registered OAuth clients).
 *
 * The caller (useSpaRefresher hook) is responsible for:
 *  - Calling clientRefresh() from the browser
 *  - Writing the rotated refresh token back to IndexedDB
 *  - Pushing the fresh access token to the server via /api/auth/token-push
 */
export interface ClientRefreshableStrategy<
  C extends BaseCredential = BaseCredential,
> extends CredentialStrategy<C> {
  /** True — this strategy requires browser-side execution */
  readonly requiresBrowserContext: true

  /**
   * Perform the OAuth2 token exchange in the browser JS context.
   * Returns the fresh access token AND the rotated refresh token.
   */
  clientRefresh(credential: C): Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>

  /**
   * Check whether this credential needs a refresh now.
   * Typically: no access_token yet, or expires within 10 minutes.
   */
  needsRefresh(credential: C): boolean
}

/** Type guard: is this strategy a client-refreshable (SPA) strategy? */
export function isClientRefreshable(
  strategy: CredentialStrategy,
): strategy is ClientRefreshableStrategy {
  return (
    "requiresBrowserContext" in strategy &&
    (strategy as ClientRefreshableStrategy).requiresBrowserContext === true
  )
}
