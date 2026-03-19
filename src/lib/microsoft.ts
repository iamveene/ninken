import type { MicrosoftCredential } from "./providers/types"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const LOGIN_BASE = "https://login.microsoftonline.com"

/** Default OAuth2 scope for Microsoft Graph API */
export const DEFAULT_RESOURCE = "https://graph.microsoft.com/.default"

// In-memory access token cache: credential hash → { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

function credentialKey(cred: MicrosoftCredential, resource: string = DEFAULT_RESOURCE): string {
  return `${cred.tenant_id}:${cred.client_id}:${cred.refresh_token.slice(0, 16)}:${resource}`
}

/**
 * Decode the payload of a JWT without verification (access tokens are JWTs).
 * Returns null if decoding fails.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(payload)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Extract scopes from a Microsoft access token JWT's `scp` claim.
 */
export function decodeScopesFromJwt(jwt: string): string[] {
  const payload = decodeJwtPayload(jwt)
  if (!payload) return []
  const scp = payload.scp
  if (typeof scp === "string") {
    return scp.split(" ").filter(Boolean)
  }
  return []
}

/**
 * Refresh the access token using the refresh token (public client — no client_secret).
 */
export async function refreshAccessToken(
  credential: MicrosoftCredential,
  resource: string = DEFAULT_RESOURCE
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const tokenUri =
    credential.token_uri ||
    `${LOGIN_BASE}/${credential.tenant_id}/oauth2/v2.0/token`

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refresh_token,
      client_id: credential.client_id,
      scope: `${resource} offline_access`,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Token refresh failed")
    throw new Error(`Microsoft token refresh failed: ${text}`)
  }

  const data = await res.json()
  if (!data.access_token) {
    throw new Error("No access_token in Microsoft refresh response")
  }

  return {
    access_token: data.access_token as string,
    expires_in: (data.expires_in as number) || 3600,
    refresh_token: data.refresh_token as string | undefined,
  }
}

/**
 * Get a valid access token, using cache if available (5-min buffer before expiry).
 */
export async function getAccessToken(
  credential: MicrosoftCredential,
  resource: string = DEFAULT_RESOURCE
): Promise<string> {
  const key = credentialKey(credential, resource)
  const cached = tokenCache.get(key)
  const now = Date.now()

  // Use cached token if it's valid for at least 5 more minutes
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.token
  }

  const result = await refreshAccessToken(credential, resource)
  tokenCache.set(key, {
    token: result.access_token,
    expiresAt: now + result.expires_in * 1000,
  })

  return result.access_token
}

/**
 * Sanitize a value for use in OData $filter expressions.
 */
export function sanitizeODataValue(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Build an OData $filter string from key-value pairs (equality checks).
 */
export function buildODataFilter(
  filters: Record<string, string | undefined>
): string {
  return Object.entries(filters)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key} eq '${sanitizeODataValue(value)}'`)
    .join(" and ")
}

type GraphFetchOptions = RequestInit & {
  /** If true, return the raw Response instead of parsing JSON */
  raw?: boolean
  /** Additional headers to merge */
  extraHeaders?: Record<string, string>
  /** Override the default Graph scope (e.g., for Azure Management API) */
  resource?: string
}

/**
 * Authenticated fetch to Microsoft Graph API.
 * Handles token refresh, rate limiting (429), and error responses.
 */
export async function graphFetch(
  credential: MicrosoftCredential,
  path: string,
  options?: GraphFetchOptions
): Promise<Response> {
  const accessToken = await getAccessToken(credential, options?.resource)

  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(options?.extraHeaders || {}),
  }

  // Add Content-Type for requests with a body
  if (options?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  })

  // Handle rate limiting — retry once after Retry-After
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    return graphFetch(credential, path, options)
  }

  return res
}

/**
 * Convenience: authenticated Graph fetch that returns parsed JSON.
 * Throws on non-2xx responses with the Graph error message.
 */
export async function graphJson<T = unknown>(
  credential: MicrosoftCredential,
  path: string,
  options?: GraphFetchOptions
): Promise<T> {
  const res = await graphFetch(credential, path, options)

  if (!res.ok) {
    let message = `Graph API error: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error?.message) {
        message = body.error.message
      }
    } catch {
      // ignore parse errors
    }
    const err = new Error(message) as Error & { status: number; code?: string }
    err.status = res.status
    throw err
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

/**
 * Paginated Graph API fetch. Returns all items from `value` arrays across pages,
 * or returns a single page with a nextPageToken if limit is provided.
 */
export async function graphPaginated<T>(
  credential: MicrosoftCredential,
  path: string,
  options?: {
    top?: number
    select?: string
    orderby?: string
    filter?: string
    search?: string
    extraHeaders?: Record<string, string>
    pageToken?: string
  }
): Promise<{ value: T[]; nextPageToken: string | null }> {
  // If pageToken is provided, it's a base64url-encoded @odata.nextLink
  if (options?.pageToken) {
    const nextLink = atob(options.pageToken.replace(/-/g, "+").replace(/_/g, "/"))
    const res = await graphJson<{ value: T[]; "@odata.nextLink"?: string }>(
      credential,
      nextLink,
      { extraHeaders: options?.extraHeaders }
    )
    return {
      value: res.value || [],
      nextPageToken: res["@odata.nextLink"]
        ? btoa(res["@odata.nextLink"]).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        : null,
    }
  }

  const params = new URLSearchParams()
  if (options?.top) params.set("$top", String(options.top))
  if (options?.select) params.set("$select", options.select)
  if (options?.orderby) params.set("$orderby", options.orderby)
  if (options?.filter) params.set("$filter", options.filter)
  if (options?.search) params.set("$search", `"${options.search}"`)

  const separator = path.includes("?") ? "&" : "?"
  const fullPath = params.toString() ? `${path}${separator}${params}` : path

  const res = await graphJson<{ value: T[]; "@odata.nextLink"?: string }>(
    credential,
    fullPath,
    { extraHeaders: options?.extraHeaders }
  )

  return {
    value: res.value || [],
    nextPageToken: res["@odata.nextLink"]
      ? btoa(res["@odata.nextLink"]).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      : null,
  }
}
