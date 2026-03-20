import { NextResponse } from "next/server"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    // Google Admin SDK does not provide a "list all OAuth grants" endpoint.
    // admin.tokens.list() requires a specific userKey and cannot accept "all".
    // A full audit would require enumerating every user and calling
    // admin.tokens.list({ userKey }) for each one, which is impractical here.
    return NextResponse.json({
      apps: [],
      note: "Requires per-user token enumeration. A full OAuth app audit needs to iterate over all users and call tokens.list for each.",
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
