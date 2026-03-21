import { NextResponse } from "next/server"
import { getSlackCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { slackApi } from "@/lib/slack"

export const dynamic = "force-dynamic"

type SlackFile = {
  id: string
  name: string
  title: string
  mimetype: string
  filetype: string
  size: number
  user: string
  created: number
  timestamp: number
  channels: string[]
  groups: string[]
  ims: string[]
  url_private: string
  url_private_download: string
  thumb_360?: string
  thumb_480?: string
  permalink: string
  is_external: boolean
  is_public: boolean
  shares?: Record<string, unknown>
}

type SlackPaging = {
  count: number
  total: number
  page: number
  pages: number
}

/**
 * GET /api/slack/files
 * Lists files. Params: channel, count, page, types, ts_from, ts_to
 */
export async function GET(request: Request) {
  const credential = await getSlackCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const count = Math.min(Number(searchParams.get("count")) || 50, 100)
    const page = Number(searchParams.get("page")) || 1
    const channel = searchParams.get("channel") || undefined
    const types = searchParams.get("types") || undefined
    const tsFrom = searchParams.get("ts_from") || undefined
    const tsTo = searchParams.get("ts_to") || undefined

    const apiParams: Record<string, string | number | boolean> = {
      count,
      page,
    }
    if (channel) apiParams.channel = channel
    if (types) apiParams.types = types
    if (tsFrom) apiParams.ts_from = tsFrom
    if (tsTo) apiParams.ts_to = tsTo

    const data = await slackApi<{
      files: SlackFile[]
      paging: SlackPaging
    }>(credential, "files.list", apiParams)

    return NextResponse.json({
      files: data.files.map((f) => ({
        id: f.id,
        name: f.name,
        title: f.title,
        mimetype: f.mimetype,
        filetype: f.filetype,
        size: f.size,
        user: f.user,
        created: f.created,
        channels: f.channels,
        permalink: f.permalink,
        isExternal: f.is_external,
        isPublic: f.is_public,
      })),
      paging: {
        count: data.paging.count,
        total: data.paging.total,
        page: data.paging.page,
        pages: data.paging.pages,
      },
    })
  } catch (error) {
    return serverError(error, "slack")
  }
}
