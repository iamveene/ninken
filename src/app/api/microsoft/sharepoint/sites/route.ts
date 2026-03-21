import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || "*"
    const top = Math.min(Number(searchParams.get("top")) || 50, 200)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, `/sites?search=${encodeURIComponent(search)}`, {
      top,
      select: "id,displayName,webUrl,description,createdDateTime,lastModifiedDateTime",
      pageToken,
    })

    return NextResponse.json({
      sites: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
