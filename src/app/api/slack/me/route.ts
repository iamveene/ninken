import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackApi } from "@/lib/slack"

export const dynamic = "force-dynamic"

/**
 * GET /api/slack/me
 * Returns the authenticated user's identity (used as emailEndpoint).
 */
export async function GET() {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const data = await slackApi<{
      user_id: string
      user: string
      team_id: string
      team: string
      url: string
    }>(credential, "auth.test")

    return NextResponse.json({
      userId: data.user_id,
      userName: data.user,
      teamId: data.team_id,
      teamName: data.team,
      url: data.url,
      email: `${data.user}@${data.team}.slack.com`,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
