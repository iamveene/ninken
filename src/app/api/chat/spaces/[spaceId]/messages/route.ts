import { NextResponse } from "next/server"
import { createChatServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../_helpers"

/**
 * GET /api/chat/spaces/[spaceId]/messages
 *
 * Lists messages in a Google Chat space.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/chat/spaces/[spaceId]/messages">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { spaceId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageSize = Math.min(Number(searchParams.get("pageSize")) || 50, 1000)
    const pageToken = searchParams.get("pageToken") || undefined
    const filter = searchParams.get("filter") || undefined
    const orderBy = searchParams.get("orderBy") || "createTime desc"
    const showDeleted = searchParams.get("showDeleted") === "true"

    const chat = createChatServiceFromToken(accessToken)
    const res = await chat.spaces.messages.list({
      parent: `spaces/${spaceId}`,
      pageSize,
      pageToken,
      filter,
      orderBy,
      showDeleted,
    })

    const messages = (res.data.messages || []).map((m) => ({
      name: m.name || "",
      sender: m.sender
        ? {
            name: m.sender.name || "",
            displayName: m.sender.displayName || "",
            type: m.sender.type || "",
          }
        : null,
      createTime: m.createTime || "",
      lastUpdateTime: m.lastUpdateTime || "",
      text: m.text || "",
      formattedText: m.formattedText || "",
      threadName: m.thread?.name || "",
      space: m.space?.name || "",
      argumentText: m.argumentText || "",
      attachment: (m.attachment || []).map((a) => ({
        name: a.name || "",
        contentName: a.contentName || "",
        contentType: a.contentType || "",
        thumbnailUri: a.thumbnailUri || "",
        downloadUri: a.downloadUri || "",
        source: a.source || "",
      })),
      clientAssignedMessageId: m.clientAssignedMessageId || "",
    }))

    return NextResponse.json({
      messages,
      nextPageToken: res.data.nextPageToken || null,
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
