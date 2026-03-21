import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackPaginated } from "@/lib/slack"

export const dynamic = "force-dynamic"

type SlackUser = {
  id: string
  name: string
  real_name: string
  profile: {
    email?: string
    title?: string
    display_name?: string
    real_name_normalized?: string
    image_48?: string
    image_72?: string
    status_text?: string
    status_emoji?: string
  }
  is_admin: boolean
  is_owner: boolean
  is_primary_owner: boolean
  is_restricted: boolean
  is_ultra_restricted: boolean
  is_bot: boolean
  is_app_user: boolean
  deleted: boolean
  updated: number
  tz?: string
}

/**
 * GET /api/slack/users
 * Lists workspace members. Params: limit, cursor
 */
export async function GET(request: Request) {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000)
    const cursor = searchParams.get("cursor") || undefined

    const result = await slackPaginated<SlackUser>(
      credential,
      "users.list",
      "members",
      { limit },
      { cursor }
    )

    return NextResponse.json({
      users: result.items.map((u) => ({
        id: u.id,
        name: u.name,
        realName: u.real_name,
        displayName: u.profile.display_name || u.real_name,
        email: u.profile.email,
        title: u.profile.title,
        avatar: u.profile.image_72 || u.profile.image_48,
        statusText: u.profile.status_text,
        statusEmoji: u.profile.status_emoji,
        isAdmin: u.is_admin,
        isOwner: u.is_owner,
        isPrimaryOwner: u.is_primary_owner,
        isRestricted: u.is_restricted,
        isUltraRestricted: u.is_ultra_restricted,
        isBot: u.is_bot,
        isDeleted: u.deleted,
        updated: u.updated,
        tz: u.tz,
      })),
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
