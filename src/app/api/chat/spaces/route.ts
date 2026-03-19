import { NextResponse } from "next/server"
import { createChatService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../_helpers"

/**
 * GET /api/chat/spaces
 *
 * Lists Google Chat spaces the authenticated user is a member of.
 */
export async function GET(request: Request) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const pageSize = Math.min(Number(searchParams.get("pageSize")) || 100, 1000)
    const pageToken = searchParams.get("pageToken") || undefined

    const chat = createChatService(token)
    const res = await chat.spaces.list({
      pageSize,
      pageToken,
    })

    const spaces = (res.data.spaces || []).map((s) => ({
      name: s.name || "",
      displayName: s.displayName || "",
      type: s.type || "",
      spaceType: s.spaceType || "",
      singleUserBotDm: s.singleUserBotDm || false,
      threaded: s.threaded || false,
      externalUserAllowed: s.externalUserAllowed || false,
      spaceThreadingState: s.spaceThreadingState || "",
      membershipCount: s.membershipCount
        ? { joinedDirectHumanUserCount: s.membershipCount.joinedDirectHumanUserCount || 0, joinedGroupCount: s.membershipCount.joinedGroupCount || 0 }
        : undefined,
    }))

    return NextResponse.json({
      spaces,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error)
  }
}
