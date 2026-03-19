import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, badRequest, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")
    const top = Math.min(Number(searchParams.get("top")) || 25, 100)
    const select = searchParams.get("select") || "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,flag"
    const pageToken = searchParams.get("pageToken") || undefined

    if (!q) {
      return badRequest("Missing required query parameter: q")
    }

    // Note: $search (KQL) cannot be combined with $orderby in Graph API
    const result = await graphPaginated(credential, "/me/messages", {
      top,
      select,
      search: q,
      pageToken,
      // ConsistencyLevel: eventual is required for $search
      extraHeaders: { ConsistencyLevel: "eventual" },
    })

    return NextResponse.json({
      messages: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
