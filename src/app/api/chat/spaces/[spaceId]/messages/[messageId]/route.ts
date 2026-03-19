import { NextResponse } from "next/server"
import { createChatServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../../../_helpers"

/**
 * GET /api/chat/spaces/[spaceId]/messages/[messageId]
 *
 * Gets a single message from a Google Chat space.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/spaces/[spaceId]/messages/[messageId]">
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { spaceId, messageId } = await ctx.params

    const chat = createChatServiceFromToken(accessToken)
    const res = await chat.spaces.messages.get({
      name: `spaces/${spaceId}/messages/${messageId}`,
    })

    const m = res.data
    return NextResponse.json({
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
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
