const GITHUB_API_BASE = "https://api.github.com"
const GITHUB_MAX_RETRIES = 3

// Per-token rate limit tracking (keyed by first 16 chars of token)
const rateLimitState = new Map<string, { remaining: number; reset: number }>()

function tokenKey(token: string): string {
  return token.slice(0, 16)
}

export function getRateLimit(token?: string) {
  if (token) {
    const state = rateLimitState.get(tokenKey(token))
    return state || { remaining: 5000, reset: 0 }
  }
  // Return worst-case across all tokens for backward compat
  let worstRemaining = 5000
  let latestReset = 0
  for (const state of rateLimitState.values()) {
    if (state.remaining < worstRemaining) worstRemaining = state.remaining
    if (state.reset > latestReset) latestReset = state.reset
  }
  return { remaining: worstRemaining, reset: latestReset }
}

function trackRateLimit(token: string, headers: Headers) {
  const remaining = headers.get("X-RateLimit-Remaining")
  const reset = headers.get("X-RateLimit-Reset")
  const key = tokenKey(token)
  const current = rateLimitState.get(key) || { remaining: 5000, reset: 0 }
  if (remaining !== null) current.remaining = parseInt(remaining, 10)
  if (reset !== null) current.reset = parseInt(reset, 10)
  rateLimitState.set(key, current)
}

/**
 * Authenticated fetch to GitHub REST API.
 * Tracks per-token rate limits and retries on 429 with bounded retries.
 */
export async function githubFetch(
  token: string,
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | boolean> },
  _retryCount = 0
): Promise<Response> {
  let url = path.startsWith("http") ? path : `${GITHUB_API_BASE}${path}`

  if (options?.params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(options.params)) {
      searchParams.set(key, String(value))
    }
    url += `?${searchParams}`
  }

  const { params: _params, ...fetchOptions } = options || {}

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(fetchOptions?.headers as Record<string, string> | undefined),
    },
  })

  trackRateLimit(token, res.headers)

  // Handle rate limiting — retry after Retry-After, up to max retries
  const tokenState = rateLimitState.get(tokenKey(token))
  if (res.status === 429 || (res.status === 403 && tokenState?.remaining === 0)) {
    if (_retryCount >= GITHUB_MAX_RETRIES) {
      throw new Error(
        `GitHub API rate limited after ${GITHUB_MAX_RETRIES} retries (${path})`
      )
    }
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    return githubFetch(token, path, options, _retryCount + 1)
  }

  return res
}

/**
 * Convenience: GitHub API call that parses JSON and throws on error.
 * Returns both the data and response headers (for scope detection).
 */
export async function githubJson<T = Record<string, unknown>>(
  token: string,
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | boolean> }
): Promise<{ data: T; headers: Headers }> {
  const res = await githubFetch(token, path, options)

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; documentation_url?: string }
    const err = new Error(body.message || `GitHub API error: ${res.status}`) as Error & {
      status: number
      githubMessage: string
    }
    err.status = res.status
    err.githubMessage = body.message || ""
    throw err
  }

  const data = (await res.json()) as T
  return { data, headers: res.headers }
}

/**
 * Parse Link header for pagination.
 * GitHub uses: <url>; rel="next", <url>; rel="last"
 */
function parseLinkHeader(header: string | null): Record<string, string> {
  if (!header) return {}
  const links: Record<string, string> = {}
  const parts = header.split(",")
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/)
    if (match) {
      links[match[2]] = match[1]
    }
  }
  return links
}

/**
 * Single-page paginated GitHub API call.
 * Returns items + nextPage URL (from Link header).
 */
export async function githubPaginated<T>(
  token: string,
  path: string,
  options?: {
    params?: Record<string, string | number | boolean>
    perPage?: number
    page?: number
  }
): Promise<{ items: T[]; nextPage: string | null; totalCount?: number }> {
  const params = {
    per_page: options?.perPage ?? 100,
    ...(options?.page ? { page: options.page } : {}),
    ...(options?.params || {}),
  }

  const res = await githubFetch(token, path, {
    params: params as Record<string, string | number | boolean>,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    const err = new Error(body.message || `GitHub API error: ${res.status}`) as Error & {
      status: number
      githubMessage: string
    }
    err.status = res.status
    err.githubMessage = body.message || ""
    throw err
  }

  const data = (await res.json()) as T[]
  const links = parseLinkHeader(res.headers.get("Link"))

  return {
    items: Array.isArray(data) ? data : [],
    nextPage: links.next || null,
  }
}

/**
 * Exhaust all pages up to a bounded max.
 * Returns all items concatenated.
 */
export async function githubPaginateAll<T>(
  token: string,
  path: string,
  options?: {
    params?: Record<string, string | number | boolean>
    perPage?: number
    maxPages?: number
  }
): Promise<T[]> {
  const maxPages = options?.maxPages ?? 10
  const allItems: T[] = []
  let currentPath: string | null = path
  let page = 1
  const baseParams = {
    per_page: options?.perPage ?? 100,
    ...(options?.params || {}),
  }

  while (currentPath && page <= maxPages) {
    const isFullUrl = currentPath.startsWith("http")
    const res = await githubFetch(
      token,
      currentPath,
      isFullUrl ? undefined : { params: { ...baseParams, page } as Record<string, string | number | boolean> }
    )

    if (!res.ok) break

    const data = (await res.json()) as T[]
    if (!Array.isArray(data) || data.length === 0) break

    allItems.push(...data)

    const links = parseLinkHeader(res.headers.get("Link"))
    currentPath = links.next || null
    page++
  }

  return allItems
}

/**
 * Detect OAuth scopes from a GitHub API response.
 * Classic PATs return scopes in X-OAuth-Scopes header.
 * Fine-grained PATs return no such header.
 */
export async function detectScopes(
  token: string
): Promise<{ scopes: string[]; tokenType: "classic" | "fine-grained" | "unknown" }> {
  const res = await githubFetch(token, "/user")
  const scopeHeader = res.headers.get("X-OAuth-Scopes")

  if (scopeHeader !== null && scopeHeader !== "") {
    return {
      scopes: scopeHeader.split(",").map((s) => s.trim()).filter(Boolean),
      tokenType: "classic",
    }
  }

  // Fine-grained PATs have no X-OAuth-Scopes header
  // Return synthetic capabilities based on what we can probe
  if (scopeHeader === "") {
    return { scopes: [], tokenType: "fine-grained" }
  }

  return { scopes: [], tokenType: "unknown" }
}

/**
 * Parse a GitHub API error into a standardized { status, message } shape.
 */
export function parseGitHubError(
  error: unknown
): { status: number; message: string } | null {
  if (!error || typeof error !== "object") return null

  const err = error as {
    status?: number
    githubMessage?: string
    message?: string
  }

  if (typeof err.status === "number" && err.status >= 400) {
    let message = err.githubMessage || err.message || "GitHub API error"

    // Annotate 404s — GitHub returns 404 for both "not found" and "insufficient permissions"
    if (err.status === 404) {
      message += " (note: GitHub also returns 404 when the token lacks permission to access this resource)"
    }

    return { status: err.status, message }
  }

  // Try to detect from message string
  if (typeof err.message === "string") {
    if (err.message.includes("Bad credentials")) {
      return { status: 401, message: "Bad credentials — token may be invalid or revoked" }
    }
    if (err.message.includes("rate limit")) {
      return { status: 429, message: err.message }
    }
    if (err.message.includes("Not Found")) {
      return {
        status: 404,
        message: err.message + " (note: GitHub also returns 404 for insufficient permissions)",
      }
    }
  }

  return null
}
