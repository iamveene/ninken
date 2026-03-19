const GITLAB_API_BASE = "https://gitlab.com/api/v4"
const GITLAB_MAX_RETRIES = 3

// Per-token rate limit tracking (keyed by first 16 chars of token)
const rateLimitState = new Map<string, { remaining: number; reset: number }>()

function tokenKey(token: string): string {
  return token.slice(0, 16)
}

export function getRateLimit(token?: string) {
  if (token) {
    const state = rateLimitState.get(tokenKey(token))
    return state || { remaining: 2000, reset: 0 }
  }
  let worstRemaining = 2000
  let latestReset = 0
  for (const state of rateLimitState.values()) {
    if (state.remaining < worstRemaining) worstRemaining = state.remaining
    if (state.reset > latestReset) latestReset = state.reset
  }
  return { remaining: worstRemaining, reset: latestReset }
}

function trackRateLimit(token: string, headers: Headers) {
  const remaining = headers.get("RateLimit-Remaining")
  const reset = headers.get("RateLimit-Reset")
  const key = tokenKey(token)
  const current = rateLimitState.get(key) || { remaining: 2000, reset: 0 }
  if (remaining !== null) current.remaining = parseInt(remaining, 10)
  if (reset !== null) current.reset = parseInt(reset, 10)
  rateLimitState.set(key, current)
}

/**
 * Authenticated fetch to GitLab REST API.
 * Tracks per-token rate limits and retries on 429.
 */
export async function gitlabFetch(
  token: string,
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | boolean> },
  _retryCount = 0
): Promise<Response> {
  let url = path.startsWith("http") ? path : `${GITLAB_API_BASE}${path}`

  if (options?.params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(options.params)) {
      searchParams.set(key, String(value))
    }
    url += (url.includes("?") ? "&" : "?") + searchParams
  }

  const { params: _params, ...fetchOptions } = options || {}

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
      ...(fetchOptions?.headers as Record<string, string> | undefined),
    },
  })

  trackRateLimit(token, res.headers)

  if (res.status === 429) {
    if (_retryCount >= GITLAB_MAX_RETRIES) {
      throw new Error(
        `GitLab API rate limited after ${GITLAB_MAX_RETRIES} retries (${path})`
      )
    }
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    return gitlabFetch(token, path, options, _retryCount + 1)
  }

  return res
}

/**
 * Convenience: GitLab API call that parses JSON and throws on error.
 */
export async function gitlabJson<T = Record<string, unknown>>(
  token: string,
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | boolean> }
): Promise<{ data: T; headers: Headers }> {
  const res = await gitlabFetch(token, path, options)

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; error?: string }
    const msg = body.message || body.error || `GitLab API error: ${res.status}`
    const err = new Error(msg) as Error & { status: number; gitlabMessage: string }
    err.status = res.status
    err.gitlabMessage = msg
    throw err
  }

  const data = (await res.json()) as T
  return { data, headers: res.headers }
}

/**
 * Single-page paginated GitLab API call.
 */
export async function gitlabPaginated<T>(
  token: string,
  path: string,
  options?: {
    params?: Record<string, string | number | boolean>
    perPage?: number
    page?: number
  }
): Promise<{ items: T[]; nextPage: number | null; totalCount?: number }> {
  const params = {
    per_page: options?.perPage ?? 100,
    ...(options?.page ? { page: options.page } : {}),
    ...(options?.params || {}),
  }

  const res = await gitlabFetch(token, path, {
    params: params as Record<string, string | number | boolean>,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    const err = new Error(body.message || `GitLab API error: ${res.status}`) as Error & {
      status: number
      gitlabMessage: string
    }
    err.status = res.status
    err.gitlabMessage = body.message || ""
    throw err
  }

  const data = (await res.json()) as T[]
  const nextPageHeader = res.headers.get("X-Next-Page")
  const totalHeader = res.headers.get("X-Total")

  return {
    items: Array.isArray(data) ? data : [],
    nextPage: nextPageHeader ? parseInt(nextPageHeader, 10) : null,
    totalCount: totalHeader ? parseInt(totalHeader, 10) : undefined,
  }
}

/**
 * Exhaust all pages up to a bounded max.
 */
export async function gitlabPaginateAll<T>(
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
  let page = 1

  while (page <= maxPages) {
    const result = await gitlabPaginated<T>(token, path, {
      params: options?.params,
      perPage: options?.perPage,
      page,
    })

    allItems.push(...result.items)

    if (!result.nextPage || result.items.length === 0) break
    page = result.nextPage
  }

  return allItems
}

/**
 * Detect PAT scopes from the /personal_access_tokens/self endpoint.
 */
export async function detectScopes(
  token: string
): Promise<{ scopes: string[]; tokenName: string | null; expiresAt: string | null }> {
  try {
    const { data } = await gitlabJson<{
      scopes: string[]
      name: string
      expires_at: string | null
      revoked: boolean
      active: boolean
    }>(token, "/personal_access_tokens/self")

    return {
      scopes: data.scopes || [],
      tokenName: data.name || null,
      expiresAt: data.expires_at || null,
    }
  } catch {
    return { scopes: [], tokenName: null, expiresAt: null }
  }
}

/**
 * Parse a GitLab API error into a standardized shape.
 */
export function parseGitLabError(
  error: unknown
): { status: number; message: string } | null {
  if (!error || typeof error !== "object") return null

  const err = error as {
    status?: number
    gitlabMessage?: string
    message?: string
  }

  if (typeof err.status === "number" && err.status >= 400) {
    let message = err.gitlabMessage || err.message || "GitLab API error"

    if (err.status === 403) {
      message += " (insufficient permissions for this resource)"
    }
    if (err.status === 404) {
      message += " (resource not found or insufficient permissions)"
    }

    return { status: err.status, message }
  }

  if (typeof err.message === "string") {
    if (err.message.includes("401") || err.message.includes("Unauthorized")) {
      return { status: 401, message: "Unauthorized — token may be invalid or revoked" }
    }
    if (err.message.includes("rate limit")) {
      return { status: 429, message: err.message }
    }
  }

  return null
}
