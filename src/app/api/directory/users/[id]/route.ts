import { NextResponse } from "next/server"
import { createDirectoryService } from "@/lib/google"
import { getTokenFromRequest, unauthorized, serverError } from "../../../_helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getTokenFromRequest()
  if (!token) return unauthorized()

  try {
    const { id } = await params
    const admin = createDirectoryService(token)
    const res = await admin.users.get({
      userKey: id,
      projection: "full",
    })

    return NextResponse.json(res.data)
  } catch (error) {
    return serverError(error)
  }
}
