import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 50, 999)
    const search = searchParams.get("search") || undefined
    const pageToken = searchParams.get("pageToken") || undefined

    const extraHeaders: Record<string, string> = {}

    // $search requires ConsistencyLevel: eventual header
    if (search) {
      extraHeaders["ConsistencyLevel"] = "eventual"
    }

    const result = await graphPaginated(credential, "/users", {
      top,
      select:
        "id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled",
      search: search || undefined,
      extraHeaders: Object.keys(extraHeaders).length
        ? extraHeaders
        : undefined,
      pageToken,
    })

    return NextResponse.json({
      users: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
