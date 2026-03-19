import { NextResponse } from "next/server"
import { getGoogleAccessToken, unauthorized, serverError } from "../../_helpers"

export async function GET() {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return unauthorized()

  try {
    // Domain-wide delegation is managed through the GCP IAM API,
    // not the Google Admin SDK. This placeholder will be replaced
    // when GCP IAM integration is added to Ninken.
    return NextResponse.json({
      delegations: [],
      note: "Domain-wide delegation audit requires IAM API access. This will be implemented when GCP IAM integration is added.",
    })
  } catch (error) {
    return serverError(error, "google")
  }
}
