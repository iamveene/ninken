import type { BaseCredential, CredentialKind } from "./types"

/**
 * CredentialStrategy — pluggable auth strategy for a single credential kind.
 *
 * Each provider registers one or more strategies (e.g. Google OAuth + Service Account).
 * The provider delegates detect / validate / getAccessToken to the matching strategy.
 */
export interface CredentialStrategy<
  C extends BaseCredential = BaseCredential,
> {
  /** Discriminator stored on every credential this strategy produces */
  readonly kind: CredentialKind

  /** Human-readable label shown in the UI (e.g. "OAuth Refresh Token") */
  readonly label: string

  /** Return true if the raw JSON looks like something this strategy can handle */
  detect(raw: unknown): boolean

  /** Parse + validate the raw JSON, returning a typed credential or an error */
  validate(
    raw: unknown,
  ):
    | { valid: true; credential: C; email?: string }
    | { valid: false; error: string }

  /** Exchange the credential for a fresh access token */
  getAccessToken(credential: C): Promise<string>

  /** Can this credential be refreshed / reused for new tokens? */
  canRefresh(credential: C): boolean

  /** Strip the credential to the minimum fields needed for token exchange */
  minimalCredential(credential: C): C
}
