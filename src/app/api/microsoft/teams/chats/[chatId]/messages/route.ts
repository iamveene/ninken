import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/microsoft/teams/chats/[chatId]/messages">
) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { chatId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(
      credential,
      `/me/chats/${chatId}/messages`,
      {
        top: 50,
        pageToken,
      }
    )

    return NextResponse.json({
      messages: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
