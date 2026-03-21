import type { SlackCredential, SlackApiTokenCredential } from "./providers/types"

const SLACK_API_BASE = "https://slack.com/api"

// Realistic browser User-Agent for bootstrap requests
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

/**
 * Bootstrap the xoxc- token from a Slack workspace page using the d cookie.
 * The d cookie alone isn't enough for API calls — Slack requires
 * both the xoxc- token (Authorization header) and d cookie (Cookie header).
 *
 * The xoxc- token is embedded in the page's boot_data JSON blob.
 */
export async function bootstrapToken(dCookie: string): Promise<{
  xoxc_token: string
  team_id: string
  team_domain: string
  user_id: string
}> {
  // URL-decode the d cookie if it's encoded (common from cookie dump tools)
  const decodedCookie = decodeURIComponent(dCookie)

  // Use app.slack.com — works for any workspace with a valid d cookie
  const res = await fetch("https://app.slack.com", {
    headers: {
      Cookie: `d=${encodeURIComponent(decodedCookie)}`,
      "User-Agent": BROWSER_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  })

  if (!res.ok) {
    throw new Error(
      `Slack bootstrap failed: HTTP ${res.status}. The d cookie may be invalid or expired.`
    )
  }

  const html = await res.text()

  // Check for login redirect (invalid/expired session)
  if (
    html.includes("/signin") &&
    !html.includes("api_token") &&
    !html.includes("xoxc-")
  ) {
    throw new Error(
      "Invalid or expired d cookie — Slack redirected to sign-in page"
    )
  }

  // Strategy 1: Look for api_token in boot_data JSON
  const apiTokenMatch = html.match(/"api_token"\s*:\s*"(xoxc-[^"]+)"/)
  // Strategy 2: Look for token field in various JSON shapes
  const tokenMatch =
    apiTokenMatch || html.match(/"token"\s*:\s*"(xoxc-[^"]+)"/)
  // Strategy 3: Broader xoxc- search in script blocks
  const xoxcMatch = tokenMatch || html.match(/\b(xoxc-[a-zA-Z0-9-]+)/)

  if (!xoxcMatch) {
    throw new Error(
      "Could not extract xoxc- token from Slack page. The d cookie may be valid but the page structure has changed."
    )
  }

  const xoxc_token = xoxcMatch[1]

  // Extract team_id
  const teamIdMatch =
    html.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/) ||
    html.match(/"id"\s*:\s*"(T[A-Z0-9]+)"/)
  const team_id = teamIdMatch?.[1] || ""

  // Extract team_domain
  const teamDomainMatch =
    html.match(/"team_domain"\s*:\s*"([^"]+)"/) ||
    html.match(/"domain"\s*:\s*"([^"]+)"/)
  const team_domain = teamDomainMatch?.[1] || ""

  // Extract user_id
  const userIdMatch =
    html.match(/"user_id"\s*:\s*"(U[A-Z0-9]+)"/) ||
    html.match(/"id"\s*:\s*"(U[A-Z0-9]+)"/)
  const user_id = userIdMatch?.[1] || ""

  // Validate with auth.test
  try {
    const testRes = await fetch(`${SLACK_API_BASE}/auth.test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xoxc_token}`,
        Cookie: `d=${encodeURIComponent(decodedCookie)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    const testData = (await testRes.json()) as {
      ok: boolean
      user_id?: string
      team_id?: string
      team?: string
      url?: string
      error?: string
    }

    if (testData.ok) {
      return {
        xoxc_token,
        team_id: testData.team_id || team_id,
        team_domain:
          testData.url
            ?.replace("https://", "")
            .replace(".slack.com/", "")
            .replace(".slack.com", "") || team_domain,
        user_id: testData.user_id || user_id,
      }
    }
  } catch {
    // auth.test failed but we got the token — use parsed values
  }

  if (!team_id || !user_id) {
    throw new Error(
      "Bootstrapped xoxc- token but could not resolve team_id/user_id. The session may be partially invalid."
    )
  }

  return { xoxc_token, team_id, team_domain, user_id }
}

const SLACK_MAX_RETRIES = 3

/**
 * Authenticated fetch to Slack Web API.
 * For browser-session credentials: sends both Authorization (xoxc-) and Cookie (d) headers.
 * For api-token credentials: sends only Authorization (Bearer) header.
 * Handles 429 rate limiting with bounded retry.
 */
export async function slackFetch(
  credential: SlackCredential,
  apiMethod: string,
  params?: Record<string, string | number | boolean>,
  options?: RequestInit,
  _retryCount = 0
): Promise<Response> {
  const url = `${SLACK_API_BASE}/${apiMethod}`

  const body = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      body.set(key, String(value))
    }
  }

  // Build auth headers based on credential kind
  let authHeaders: Record<string, string>
  if (credential.credentialKind === "api-token") {
    // API token (xoxb-/xoxp-): Bearer-only, no cookie needed
    authHeaders = {
      Authorization: `Bearer ${credential.access_token}`,
    }
  } else {
    // Browser session (xoxc-): requires both Bearer and d cookie
    const decodedCookie = decodeURIComponent(credential.d_cookie)
    authHeaders = {
      Authorization: `Bearer ${credential.xoxc_token}`,
      Cookie: `d=${encodeURIComponent(decodedCookie)}`,
    }
  }

  const res = await fetch(url, {
    method: "POST",
    ...options,
    headers: {
      ...authHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(options?.headers as Record<string, string> | undefined),
    },
    body: body.toString(),
  })

  // Handle rate limiting — retry after Retry-After, up to max retries
  if (res.status === 429) {
    if (_retryCount >= SLACK_MAX_RETRIES) {
      throw new Error(
        `Slack API rate limited after ${SLACK_MAX_RETRIES} retries (${apiMethod})`
      )
    }
    const retryAfter = parseInt(res.headers.get("Retry-After") || "3", 10)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    return slackFetch(credential, apiMethod, params, options, _retryCount + 1)
  }

  return res
}

/**
 * Convenience: Slack API call that parses JSON and throws on ok:false.
 */
export async function slackApi<T = Record<string, unknown>>(
  credential: SlackCredential,
  apiMethod: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const res = await slackFetch(credential, apiMethod, params)

  if (!res.ok) {
    throw new Error(`Slack API HTTP error: ${res.status}`)
  }

  const data = (await res.json()) as { ok: boolean; error?: string } & T

  if (!data.ok) {
    const err = new Error(data.error || "Slack API error") as Error & {
      slackError: string
    }
    err.slackError = data.error || "unknown_error"
    throw err
  }

  return data
}

/**
 * Paginated Slack API call using cursor-based pagination.
 * Slack methods return response_metadata.next_cursor for pagination.
 */
export async function slackPaginated<T>(
  credential: SlackCredential,
  apiMethod: string,
  responseKey: string,
  params?: Record<string, string | number | boolean>,
  options?: { limit?: number; cursor?: string }
): Promise<{ items: T[]; nextCursor: string | null }> {
  const mergedParams = {
    ...params,
    limit: options?.limit ?? 200,
    ...(options?.cursor ? { cursor: options.cursor } : {}),
  }

  const data = await slackApi<Record<string, unknown>>(
    credential,
    apiMethod,
    mergedParams
  )

  const items = (data[responseKey] as T[]) || []
  const metadata = data.response_metadata as
    | { next_cursor?: string }
    | undefined
  const nextCursor = metadata?.next_cursor || null

  return { items, nextCursor: nextCursor === "" ? null : nextCursor }
}

/**
 * Validate a Slack API token (xoxb- or xoxp-) by calling auth.test.
 * Returns enriched metadata including team, user, bot info, and scopes.
 */
export async function validateSlackApiToken(token: string): Promise<{
  ok: boolean
  token_type: "bot" | "user"
  team_id: string
  team_domain: string
  user_id: string
  bot_id?: string
  scopes: string[]
  error?: string
}> {
  const res = await fetch(`${SLACK_API_BASE}/auth.test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })

  if (!res.ok) {
    throw new Error(`Slack auth.test HTTP error: ${res.status}`)
  }

  // Parse scopes from X-OAuth-Scopes header
  const scopeHeader = res.headers.get("X-OAuth-Scopes") || ""
  const scopes = scopeHeader
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const data = (await res.json()) as {
    ok: boolean
    user_id?: string
    user?: string
    team_id?: string
    team?: string
    url?: string
    bot_id?: string
    error?: string
    is_enterprise_install?: boolean
  }

  if (!data.ok) {
    return {
      ok: false,
      token_type: token.startsWith("xoxb-") ? "bot" : "user",
      team_id: "",
      team_domain: "",
      user_id: "",
      scopes: [],
      error: data.error || "auth.test failed",
    }
  }

  const teamDomain =
    data.url
      ?.replace("https://", "")
      .replace(".slack.com/", "")
      .replace(".slack.com", "") || ""

  return {
    ok: true,
    token_type: token.startsWith("xoxb-") ? "bot" : "user",
    team_id: data.team_id || "",
    team_domain: teamDomain,
    user_id: data.user_id || "",
    bot_id: data.bot_id,
    scopes,
  }
}

/**
 * Parse a Slack API error into a standardized { status, message } shape.
 */
export function parseSlackError(
  error: unknown
): { status: number; message: string } | null {
  if (!error || typeof error !== "object") return null

  const err = error as {
    slackError?: string
    error?: string
    message?: string
  }

  const slackError = err.slackError || err.error
  if (typeof slackError === "string") {
    const errorStatusMap: Record<string, number> = {
      not_authed: 401,
      invalid_auth: 401,
      token_revoked: 401,
      token_expired: 401,
      account_inactive: 401,
      missing_scope: 403,
      no_permission: 403,
      ekm_access_denied: 403,
      channel_not_found: 404,
      user_not_found: 404,
      message_not_found: 404,
      file_not_found: 404,
      team_not_found: 404,
      ratelimited: 429,
      fatal_error: 500,
      internal_error: 500,
    }

    return {
      status: errorStatusMap[slackError] || 400,
      message: err.message || slackError,
    }
  }

  return null
}
