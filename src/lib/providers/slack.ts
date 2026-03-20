import type {
  BaseCredential,
  SlackCredential,
  SlackBrowserSessionCredential,
  SlackApiTokenCredential,
  ServiceProvider,
} from "./types"
import { parseSlackError } from "../slack"

// Synthetic capability strings for session tokens (no OAuth scopes to introspect)
const SLACK_CAPABILITIES = [
  "slack:conversations",
  "slack:files",
  "slack:users",
]

/**
 * Check if a raw string is a Slack API token (xoxb- or xoxp-).
 */
function isSlackApiToken(raw: unknown): raw is string {
  if (typeof raw !== "string") return false
  return raw.startsWith("xoxb-") || raw.startsWith("xoxp-")
}

/**
 * Check if raw input is an already-bootstrapped API token credential.
 */
function isBootstrappedApiToken(
  raw: unknown
): raw is SlackApiTokenCredential {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
  const obj = raw as Record<string, unknown>
  return (
    obj.credentialKind === "api-token" &&
    obj.provider === "slack" &&
    typeof obj.access_token === "string"
  )
}

/**
 * Extract the d cookie value from various input shapes:
 * 1. Raw "xoxd-..." string
 * 2. { d_cookie: "xoxd-..." }
 * 3. { d: "xoxd-..." }
 * 4. { provider: "slack", d_cookie: "..." }
 * 5. Browser cookie dump array: [{ name: "d", value: "xoxd-..." }]
 * 6. Full Slack cookie object with "d" key
 */
function extractDCookie(raw: unknown): string | null {
  // Raw string
  if (typeof raw === "string") {
    const decoded = decodeURIComponent(raw)
    if (decoded.startsWith("xoxd-")) return decoded
    return null
  }

  if (!raw || typeof raw !== "object") return null

  // Browser cookie dump array: [{ name: "d", value: "xoxd-..." }]
  if (Array.isArray(raw)) {
    const dEntry = raw.find(
      (c: unknown) =>
        c &&
        typeof c === "object" &&
        (c as Record<string, unknown>).name === "d" &&
        typeof (c as Record<string, unknown>).value === "string"
    ) as Record<string, unknown> | undefined
    if (dEntry) {
      const val = decodeURIComponent(dEntry.value as string)
      if (val.startsWith("xoxd-")) return val
    }
    return null
  }

  const obj = raw as Record<string, unknown>

  // { d_cookie: "xoxd-..." }
  if (typeof obj.d_cookie === "string") {
    const val = decodeURIComponent(obj.d_cookie)
    if (val.startsWith("xoxd-")) return val
  }

  // { d: "xoxd-..." }
  if (typeof obj.d === "string") {
    const val = decodeURIComponent(obj.d)
    if (val.startsWith("xoxd-")) return val
  }

  return null
}

/**
 * Check if raw input is an already-bootstrapped browser session SlackCredential
 * (has both d_cookie and xoxc_token).
 */
function isBootstrappedSlackCredential(
  raw: unknown
): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
  const obj = raw as Record<string, unknown>
  return (
    typeof obj.d_cookie === "string" &&
    typeof obj.xoxc_token === "string" &&
    (obj.provider === "slack" || obj.xoxc_token.toString().startsWith("xoxc-"))
  )
}

