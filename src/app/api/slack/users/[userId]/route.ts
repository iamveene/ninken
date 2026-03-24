import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackApi } from "@/lib/slack"

export const dynamic = "force-dynamic"

/**
 * GET /api/slack/users/[userId]
 * Returns a single user's info.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const { userId } = await params

    const data = await slackApi<{
      user: {
        id: string
        name: string
        real_name: string
        profile: {
          email?: string
          title?: string
          display_name?: string
          image_72?: string
          status_text?: string
          status_emoji?: string
        }
        is_admin: boolean
        is_owner: boolean
        is_bot: boolean
        deleted: boolean
        tz?: string
      }
    }>(credential, "users.info", { user: userId })

    const u = data.user
    return NextResponse.json({
      id: u.id,
      name: u.name,
      realName: u.real_name,
      displayName: u.profile.display_name || u.real_name,
      email: u.profile.email,
      title: u.profile.title,
      avatar: u.profile.image_72,
      statusText: u.profile.status_text,
      statusEmoji: u.profile.status_emoji,
      isAdmin: u.is_admin,
      isOwner: u.is_owner,
      isBot: u.is_bot,
      isDeleted: u.deleted,
      tz: u.tz,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
