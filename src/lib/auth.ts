export type TokenData = {
  token?: string
  refresh_token: string
  client_id: string
  client_secret: string
  token_uri?: string
}

export type ProfileData = TokenData & {
  email?: string
}

export const AUTH_COOKIE_NAME = "workspace_tokens"
export const ACTIVE_PROFILE_COOKIE = "workspace_active_profile"

const REQUIRED_FIELDS: (keyof TokenData)[] = [
  "refresh_token",
  "client_id",
  "client_secret",
]

export function validateTokenData(
  data: unknown
): { valid: true; token: TokenData } | { valid: false; error: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid JSON" }
  }

  const obj = data as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (typeof obj[field] !== "string" || !obj[field]) {
      return { valid: false, error: `Missing required field: ${field}` }
    }
  }

  return {
    valid: true,
    token: {
      token: typeof obj.token === "string" ? obj.token : undefined,
      refresh_token: obj.refresh_token as string,
      client_id: obj.client_id as string,
      client_secret: obj.client_secret as string,
      token_uri: typeof obj.token_uri === "string" ? obj.token_uri : undefined,
    },
  }
}

export function getProfilesFromCookies(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): ProfileData[] {
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)
  if (!cookie?.value) return []

  try {
    const data = JSON.parse(cookie.value)
    if (!Array.isArray(data)) {
      // Migrate single token to array format
      const result = validateTokenData(data)
      return result.valid ? [result.token] : []
    }
    return data as ProfileData[]
  } catch {
    return []
  }
}

export function getActiveProfileIndex(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): number {
  const cookie = cookieStore.get(ACTIVE_PROFILE_COOKIE)
  if (!cookie?.value) return 0
  const idx = parseInt(cookie.value, 10)
  return isNaN(idx) ? 0 : idx
}

export function getTokenFromCookies(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): TokenData | null {
  const profiles = getProfilesFromCookies(cookieStore)
  if (profiles.length === 0) return null

  const activeIndex = getActiveProfileIndex(cookieStore)
  const idx = activeIndex >= 0 && activeIndex < profiles.length ? activeIndex : 0
  const profile = profiles[idx]
  if (!profile) return null

  const result = validateTokenData(profile)
  return result.valid ? result.token : null
}
