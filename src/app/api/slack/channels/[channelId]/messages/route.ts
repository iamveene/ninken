import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackApi } from "@/lib/slack"

export const dynamic = "force-dynamic"

type SlackMessage = {
  type: string
  subtype?: string
  user?: string
  text: string
  ts: string
  thread_ts?: string
  reply_count?: number
  reply_users_count?: number
  reactions?: { name: string; count: number; users: string[] }[]
  files?: {
    id: string
    name: string
    mimetype: string
    size: number
    url_private: string
    thumb_360?: string
  }[]
  attachments?: { fallback?: string; text?: string; title?: string }[]
}

/**
 * GET /api/slack/channels/[channelId]/messages
 * Returns conversation history. Params: limit, cursor, oldest, latest
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
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200)
    const cursor = searchParams.get("cursor") || undefined
    const oldest = searchParams.get("oldest") || undefined
    const latest = searchParams.get("latest") || undefined

    const apiParams: Record<string, string | number | boolean> = {
      channel: channelId,
      limit,
    }
    if (cursor) apiParams.cursor = cursor
    if (oldest) apiParams.oldest = oldest
    if (latest) apiParams.latest = latest

    const data = await slackApi<{
      messages: SlackMessage[]
      has_more: boolean
      response_metadata?: { next_cursor?: string }
    }>(credential, "conversations.history", apiParams)

    return NextResponse.json({
      messages: data.messages.map((m) => ({
        type: m.type,
        subtype: m.subtype,
        user: m.user,
        text: m.text,
        ts: m.ts,
        threadTs: m.thread_ts,
        replyCount: m.reply_count || 0,
        replyUsersCount: m.reply_users_count || 0,
        reactions: m.reactions,
        files: m.files?.map((f) => ({
          id: f.id,
          name: f.name,
          mimetype: f.mimetype,
          size: f.size,
        })),
        hasAttachments: !!m.attachments?.length || !!m.files?.length,
      })),
      hasMore: data.has_more,
      nextCursor: data.response_metadata?.next_cursor || null,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
