import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackPaginated } from "@/lib/slack"

export const dynamic = "force-dynamic"

type SlackChannel = {
  id: string
  name: string
  is_channel: boolean
  is_group: boolean
  is_im: boolean
  is_mpim: boolean
  is_private: boolean
  is_archived: boolean
  is_member: boolean
  num_members: number
  topic: { value: string }
  purpose: { value: string }
  creator: string
  created: number
  updated: number
}

/**
 * GET /api/slack/channels
 * Lists conversations. Params: types, view, limit, cursor
 */
export async function GET(request: Request) {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") || "all"
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000)
    const cursor = searchParams.get("cursor") || undefined

    // Map view to types parameter
    let types = "public_channel,private_channel,mpim,im"
    let excludeArchived = true
    switch (view) {
      case "public":
        types = "public_channel"
        break
      case "private":
        types = "private_channel"
        break
      case "im":
        types = "im,mpim"
        break
      case "archived":
        excludeArchived = false
        types = "public_channel,private_channel"
        break
    }

    const result = await slackPaginated<SlackChannel>(
      credential,
      "conversations.list",
      "channels",
      {
        types,
        exclude_archived: excludeArchived,
        limit,
      },
      { cursor }
    )

    return NextResponse.json({
      channels: result.items.map((ch) => ({
        id: ch.id,
        name: ch.name || ch.id,
        isChannel: ch.is_channel,
        isGroup: ch.is_group,
        isIm: ch.is_im,
        isMpim: ch.is_mpim,
        isPrivate: ch.is_private,
        isArchived: ch.is_archived,
        isMember: ch.is_member,
        memberCount: ch.num_members,
        topic: ch.topic?.value || "",
        purpose: ch.purpose?.value || "",
        creator: ch.creator,
        created: ch.created,
        updated: ch.updated,
      })),
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
