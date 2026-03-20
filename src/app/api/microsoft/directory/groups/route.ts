import { NextResponse } from "next/server"
import { getMicrosoftCredential, unauthorized, serverError } from "@/app/api/_helpers"
import { graphPaginated } from "@/lib/microsoft"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const credential = await getMicrosoftCredential()
  if (!credential) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const top = Math.min(Number(searchParams.get("top")) || 50, 999)
    const pageToken = searchParams.get("pageToken") || undefined

    const result = await graphPaginated(credential, "/groups", {
      top,
      select:
        "id,displayName,description,mail,groupTypes,securityEnabled,membershipRule",
      pageToken,
    })

    return NextResponse.json({
      groups: result.value,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    return serverError(error, "microsoft")
  }
}
