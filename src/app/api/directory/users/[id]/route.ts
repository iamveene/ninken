import { NextResponse } from "next/server"
import { createDirectoryServiceFromToken } from "@/lib/google"
import { getGoogleAccessToken, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    const { id } = await params
    const admin = createDirectoryServiceFromToken(accessToken)
    const res = await admin.users.get({
      userKey: id,
      projection: "full",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error, "google")
  }
}
