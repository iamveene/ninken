import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { slackApi } from "@/lib/slack"

export const dynamic = "force-dynamic"

type SlackMessage = {
  type: string
  subtype?: string
  user?: string
  text: string
  ts: string
  thread_ts?: string
  reactions?: { name: string; count: number; users: string[] }[]
  files?: { id: string; name: string; mimetype: string; size: number }[]
}

/**
 * GET /api/slack/channels/[channelId]/replies
 * Returns thread replies. Params: ts (thread timestamp), limit
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const { channelId } = await params
    const { searchParams } = new URL(request.url)
    const ts = searchParams.get("ts")
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200)

    if (!ts) return badRequest("Missing ts parameter")

    const data = await slackApi<{
      messages: SlackMessage[]
      has_more: boolean
    }>(credential, "conversations.replies", {
      channel: channelId,
      ts,
      limit,
    })

    return NextResponse.json({
      messages: data.messages.map((m) => ({
        type: m.type,
        subtype: m.subtype,
        user: m.user,
        text: m.text,
        ts: m.ts,
        threadTs: m.thread_ts,
        reactions: m.reactions,
        files: m.files,
      })),
      hasMore: data.has_more,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
