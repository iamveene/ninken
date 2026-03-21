import { NextResponse } from "next/server"
import { bootstrapToken } from "@/lib/slack"
import { getCredentialFromRequest, unauthorized } from "../../_helpers"

export const dynamic = "force-dynamic"

/**
 * POST /api/slack/bootstrap
 * Accepts a d_cookie and bootstraps the xoxc- token by fetching the Slack
 * workspace page server-side and extracting the token from boot_data.
 *
 * Returns a complete credential object ready for validateCredential.
 *
 * Requires an existing authenticated session (any provider).
 */
export async function POST(request: Request) {
  const session = await getCredentialFromRequest()
  if (!session) return unauthorized()

  let body: { d_cookie?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Reject API tokens — they don't need bootstrap
  if (body.d_cookie && typeof body.d_cookie === "string" &&
      (body.d_cookie.startsWith("xoxb-") || body.d_cookie.startsWith("xoxp-"))) {
    return NextResponse.json(
      { error: "API tokens (xoxb-/xoxp-) do not need bootstrap. Use /api/slack/validate-token instead." },
      { status: 400 }
    )
  }

  const dCookie = body.d_cookie
  if (!dCookie || typeof dCookie !== "string") {
    return NextResponse.json(
      { error: "Missing d_cookie field" },
      { status: 400 }
    )
  }

  try {
    const result = await bootstrapToken(dCookie)

    return NextResponse.json({
      provider: "slack",
      d_cookie: dCookie,
      xoxc_token: result.xoxc_token,
      team_id: result.team_id,
      team_domain: result.team_domain,
      user_id: result.user_id,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bootstrap failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
