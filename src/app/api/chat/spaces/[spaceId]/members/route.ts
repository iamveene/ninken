import { NextResponse } from "next/server"
import { createChatService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../../_helpers"

/**
 * GET /api/chat/spaces/[spaceId]/members
 *
 * Lists members in a Google Chat space.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/chat/spaces/[spaceId]/members">
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { spaceId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageSize = Math.min(Number(searchParams.get("pageSize")) || 100, 1000)
    const pageToken = searchParams.get("pageToken") || undefined

    const chat = createChatService(token)
    const res = await chat.spaces.members.list({
      parent: `spaces/${spaceId}`,
      pageSize,
      pageToken,
    })

    const members = (res.data.memberships || []).map((m) => ({
      name: m.name || "",
      state: m.state || "",
      role: m.role || "",
      createTime: m.createTime || "",
      member: m.member
        ? {
            name: m.member.name || "",
            displayName: m.member.displayName || "",
            type: m.member.type || "",
          }
        : null,
    }))

    return NextResponse.json({
      members,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