export const slackProvider: ServiceProvider = {
  id: "slack",
  name: "Slack",
  description: "Channels, Messages, Files",
  iconName: "MessageSquare",

  detectCredential(raw: unknown): boolean {
    // API token (xoxb-/xoxp-) — check first
    if (isSlackApiToken(raw)) return true

    // Already-bootstrapped API token credential object
    if (isBootstrappedApiToken(raw)) return true

    // Already bootstrapped browser session credential
    if (isBootstrappedSlackCredential(raw)) return true

    // Raw d cookie in any supported format
    return extractDCookie(raw) !== null
  },

  /**
   * Bootstrap: called client-side before validateCredential.
   * - API tokens: call /api/slack/validate-token for enrichment
   * - Browser sessions: call /api/slack/bootstrap for xoxc- extraction
   */
  async bootstrapCredential(raw: unknown): Promise<unknown> {
    // Already-bootstrapped API token — skip
    if (isBootstrappedApiToken(raw)) return raw

    // Raw API token string — validate and enrich
    if (isSlackApiToken(raw)) {
      const res = await fetch("/api/slack/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: raw }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(
          err.error || `Token validation failed: HTTP ${res.status}`
        )
      }

      return res.json()
    }

    // Already bootstrapped browser session — skip
    if (isBootstrappedSlackCredential(raw)) return raw

    const dCookie = extractDCookie(raw)
    if (!dCookie) {
      throw new Error("Could not extract d cookie from input")
    }

    const res = await fetch("/api/slack/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ d_cookie: dCookie }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      throw new Error(
        err.error || `Bootstrap failed: HTTP ${res.status}`
      )
    }

    return res.json()
  },

  validateCredential(
    raw: unknown
  ):
    | { valid: true; credential: SlackCredential; email?: string }
    | { valid: false; error: string } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { valid: false, error: "Invalid credential format" }
    }

    const obj = raw as Record<string, unknown>

    // API token credential
    if (obj.credentialKind === "api-token") {
      if (typeof obj.access_token !== "string" || !obj.access_token) {
        return { valid: false, error: "Missing access_token for API token credential" }
      }

      const tokenType = obj.token_type as "bot" | "user" | undefined
      if (tokenType !== "bot" && tokenType !== "user") {
        return { valid: false, error: "Invalid token_type — must be 'bot' or 'user'" }
      }

      const credential: SlackApiTokenCredential = {
        provider: "slack",
        credentialKind: "api-token",
        token_type: tokenType,
        access_token: obj.access_token as string,
        team_id: typeof obj.team_id === "string" ? obj.team_id : undefined,
        team_domain: typeof obj.team_domain === "string" ? obj.team_domain : undefined,
        user_id: typeof obj.user_id === "string" ? obj.user_id : undefined,
        bot_id: typeof obj.bot_id === "string" ? obj.bot_id : undefined,
        scopes: Array.isArray(obj.scopes) ? (obj.scopes as string[]) : undefined,
      }

      return { valid: true, credential }
    }

    // Browser session credential — must be bootstrapped by this point
    if (typeof obj.d_cookie !== "string" || !obj.d_cookie) {
      return { valid: false, error: "Missing d_cookie" }
    }

    if (typeof obj.xoxc_token !== "string" || !obj.xoxc_token) {
      return {
        valid: false,
        error:
          "Missing xoxc_token — credential must be bootstrapped before validation",
      }
    }

    if (typeof obj.team_id !== "string" || !obj.team_id) {
      return { valid: false, error: "Missing team_id" }
    }

    const credential: SlackBrowserSessionCredential = {
      provider: "slack",
      credentialKind: "browser-session",
      d_cookie: obj.d_cookie as string,
      xoxc_token: obj.xoxc_token as string,
      team_id: obj.team_id as string,
      team_domain:
        typeof obj.team_domain === "string" ? obj.team_domain : "",
      user_id: typeof obj.user_id === "string" ? obj.user_id : "",
    }

    return { valid: true, credential }
  },

  async getAccessToken(credential: BaseCredential): Promise<string> {
    const c = credential as SlackCredential
    if (c.credentialKind === "api-token") {
      return c.access_token
    }
    return c.xoxc_token
  },

  async fetchScopes(credential: BaseCredential): Promise<string[]> {
    const c = credential as SlackCredential
    if (c.credentialKind === "api-token" && c.scopes && c.scopes.length > 0) {
      return c.scopes
    }
    // Session tokens have full user access — return synthetic capabilities
    return SLACK_CAPABILITIES
  },

  emailEndpoint: "/api/slack/me",
  defaultRoute: "/slack-dashboard",

  operateNavItems: [
    {
      id: "channels",
      title: "Channels",
      href: "/channels",
      iconName: "Hash",
    },
    {
      id: "files",
      title: "Files",
      href: "/slack-files",
      iconName: "FileText",
    },
    {
      id: "users",
      title: "Users",
      href: "/slack-users",
      iconName: "Users",
    },
  ],

  auditNavItems: [],

  serviceSubNav: {
    channels: [
      {
        id: "channels-all",
        title: "All Channels",
        href: "/channels",
        iconName: "Hash",
      },
      {
        id: "channels-public",
        title: "Public",
        href: "/channels?view=public",
        iconName: "Globe",
      },
      {
        id: "channels-private",
        title: "Private",
        href: "/channels?view=private",
        iconName: "Lock",
      },
      {
        id: "channels-archived",
        title: "Archived",
        href: "/channels?view=archived",
        iconName: "Archive",
      },
      {
        id: "channels-dms",
        title: "Direct Messages",
        href: "/channels?view=im",
        iconName: "Mail",
      },
    ],
    files: [
      {
        id: "files-all",
        title: "All Files",
        href: "/slack-files",
        iconName: "FileText",
      },
    ],
  },

  scopeAppMap: {
    channels: ["slack:conversations", "channels:read", "groups:read", "im:read"],
    files: ["slack:files", "files:read"],
    users: ["slack:users", "users:read"],
  },

  parseApiError: parseSlackError,

  canRefresh(): boolean {
    return false
  },

  minimalCredential(credential: BaseCredential): BaseCredential {
    const c = credential as SlackCredential
    if (c.credentialKind === "api-token") {
      return {
        provider: "slack",
        credentialKind: "api-token",
        token_type: c.token_type,
        access_token: c.access_token,
        team_id: c.team_id,
        team_domain: c.team_domain,
        user_id: c.user_id,
        bot_id: c.bot_id,
        scopes: c.scopes,
      } as SlackApiTokenCredential
    }
    return {
      provider: "slack",
      credentialKind: "browser-session",
      d_cookie: c.d_cookie,
      xoxc_token: c.xoxc_token,
      team_id: c.team_id,
      team_domain: c.team_domain,
      user_id: c.user_id,
    } as SlackBrowserSessionCredential
  },
}
