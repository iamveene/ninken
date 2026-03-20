import { NextResponse } from "next/server"
import { validateSlackApiToken } from "@/lib/slack"

export const dynamic = "force-dynamic"

/**
 * POST /api/slack/validate-token
 * Validates a Slack API token (xoxb- or xoxp-) and returns enriched metadata.
 *
 * This endpoint is self-authenticating — it does NOT require an existing session.
 * The token itself is the credential being validated.
 *
 * Request body: { token: string }
 * Returns: SlackApiTokenCredential-shaped JSON
 *
 * Error codes:
 *   400 — Bad prefix (not xoxb-/xoxp-)
 *   401 — Invalid or revoked token
 *   502 — Network failure reaching Slack API
 */
export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const token = body.token
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Missing token field" },
      { status: 400 }
    )
  }

  // Validate prefix
  if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
    return NextResponse.json(
      { error: "Invalid token prefix — must start with xoxb- or xoxp-" },
      { status: 400 }
    )
  }

  try {
    const result = await validateSlackApiToken(token)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Token validation failed" },
        { status: 401 }
      )
    }

    // Return a SlackApiTokenCredential-shaped response
    return NextResponse.json({
      provider: "slack",
      credentialKind: "api-token",
      token_type: result.token_type,
      access_token: token,
      team_id: result.team_id,
      team_domain: result.team_domain,
      user_id: result.user_id,
      bot_id: result.bot_id,
      scopes: result.scopes,
    })
  } catch (error) {
    // Network-level failures reaching Slack API
    const message =
      error instanceof Error ? error.message : "Token validation failed"

    // Distinguish network errors from auth errors
    if (message.includes("HTTP error")) {
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
